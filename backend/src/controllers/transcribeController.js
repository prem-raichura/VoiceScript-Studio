const fs = require("fs");
const path = require("path");
const os = require("os");
const multer = require("multer");
const Busboy = require("busboy");
const { spawn } = require("child_process");
const { client } = require("../utils/groqClient");
const { sseResponse, sendSseMessage } = require("../utils/sseHelper");
const { translateStream } = require("./translateController");
const pLimit = require("p-limit");

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
  fs.writeFileSync(tempPath, audioBuffer);

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
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

async function transcribeSegmentFile(filePath, sourceLang, index) {
  const buffer = fs.readFileSync(filePath);
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

        const buffer = fs.readFileSync(inputPath);
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

