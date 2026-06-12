const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const multer = require("multer");
const Busboy = require("busboy");
const { spawn } = require("child_process");
const { client } = require("../utils/groqClient");
const { sseResponse, sendSseMessage } = require("../utils/sseHelper");
const { translateStream } = require("./translateController");
const pLimit = require("p-limit");
const uploadController = require("./uploadController");

const WHISPER_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: WHISPER_MAX_BYTES },
}).single("audio");

const uploadChunk = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: WHISPER_MAX_BYTES },
}).single("audio");

async function runWhisper(audioBuffer, filename, contentType, sourceLang) {
  // We need to convert Buffer to a file object for groq SDK
  // We can write it to a temp file
  const tempPath = path.join(os.tmpdir(), `whisper_tmp_${Date.now()}_${filename}`);
  await fsp.writeFile(tempPath, audioBuffer);

  try {
    const kwargs = {
      file: fs.createReadStream(tempPath),
      model: "whisper-large-v3",
      response_format: "verbose_json",
      temperature: 0.0,
    };
    if (sourceLang !== "auto") {
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

async function transcribeSegmentFile(filePath, sourceLang, index) {
  const buffer = await fsp.readFile(filePath);
  const result = await runWhisper(buffer, path.basename(filePath), "audio/mpeg", sourceLang);
  return { index, ...result };
}

exports.transcribe = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Audio too large. Use /transcribe-large for files over 25 MB." });
      }
      return res.status(500).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const sourceLang = req.body.source_lang || "auto";
    const targetLang = req.body.target_lang || "en";
    const action = (req.body.action || "translate").toLowerCase();

    if (action !== "transcript" && action !== "translate") {
      return res.status(400).json({ error: "Invalid action. Use 'transcript' or 'translate'." });
    }

    let originalText, detectedLang, duration;
    try {
      const result = await runWhisper(req.file.buffer, req.file.originalname, req.file.mimetype, sourceLang);
      originalText = result.text;
      detectedLang = result.detected_lang;
      duration = result.duration;
    } catch (error) {
      console.error("Transcription error:", error);
      return res.status(500).json({ error: `Transcription failed: ${error.message}` });
    }

    sseResponse(res);
    sendSseMessage(res, { type: "meta", duration: Math.round(duration * 10) / 10, detected_lang: detectedLang });
    sendSseMessage(res, { type: "original", text: originalText });

    if (action === "transcript") {
      sendSseMessage(res, { type: "done" });
      return res.end();
    }

    await translateStream(res, originalText, targetLang);
  });
};

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
      const result = await runWhisper(req.file.buffer, req.file.originalname || `chunk-${index}.webm`, req.file.mimetype, sourceLang);
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

