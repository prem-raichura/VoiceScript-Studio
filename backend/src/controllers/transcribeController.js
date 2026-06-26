const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const multer = require("multer");
const { client } = require("../utils/groqClient");
const { sseResponse, sendSseMessage } = require("../utils/sseHelper");
const { translateStream } = require("./translateController");
const { del } = require("@vercel/blob");

const WHISPER_MAX_BYTES = 25 * 1024 * 1024; // 25 MB — Whisper hard limit

// Small audio chunk posted directly by the browser (kept under Vercel's
// 4.5 MB request body cap by client-side ffmpeg.wasm segmentation).
const uploadChunk = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: WHISPER_MAX_BYTES },
}).single("audio");

async function runWhisper(audioBuffer, filename, contentType, sourceLang) {
  // groq-sdk wants a file stream — write the buffer to a temp file first.
  const tempPath = path.join(os.tmpdir(), `whisper_tmp_${Date.now()}_${path.basename(filename || "audio")}`);
  await fsp.writeFile(tempPath, audioBuffer);

  try {
    const kwargs = {
      file: fs.createReadStream(tempPath),
      model: "whisper-large-v3",
      response_format: "verbose_json",
      temperature: 0.0,
    };
    if (sourceLang && sourceLang !== "auto") {
      kwargs.language = sourceLang;
    }
    const transcript = await client.audio.transcriptions.create(kwargs);
    return {
      text: transcript.text,
      detected_lang: transcript.language || sourceLang,
      duration: transcript.duration || 0,
    };
  } finally {
    await fsp.unlink(tempPath).catch(() => {});
  }
}

// ── POST /api/transcribe-chunk ────────────────────────────────────────────────
// One small audio segment → text. Stateless; frontend concatenates results.
exports.transcribeChunk = (req, res) => {
  uploadChunk(req, res, async (err) => {
    if (err) {
      return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 500).json({ error: err.message });
    }
    if (!req.file) return res.status(400).json({ error: "No audio chunk provided" });

    const sourceLang = req.body.source_lang || "auto";
    const index = parseInt(req.body.index || "0", 10);
    const total = parseInt(req.body.total || "1", 10);

    try {
      const result = await runWhisper(
        req.file.buffer,
        req.file.originalname || `chunk-${index}.mp3`,
        req.file.mimetype,
        sourceLang
      );
      return res.json({
        index,
        total,
        text: result.text,
        detected_lang: result.detected_lang,
        duration: Math.round(result.duration * 100) / 100,
      });
    } catch (error) {
      console.error("Chunk transcription error:", error);
      return res.status(500).json({ error: `Chunk transcription failed: ${error.message}` });
    }
  });
};

// ── Shared: transcribe a buffer, stream SSE, optionally translate ─────────────
async function streamTranscribeBuffer(res, buffer, filename, sourceLang, targetLang, action) {
  const result = await runWhisper(buffer, filename, "audio/mpeg", sourceLang);

  sseResponse(res);
  sendSseMessage(res, {
    type: "meta",
    duration: Math.round(result.duration * 10) / 10,
    detected_lang: result.detected_lang,
  });
  sendSseMessage(res, { type: "original", text: result.text });

  if (action === "translate") {
    await translateStream(res, result.text, targetLang); // ends the response
  } else {
    sendSseMessage(res, { type: "done" });
    res.end();
  }
}

