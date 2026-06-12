const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const os = require("os");
const mime = require("mime-types");

const {
  detectSource,
  sanitizeYoutubeUrl,
  sanitizeFilename,
  downloadVideoFile,
  downloadDirectAudioFile
} = require("../utils/ytdlpHelper");
const { getFfmpegExecutable, extractAudioWithFfmpeg } = require("../utils/ffmpegHelper");

const URL_AUDIO_JOBS = new Map();
const URL_JOB_TTL_MS = 60 * 60 * 1000; // 1 hour

function cleanupExpiredJobs() {
  const now = Date.now();
  for (const [jobId, job] of URL_AUDIO_JOBS.entries()) {
    if (now - job.updatedAt > URL_JOB_TTL_MS) {
      if (job.tempDir && fs.existsSync(job.tempDir)) {
        fs.rmSync(job.tempDir, { recursive: true, force: true });
      }
      URL_AUDIO_JOBS.delete(jobId);
    }
  }
}

function setUrlJob(jobId, updates) {
  const job = URL_AUDIO_JOBS.get(jobId);
  if (job) {
    Object.assign(job, updates);
    job.updatedAt = Date.now();
    URL_AUDIO_JOBS.set(jobId, job);
  }
}

async function processUrlAudioJob(jobId, url, detected) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `url_audio_${jobId}_`));
  setUrlJob(jobId, { status: "detecting", message: "Detecting source…", tempDir });

  try {
    // Reuse the detection already performed in extractAudioUrl to avoid a
    // second (and for Google Drive, expensive yt-dlp) detection round-trip.
    if (!detected) detected = await detectSource(url);
    const sourceType = detected.source_type;
    const sourceLabel = detected.label;
    const kind = detected.kind;

    setUrlJob(jobId, { sourceType, sourceLabel, mediaKind: kind, status: "fetching", message: `Source detected: ${sourceLabel}` });

    let audioPath, filename;
    const setProgress = (msg) => setUrlJob(jobId, { message: msg });

    if (sourceType === "direct_audio") {
      const res = await downloadDirectAudioFile(url, tempDir, setProgress);
      audioPath = res.downloadedPath;
      filename = res.title;
    } else {
      const { downloadedPath, title } = await downloadVideoFile(url, tempDir, setProgress);
      
      if (kind === "video") {
        setUrlJob(jobId, { status: "extracting", message: "Extracting audio…" });
        const ffmpegExe = getFfmpegExecutable();
        if (ffmpegExe) {
          audioPath = path.join(tempDir, "audio.mp3");
          await extractAudioWithFfmpeg(downloadedPath, audioPath);
          filename = `${sanitizeFilename(title)}.mp3`;
        } else {
          audioPath = downloadedPath;
          filename = `${sanitizeFilename(title)}${path.extname(downloadedPath) || ".mp4"}`;
          setUrlJob(jobId, { message: "ffmpeg not found – using source media directly." });
        }
      } else {
        audioPath = downloadedPath;
        filename = `${sanitizeFilename(title)}${path.extname(downloadedPath) || ".mp3"}`;
      }
    }

    setUrlJob(jobId, { status: "ready", message: "Audio ready", audioPath, filename, error: "" });
  } catch (err) {
    console.error(`URL audio job ${jobId} failed:`, err);
    setUrlJob(jobId, { status: "error", message: "Failed to fetch/extract audio", error: err.message });
  }
}

exports.detectSourceRoute = async (req, res) => {
  let url = (req.body.url || "").trim();
  if (!url) return res.status(400).json({ error: "URL is required" });
  url = sanitizeYoutubeUrl(url);
  try {
    const detected = await detectSource(url);
    if (detected.source_type === "unsupported") {
      return res.status(400).json({ error: "Unsupported input source" });
    }
    res.json(detected);
  } catch (err) {
    console.error("detectSource error:", err);
    res.status(500).json({ error: `Source detection failed: ${err.message}` });
  }
};

exports.extractAudioUrl = async (req, res) => {
  cleanupExpiredJobs();

  let url = (req.body.url || "").trim();
  if (!url) return res.status(400).json({ error: "URL is required" });
  url = sanitizeYoutubeUrl(url);

  let detected;
  try {
    detected = await detectSource(url);
  } catch (err) {
    console.error("detectSource error:", err);
    return res.status(500).json({ error: `Source detection failed: ${err.message}` });
  }

  if (detected.source_type === "unsupported") {
    return res.status(400).json({ error: "Unsupported URL. Use Google Drive, YouTube, or direct audio links." });
  }

  const jobId = uuidv4().replace(/-/g, "");
  const now = Date.now();

  URL_AUDIO_JOBS.set(jobId, {
    id: jobId,
    url,
    status: "queued",
    message: "Queued",
    error: "",
    audioPath: "",
    filename: "",
    tempDir: "",
    sourceType: detected.source_type,
    sourceLabel: detected.label,
    mediaKind: detected.kind,
    createdAt: now,
    updatedAt: now,
  });

  // Start background job (reuse the detection we just did)
  processUrlAudioJob(jobId, url, detected);

  res.status(202).json({
    job_id: jobId,
    status: "queued",
    message: "Queued",
    source_type: detected.source_type,
    source_label: detected.label,
  });
};

exports.extractAudioUrlStatus = (req, res) => {
  cleanupExpiredJobs();
  const job = URL_AUDIO_JOBS.get(req.params.job_id);
  if (!job) return res.status(404).json({ error: "Job not found" });

  res.json({
    job_id: job.id,
    status: job.status || "queued",
    message: job.message || "",
    error: job.error || "",
    source_type: job.sourceType || "",
    source_label: job.sourceLabel || "",
    media_kind: job.mediaKind || "",
  });
};

exports.extractAudioUrlDownload = (req, res) => {
  cleanupExpiredJobs();
  const job = URL_AUDIO_JOBS.get(req.params.job_id);
  if (!job) return res.status(404).json({ error: "Job not found" });

  if (job.status !== "ready") {
    const msg = job.status === "error" ? (job.error || "Audio extraction failed") : "Audio is not ready yet";
    return res.status(409).json({ error: msg });
  }

  if (!job.audioPath || !fs.existsSync(job.audioPath)) {
    return res.status(404).json({ error: "Prepared audio file was not found" });
  }

  const mimetype = mime.lookup(job.filename) || "application/octet-stream";
  res.setHeader("Content-Disposition", `attachment; filename="${job.filename}"`);
  res.setHeader("Content-Type", mimetype);
  fs.createReadStream(job.audioPath).pipe(res);
};