exports.transcribeLarge = (req, res) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "large_transcribe_"));
  const inputPath = path.join(tempDir, "input.webm");
  let sourceLang = "auto";
  let targetLang = "en";
  let action = "translate";

  const busboy = Busboy({ headers: req.headers });

  busboy.on("field", (fieldname, val) => {
    if (fieldname === "source_lang") sourceLang = val;
    if (fieldname === "target_lang") targetLang = val;
    if (fieldname === "action") action = val.toLowerCase();
  });

  busboy.on("file", (fieldname, file, info) => {
    if (fieldname === "audio") {
      file.pipe(fs.createWriteStream(inputPath));
    } else {
      file.resume();
    }
  });

  busboy.on("finish", async () => {
    // ── Check if ffmpeg is available ──────────────────────────────────────────
    const ffmpegAvailable = await new Promise((resolve) => {
      const check = spawn("ffmpeg", ["-version"]);
      check.on("error", () => resolve(false));
      check.on("close", (code) => resolve(code === 0));
    });

    if (!ffmpegAvailable) {
      // ── Fallback: treat the whole file as a single chunk ──────────────────
      // Works for files up to 25 MB (Whisper limit). For larger files,
      // install ffmpeg: brew install ffmpeg
      console.warn("[transcribeLarge] ffmpeg not found — transcribing as single chunk (no segmentation).");
      try {
        const fileSize = fs.statSync(inputPath).size;
        if (fileSize > WHISPER_MAX_BYTES) {
          fs.rmSync(tempDir, { recursive: true, force: true });
          return res.status(413).json({
            error: `File is ${(fileSize / 1024 / 1024).toFixed(1)} MB which exceeds Whisper's 25 MB limit. Install ffmpeg to enable automatic segmentation: brew install ffmpeg`,
          });
        }

        const buffer = await fsp.readFile(inputPath);
        const result = await runWhisper(buffer, "input.webm", "audio/webm", sourceLang);

        sseResponse(res);
        sendSseMessage(res, { type: "meta", duration: Math.round(result.duration * 10) / 10, detected_lang: result.detected_lang });
        sendSseMessage(res, { type: "transcript_chunk", index: 0, text: result.text });
        sendSseMessage(res, { type: "done" });
        res.end();
      } catch (err) {
        console.error("[transcribeLarge] Single-chunk fallback failed:", err.message);
        if (!res.headersSent) return res.status(500).json({ error: `Transcription failed: ${err.message}` });
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      return;
    }

    // ── Normal path: ffmpeg segments the file ─────────────────────────────────
    const segmentsDir = path.join(tempDir, "segments");
    fs.mkdirSync(segmentsDir, { recursive: true });
    const segmentPattern = path.join(segmentsDir, "chunk_%05d.mp3");

    const proc = spawn("ffmpeg", [
      "-y", "-i", inputPath,
      "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k",
      "-f", "segment", "-segment_time", "600", "-reset_timestamps", "1",
      segmentPattern,
    ]);

    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    // ── Handle ffmpeg spawn error (ENOENT safety net) ─────────────────────────
    proc.on("error", (err) => {
      fs.rmSync(tempDir, { recursive: true, force: true });
      if (!res.headersSent) res.status(500).json({ error: `ffmpeg not available: ${err.message}` });
    });

    proc.on("close", async (code) => {
      if (code !== 0) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        return res.status(500).json({ error: `Failed to segment audio: ${stderr.slice(-400)}` });
      }

      const segmentPaths = fs
        .readdirSync(segmentsDir)
        .filter((f) => f.startsWith("chunk_") && f.endsWith(".mp3"))
        .map((f) => path.join(segmentsDir, f))
        .sort();

      if (segmentPaths.length === 0) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        return res.status(500).json({ error: "No audio segments were produced from the file." });
      }

      sseResponse(res);
      const total = segmentPaths.length;
      sendSseMessage(res, { type: "progress", completed: 0, total, message: `Transcribing 0/${total} parts...` });

      let completed = 0;
      let nextIndex = 0;
      let durationTotal = 0.0;
      let detectedLang = "";
      const ready = {};

      const limit = pLimit(3);
      const transcribePromises = segmentPaths.map((sp, i) =>
        limit(() =>
          transcribeSegmentFile(sp, sourceLang, i)
            .then((result) => {
              completed++;
              ready[result.index] = result;
              sendSseMessage(res, { type: "progress", completed, total, message: `Transcribing ${completed}/${total} parts...` });

              while (ready[nextIndex]) {
                const chunkResult = ready[nextIndex];
                delete ready[nextIndex];
                if (!detectedLang && chunkResult.detected_lang) detectedLang = chunkResult.detected_lang;
                durationTotal += chunkResult.duration;
                sendSseMessage(res, { type: "transcript_chunk", index: nextIndex, text: chunkResult.text });
                nextIndex++;
              }
            })
            .catch((err) => {
              console.error("Segment error:", err);
              sendSseMessage(res, { type: "error", message: err.message });
            })
        )
      );

      try {
        await Promise.all(transcribePromises);
        sendSseMessage(res, { type: "meta", duration: Math.round(durationTotal * 10) / 10, detected_lang: detectedLang });
      } catch (err) {
        sendSseMessage(res, { type: "error", message: err.message });
      }

      sendSseMessage(res, { type: "done" });
      res.end();
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  req.pipe(busboy);
};

// ─── Download helper ──────────────────────────────────────────────────────────

function downloadFromUrl(url, destPath) {
  return new Promise((resolve, reject) => {
    const https = require("https");
    const http  = require("http");
    const client = url.startsWith("https") ? https : http;

    const file = fs.createWriteStream(destPath);

    const req = client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(destPath, () => {});
        return downloadFromUrl(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode >= 400) {
        file.close();
        fs.unlink(destPath, () => {});
        return reject(new Error(`HTTP ${res.statusCode} while downloading audio`));
      }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
      file.on("error", (e) => { fs.unlink(destPath, () => {}); reject(e); });
    });

    req.on("error", (e) => { fs.unlink(destPath, () => {}); reject(e); });
    req.on("timeout", () => { req.destroy(); reject(new Error("Download timed out")); });
  });
}

// ─── Transcribe from URL (Cloudinary or any HTTPS audio link) ─────────────────