// ── POST /api/transcribe-blob ─────────────────────────────────────────────────
// Body: { blobUrl, filename?, source_lang?, target_lang?, action? }
// Fetches the stored file from Vercel Blob, transcribes (<=25 MB), then deletes
// the blob. For files >25 MB the client must segment via ffmpeg.wasm and use
// /api/transcribe-chunk instead.
exports.transcribeBlob = async (req, res) => {
  const {
    blobUrl,
    filename = "audio.mp3",
    source_lang = "auto",
    target_lang = "en",
    action = "translate",
  } = req.body || {};

  if (!blobUrl) return res.status(400).json({ error: "blobUrl is required" });

  let deleted = false;
  const cleanup = async () => {
    if (deleted) return;
    deleted = true;
    try { await del(blobUrl); } catch (e) { console.error("[transcribe-blob] blob delete failed:", e.message); }
  };

  try {
    const fetchRes = await fetch(blobUrl);
    if (!fetchRes.ok) {
      await cleanup();
      return res.status(502).json({ error: `Failed to fetch blob (${fetchRes.status})` });
    }

    const arrayBuf = await fetchRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    if (buffer.length > WHISPER_MAX_BYTES) {
      await cleanup();
      return res.status(413).json({
        error: `File is ${(buffer.length / 1024 / 1024).toFixed(1)} MB — exceeds Whisper's 25 MB limit. Use client-side chunking for large files.`,
      });
    }

    await streamTranscribeBuffer(res, buffer, filename, source_lang, target_lang, action);
  } catch (err) {
    console.error("[transcribe-blob] error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else { try { sendSseMessage(res, { type: "error", message: err.message }); res.end(); } catch {} }
  } finally {
    await cleanup();
  }
};

// ── Google Drive / generic media URL normalization ───────────────────────────
// A Drive *share* link (file/d/<ID>/view, open?id=<ID>, uc?id=<ID>) returns an
// HTML page, not bytes. Rewrite to the direct-download endpoint with confirm=t
// so the virus-scan interstitial is skipped for larger files.
function normalizeMediaUrl(url) {
  let id = null;
  try {
    const u = new URL(url);
    if (/(^|\.)drive\.google\.com$/i.test(u.hostname)) {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/);
      id = m ? m[1] : u.searchParams.get("id");
    } else if (/(^|\.)docs\.google\.com$/i.test(u.hostname)) {
      const m = u.pathname.match(/\/d\/([^/]+)/);
      id = m ? m[1] : u.searchParams.get("id");
    }
  } catch {
    return url;
  }
  if (id) {
    return `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
  }
  return url;
}

// ── Download helper for direct public links ───────────────────────────────────
async function fetchUrlToBuffer(url) {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status} while downloading audio`);

  // Guard against HTML interstitials (private Drive file, login/consent page).
  const ct = (r.headers.get("content-type") || "").toLowerCase();
  if (ct.startsWith("text/html")) {
    throw new Error(
      "Link returned a web page, not an audio file. Make sure the file is shared 'Anyone with the link' and points directly to audio/video."
    );
  }

  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
}

// ── POST /api/transcribe-url ──────────────────────────────────────────────────
// Direct public audio link only (no yt-dlp, no segmentation). >25 MB rejected.
exports.transcribeFromUrl = async (req, res) => {
  const { url, source_lang = "auto", target_lang = "en", action = "translate" } = req.body || {};
  if (!url) return res.status(400).json({ error: "url is required" });

  const fetchUrl = normalizeMediaUrl(url);

  let ext = "mp3";
  try { ext = (path.extname(new URL(url).pathname).replace(".", "").toLowerCase()) || "mp3"; } catch {}

  try {
    let buffer;
    try {
      buffer = await fetchUrlToBuffer(fetchUrl);
    } catch (e) {
      return res.status(502).json({ error: `Failed to download audio: ${e.message}` });
    }

    if (buffer.length > WHISPER_MAX_BYTES) {
      return res.status(413).json({
        error: `This file is ${(buffer.length / 1024 / 1024).toFixed(1)} MB — over Whisper's 25 MB limit for links. Download it and upload the file instead (large uploads are split automatically).`,
      });
    }

    await streamTranscribeBuffer(res, buffer, `input.${ext}`, source_lang, target_lang, action);
  } catch (err) {
    console.error("[transcribe-url] error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else { try { sendSseMessage(res, { type: "error", message: err.message }); res.end(); } catch {} }
  }
};