exports.transcribeFromUrl = async (req, res) => {
  const { url, source_lang = "auto", target_lang = "en", action = "translate" } = req.body;

  if (!url) return res.status(400).json({ error: "url is required" });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "url_transcribe_"));
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    fs.rm(tempDir, { recursive: true, force: true }, () => {});
  };

  try {
    // Guess extension from URL (Cloudinary keeps the original extension)
    const rawExt = path.extname(new URL(url).pathname).replace(".", "").toLowerCase();
    const ext = rawExt || "mp3";
    const inputPath = path.join(tempDir, `input.${ext}`);

    // Download the file from Cloudinary / HTTPS
    try {
      await downloadFromUrl(url, inputPath);
    } catch (e) {
      cleanup();
      return res.status(502).json({ error: `Failed to download audio: ${e.message}` });
    }

    const fileSize = fs.statSync(inputPath).size;

    // ── Small file: transcribe directly ───────────────────────────────────────
    if (fileSize <= WHISPER_MAX_BYTES) {
      const buffer = await fsp.readFile(inputPath);
      const result = await runWhisper(buffer, `input.${ext}`, `audio/${ext}`, source_lang);

      sseResponse(res);
      sendSseMessage(res, { type: "meta", duration: Math.round(result.duration * 10) / 10, detected_lang: result.detected_lang });
      sendSseMessage(res, { type: "original", text: result.text });

      if (action === "translate") {
        await translateStream(res, result.text, target_lang);
      } else {
        sendSseMessage(res, { type: "done" });
        res.end();
      }
      cleanup();
      return;
    }

    // ── Large file: ffmpeg segmentation ──────────────────────────────────────
    const ffmpegAvailable = await new Promise((resolve) => {
      const check = spawn("ffmpeg", ["-version"]);
      check.on("error", () => resolve(false));
      check.on("close", (code) => resolve(code === 0));
    });

    if (!ffmpegAvailable) {
      cleanup();
      return res.status(413).json({
        error: `File is ${(fileSize / 1024 / 1024).toFixed(1)} MB — exceeds Whisper's 25 MB limit. Install ffmpeg to enable segmentation.`,
      });
    }

    const segmentsDir = path.join(tempDir, "segments");
    fs.mkdirSync(segmentsDir, { recursive: true });
    const segmentPattern = path.join(segmentsDir, "chunk_%05d.mp3");

    const proc = spawn("ffmpeg", [
      "-y", "-i", inputPath,
      "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k",
      "-f", "segment", "-segment_time", "600", "-reset_timestamps", "1",
      segmentPattern,
    ]);

    let ffmpegErr = "";
    proc.stderr.on("data", (d) => (ffmpegErr += d.toString()));
    proc.on("error", (e) => {
      cleanup();
      if (!res.headersSent) res.status(500).json({ error: `ffmpeg error: ${e.message}` });
    });

    proc.on("close", async (code) => {
      if (code !== 0) {
        cleanup();
        if (!res.headersSent) res.status(500).json({ error: `ffmpeg failed: ${ffmpegErr.slice(-300)}` });
        return;
      }

      const segmentPaths = fs.readdirSync(segmentsDir)
        .filter((f) => f.startsWith("chunk_") && f.endsWith(".mp3"))
        .map((f) => path.join(segmentsDir, f))
        .sort();

      if (!segmentPaths.length) {
        cleanup();
        return res.status(500).json({ error: "No audio segments produced." });
      }

      sseResponse(res);
      const total = segmentPaths.length;
      sendSseMessage(res, { type: "progress", completed: 0, total, message: `Transcribing 0/${total} parts...` });

      let completed = 0, nextIndex = 0, durationTotal = 0, detectedLang = "";
      const ready = {};
      const limit = pLimit(3);

      const promises = segmentPaths.map((sp, i) =>
        limit(() =>
          transcribeSegmentFile(sp, source_lang, i).then((result) => {
            completed++;
            ready[result.index] = result;
            sendSseMessage(res, { type: "progress", completed, total, message: `Transcribing ${completed}/${total} parts...` });

            while (ready[nextIndex]) {
              const r = ready[nextIndex];
              delete ready[nextIndex];
              if (!detectedLang && r.detected_lang) detectedLang = r.detected_lang;
              durationTotal += r.duration;
              sendSseMessage(res, { type: "transcript_chunk", index: nextIndex, text: r.text });
              nextIndex++;
            }
          }).catch((err) => {
            sendSseMessage(res, { type: "error", message: err.message });
          })
        )
      );

      try {
        await Promise.all(promises);
        sendSseMessage(res, { type: "meta", duration: Math.round(durationTotal * 10) / 10, detected_lang: detectedLang });
      } catch (err) {
        sendSseMessage(res, { type: "error", message: err.message });
      }

      sendSseMessage(res, { type: "done" });
      res.end();
      cleanup();
    });

  } catch (err) {
    cleanup();
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
};

// ─── Transcribe from chunked session upload ───────────────────────────────────
// Called after client has uploaded all chunks via /api/upload-chunk.
// Assembles chunks, then runs the same pipeline as transcribeFromUrl.

exports.transcribeSession = async (req, res) => {
  const { session_id, filename = "audio.mp3", source_lang = "auto", target_lang = "en", action = "translate" } = req.body;

  if (!session_id) return res.status(400).json({ error: "session_id is required" });

  let outputPath, sessionDir, ext;
  try {
    const assembled = await uploadController.assembleSession(session_id, filename);
    outputPath = assembled.outputPath;
    sessionDir = assembled.dir;
    ext = assembled.ext;
  } catch (err) {
    return res.status(404).json({ error: `Assembly failed: ${err.message}` });
  }

  const cleanup = () => uploadController.cleanupSession(session_id);

  try {
    const fileSize = fs.statSync(outputPath).size;

    // ── Small file: transcribe directly ───────────────────────────────────────
    if (fileSize <= WHISPER_MAX_BYTES) {
      const buffer = await fsp.readFile(outputPath);
      const result = await runWhisper(buffer, `input.${ext}`, `audio/${ext}`, source_lang);

      sseResponse(res);
      sendSseMessage(res, { type: "meta", duration: Math.round(result.duration * 10) / 10, detected_lang: result.detected_lang });
      sendSseMessage(res, { type: "original", text: result.text });

      if (action === "translate") {
        await translateStream(res, result.text, target_lang);
      } else {
        sendSseMessage(res, { type: "done" });
        res.end();
      }
      cleanup();
      return;
    }

    // ── Large file: ffmpeg segmentation then parallel Whisper ─────────────────
    const ffmpegAvailable = await new Promise((resolve) => {
      const check = spawn("ffmpeg", ["-version"]);
      check.on("error", () => resolve(false));
      check.on("close", (code) => resolve(code === 0));
    });

    if (!ffmpegAvailable) {
      cleanup();
      return res.status(500).json({ error: `File is ${(fileSize / 1024 / 1024).toFixed(1)} MB — ffmpeg is required for segmentation but not available.` });
    }

    const segmentsDir = path.join(sessionDir, "segments");
    fs.mkdirSync(segmentsDir, { recursive: true });
    const segmentPattern = path.join(segmentsDir, "chunk_%05d.mp3");

    const proc = spawn("ffmpeg", [
      "-y", "-i", outputPath,
      "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k",
      "-f", "segment", "-segment_time", "600", "-reset_timestamps", "1",
      segmentPattern,
    ]);

    let ffmpegErr = "";
    proc.stderr.on("data", (d) => (ffmpegErr += d.toString()));
    proc.on("error", (e) => {
      cleanup();
      if (!res.headersSent) res.status(500).json({ error: `ffmpeg error: ${e.message}` });
    });

    proc.on("close", async (code) => {
      if (code !== 0) {
        cleanup();
        if (!res.headersSent) res.status(500).json({ error: `ffmpeg failed: ${ffmpegErr.slice(-300)}` });
        return;
      }

      const segmentPaths = fs.readdirSync(segmentsDir)
        .filter((f) => f.startsWith("chunk_") && f.endsWith(".mp3"))
        .map((f) => path.join(segmentsDir, f))
        .sort();

      if (!segmentPaths.length) {
        cleanup();
        return res.status(500).json({ error: "No audio segments produced." });
      }

      sseResponse(res);
      const total = segmentPaths.length;
      sendSseMessage(res, { type: "progress", completed: 0, total, message: `Transcribing 0/${total} parts...` });

      let completed = 0, nextIndex = 0, durationTotal = 0, detectedLang = "";
      const ready = {};
      const limit = pLimit(3);

      const promises = segmentPaths.map((sp, i) =>
        limit(() =>
          transcribeSegmentFile(sp, source_lang, i).then((result) => {
            completed++;
            ready[result.index] = result;
            sendSseMessage(res, { type: "progress", completed, total, message: `Transcribing ${completed}/${total} parts...` });

            while (ready[nextIndex]) {
              const r = ready[nextIndex];
              delete ready[nextIndex];
              if (!detectedLang && r.detected_lang) detectedLang = r.detected_lang;
              durationTotal += r.duration;
              sendSseMessage(res, { type: "transcript_chunk", index: nextIndex, text: r.text });
              nextIndex++;
            }
          }).catch((err) => {
            sendSseMessage(res, { type: "error", message: err.message });
          })
        )
      );

      try {
        await Promise.all(promises);
        sendSseMessage(res, { type: "meta", duration: Math.round(durationTotal * 10) / 10, detected_lang: detectedLang });
      } catch (err) {
        sendSseMessage(res, { type: "error", message: err.message });
      }

      sendSseMessage(res, { type: "done" });
      res.end();
      cleanup();
    });

  } catch (err) {
    cleanup();
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
};
