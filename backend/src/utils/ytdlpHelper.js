const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const http = require("http");
const urlParse = require("url").parse;

// ─── Constants ───────────────────────────────────────────────────────────────

const DIRECT_AUDIO_EXTS = new Set(["flac", "mp3", "m4a", "ogg", "opus", "wav", "webm", "aac", "amr"]);
const DIRECT_VIDEO_EXTS = new Set(["mp4", "mov", "mkv", "avi", "webm", "mpeg"]);
const WHISPER_ALLOWED_EXTS = new Set(["flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "opus", "wav", "webm"]);

// Client round order: try all combined first, then fall back individually
const YOUTUBE_PLAYER_CLIENTS = [
  "web,mweb,android",   // Round 1: all at once
  "web",                // Round 2: web only
  "android",            // Round 3: android only
  "mweb",               // Round 4: mobile web only
];

// Format chain: each string is a yt-dlp slash-chained fallback expression.
// yt-dlp tries left-to-right within a single -f value; outer array gives us
// additional retry attempts with progressively looser requirements.
const FORMAT_CHAIN = [
  "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio[ext=opus]/bestaudio/best",
  "ba/b",
  "worst",
];

// ─── URL Helpers ─────────────────────────────────────────────────────────────

function normalizeHost(urlStr) {
  try {
    const host = (urlParse(urlStr).host || "").toLowerCase();
    return host.startsWith("www.") ? host.substring(4) : host;
  } catch (e) {
    return "";
  }
}

function guessExtFromUrl(urlStr) {
  try {
    const ext = path.extname(urlParse(urlStr).pathname || "").toLowerCase().replace(".", "");
    return ext;
  } catch (e) {
    return "";
  }
}

function sanitizeYoutubeUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (["youtube.com", "youtu.be"].includes(host) || host.endsWith(".youtube.com")) {
      if (parsed.pathname === "/watch" && parsed.searchParams.has("v")) {
        const v = parsed.searchParams.get("v");
        return `https://${parsed.hostname}/watch?v=${v}`;
      }
    }
  } catch (e) {
    // ignore malformed URLs
  }
  return urlStr;
}

function sanitizeFilename(name) {
  const cleaned = (name || "extracted-audio").replace(/[^\w\-. ]+/g, "").trim();
  return cleaned.substring(0, 120);
}

// ─── Cookie Handling ──────────────────────────────────────────────────────────

/**
 * Resolves a cookie file path from env or well-known locations.
 * Returns { path, isTemp } — isTemp=true means we wrote it and must clean it up.
 */
function getTempCookieFile() {
  const content = (process.env.YOUTUBE_COOKIES_CONTENT || "").trim();
  if (content) {
    try {
      const tmpPath = path.join(os.tmpdir(), `yt_cookies_${Date.now()}.txt`);
      fs.writeFileSync(tmpPath, content, "utf8");
      return { path: tmpPath, isTemp: true };
    } catch (e) {
      console.warn("[cookies] Failed to write temp cookie file:", e.message);
    }
  }

  const candidates = [
    process.env.YOUTUBE_COOKIES_FILE,
    "cookies.txt",
    "/etc/secrets/cookies.txt",
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return { path: candidate, isTemp: false };
    }
  }

  return { path: null, isTemp: false };
}

function cleanupCookieFile(cookieData) {
  if (cookieData.isTemp && cookieData.path && fs.existsSync(cookieData.path)) {
    try { fs.unlinkSync(cookieData.path); } catch (_) {}
  }
}

// ─── Core yt-dlp Runner ───────────────────────────────────────────────────────

/**
 * Runs yt-dlp with the given args and returns stdout as a string.
 * Cookie file injection is handled automatically.
 */
async function runYtDlp(urlStr, args = []) {
  return new Promise((resolve, reject) => {
    const cookieData = getTempCookieFile();
    const finalArgs = [...args];

    if (cookieData.path) {
      finalArgs.push("--cookies", cookieData.path);
    }

    finalArgs.push("--quiet", "--no-warnings", "--no-playlist");

    const proc = spawn("yt-dlp", [...finalArgs, urlStr]);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      cleanupCookieFile(cookieData);
      if (code !== 0) {
        return reject(new Error(`yt-dlp exited ${code}: ${stderr.trim().slice(-400)}`));
      }
      resolve(stdout);
    });

    proc.on("error", (err) => {
      cleanupCookieFile(cookieData);
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
    });
  });
}

// ─── Source Detection ─────────────────────────────────────────────────────────

async function safeHeadContentType(urlStr) {
  return new Promise((resolve) => {
    const client = urlStr.startsWith("https") ? https : http;
    const req = client.request(urlStr, { method: "HEAD", timeout: 10000 }, (res) => {
      resolve((res.headers["content-type"] || "").split(";")[0].trim().toLowerCase());
    });
    req.on("error", () => resolve(""));
    req.on("timeout", () => { req.destroy(); resolve(""); });
    req.end();
  });
}

async function detectDriveMediaKind(urlStr) {
  try {
    const out = await runYtDlp(urlStr, ["--dump-json", "--skip-download"]);
    const info = JSON.parse(out);
    const vcodec = String(info.vcodec || "").toLowerCase();
    const acodec = String(info.acodec || "").toLowerCase();
    const ext = String(info.ext || "").toLowerCase();

    const hasVideo = vcodec && vcodec !== "none";
    const hasAudio = acodec && acodec !== "none";

    if (!hasVideo && hasAudio) {
      return { type: "drive_audio", label: "Drive Audio", kind: "audio" };
    }
    if (hasVideo) {
      return { type: "drive_video", label: "Drive Video", kind: "video" };
    }
    if (DIRECT_AUDIO_EXTS.has(ext)) {
      return { type: "drive_audio", label: "Drive Audio", kind: "audio" };
    }
    if (DIRECT_VIDEO_EXTS.has(ext)) {
      return { type: "drive_video", label: "Drive Video", kind: "video" };
    }
  } catch (e) {
    console.warn("[detectDriveMediaKind] Detection failed:", e.message);
  }

  return { type: "unsupported", label: "Unsupported Drive Media", kind: "unknown" };
}

/**
 * Inspects a URL and returns a source descriptor:
 *   { source_type, label, kind, requires_extraction }
 */
async function detectSource(urlStr) {
  const host = normalizeHost(urlStr);
  const ext = guessExtFromUrl(urlStr);

  if (["youtube.com", "youtu.be"].includes(host) || host.endsWith(".youtube.com")) {
    return { source_type: "youtube_video", label: "YouTube Video", kind: "video", requires_extraction: true };
  }

  if (host === "drive.google.com" || host.endsWith(".drive.google.com")) {
    const { type, label, kind } = await detectDriveMediaKind(urlStr);
    return { source_type: type, label, kind, requires_extraction: kind === "video" };
  }

  if (DIRECT_AUDIO_EXTS.has(ext)) {
    return { source_type: "direct_audio", label: "Direct Audio", kind: "audio", requires_extraction: false };
  }
  if (DIRECT_VIDEO_EXTS.has(ext)) {
    return { source_type: "direct_video", label: "Direct Video", kind: "video", requires_extraction: true };
  }

  const ctype = await safeHeadContentType(urlStr);
  if (ctype.startsWith("audio/")) {
    return { source_type: "direct_audio", label: "Direct Audio", kind: "audio", requires_extraction: false };
  }
  if (ctype.startsWith("video/")) {
    return { source_type: "direct_video", label: "Direct Video", kind: "video", requires_extraction: true };
  }

  return { source_type: "unsupported", label: "Unsupported Source", kind: "unknown", requires_extraction: false };
}

// ─── Video Download (yt-dlp with retry matrix) ────────────────────────────────

/**
 * Cleans up any partial "source.*" files left in outputDir from a failed attempt.
 */
function cleanPartialFiles(outputDir) {
  try {
    fs.readdirSync(outputDir).forEach((file) => {
      if (file.startsWith("source.")) {
        try { fs.unlinkSync(path.join(outputDir, file)); } catch (_) {}
      }
    });
  } catch (_) {}
}

/**
 * Finds the most recently modified "source.*" file in outputDir.
 */
function findDownloadedFile(outputDir) {
  let dlPath = null;
  let latestMtime = 0;

  try {
    fs.readdirSync(outputDir).forEach((file) => {
      if (file.startsWith("source.")) {
        const fullPath = path.join(outputDir, file);
        try {
          const mtime = fs.statSync(fullPath).mtimeMs;
          if (mtime > latestMtime) {
            latestMtime = mtime;
            dlPath = fullPath;
          }
        } catch (_) {}
      }
    });
  } catch (_) {}

  return dlPath;
}

/**
 * Downloads a video/audio stream via yt-dlp.
 *
 * Retry matrix:
 *   Outer loop → YOUTUBE_PLAYER_CLIENTS (bot-detection workarounds)
 *   Inner loop → FORMAT_CHAIN          (format availability fallbacks)
 *
 * @param {string}   urlStr     The source URL
 * @param {string}   outputDir  Directory to write the downloaded file into
 * @param {Function} setProgress  Callback(string) for progress updates
 * @returns {{ downloadedPath: string, title: string }}
 */
async function downloadVideoFile(urlStr, outputDir, setProgress) {
  const outputTemplate = path.join(outputDir, "source.%(ext)s");
  let lastError = null;

  for (let clientIdx = 0; clientIdx < YOUTUBE_PLAYER_CLIENTS.length; clientIdx++) {
    const clients = YOUTUBE_PLAYER_CLIENTS[clientIdx];

    for (let fmtIdx = 0; fmtIdx < FORMAT_CHAIN.length; fmtIdx++) {
      const fmt = FORMAT_CHAIN[fmtIdx];
      cleanPartialFiles(outputDir);

      const cookieData = getTempCookieFile();

      const args = [
        "-o", outputTemplate,
        "--no-warnings",
        "--no-playlist",
        "--newline",
        "--no-abort-on-error",
        "--format-sort", "acodec:m4a,acodec:opus,br",
        "-f", fmt,
        "--extractor-args", `youtube:player_client=${clients}`,
        "--print", "FINAL_INFO:%(title)s|%(filepath)s",
      ];

      if (cookieData.path) {
        args.push("--cookies", cookieData.path);
      }

      const label = `client=${clients} fmt=${fmt.slice(0, 40)}`;
      setProgress(`Fetching… (attempt ${clientIdx * FORMAT_CHAIN.length + fmtIdx + 1}: ${label})`);

      try {
        const { title } = await new Promise((resolve, reject) => {
          const proc = spawn("yt-dlp", [...args, urlStr]);
          let stdout = "";
          let stderr = "";

          proc.stdout.on("data", (d) => {
            const text = d.toString();
            stdout += text;

            // Live download percentage from yt-dlp's --newline output
            const match = text.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
            if (match) {
              setProgress(`Downloading: ${match[1]}%`);
            }
          });

          proc.stderr.on("data", (d) => {
            stderr += d.toString();
          });

          proc.on("error", (err) => {
            reject(new Error(`Spawn error: ${err.message}`));
          });

          proc.on("close", (code) => {
            if (code !== 0) {
              const msg = stderr.trim().slice(-400);

              // Surface bot-detection immediately — no point retrying formats
              if (
                stderr.includes("Sign in to confirm") ||
                stderr.toLowerCase().includes("bot") ||
                stderr.includes("age-restricted")
              ) {
                return reject(
                  new Error("YouTube bot-detection triggered. Please update or provide cookies.")
                );
              }

              // Surface format-not-available so outer loop can retry
              if (
                msg.includes("Requested format is not available") ||
                msg.includes("requested format not available")
              ) {
                return reject(new Error(`FORMAT_UNAVAILABLE: ${msg}`));
              }

              return reject(new Error(`yt-dlp exited ${code}: ${msg}`));
            }

            // Parse title from our --print output
            let title = "video-audio";
            for (const line of stdout.split("\n")) {
              const marker = "FINAL_INFO:";
              if (line.includes(marker)) {
                const parts = line.split(marker)[1].trim().split("|");
                if (parts[0]) title = parts[0];
                break;
              }
            }

            resolve({ title });
          });
        });

        // Verify the file actually landed
        const dlPath = findDownloadedFile(outputDir);
        if (!dlPath) {
          throw new Error("yt-dlp exited cleanly but no output file was found.");
        }

        return { downloadedPath: dlPath, title };

      } catch (e) {
        lastError = e;

        // Bot-detection is unrecoverable regardless of format/client — rethrow immediately
        if (
          e.message.includes("bot-detection") ||
          e.message.includes("Sign in to confirm") ||
          e.message.includes("age-restricted")
        ) {
          throw e;
        }

        // FORMAT_UNAVAILABLE → continue to next format in inner loop
        if (e.message.startsWith("FORMAT_UNAVAILABLE")) {
          console.warn(`[downloadVideoFile] Format unavailable, retrying… (${label})`);
          continue;
        }

        // Any other error → log and continue through the matrix
        console.warn(`[downloadVideoFile] Attempt failed (${label}): ${e.message}`);

      } finally {
        cleanupCookieFile(cookieData);
      }
    }
  }

  throw new Error(
    `Could not download audio after exhausting all format/client combinations. ` +
    `Last error: ${lastError ? lastError.message : "unknown"}`
  );
}

// ─── Direct Audio Download ────────────────────────────────────────────────────

/**
 * Downloads a direct-link audio file over HTTP(S).
 *
 * @param {string}   urlStr
 * @param {string}   outputDir
 * @param {Function} setProgress
 * @returns {{ downloadedPath: string, title: string }}
 */
async function downloadDirectAudioFile(urlStr, outputDir, setProgress) {
  setProgress("Downloading audio…");

  return new Promise((resolve, reject) => {
    const client = urlStr.startsWith("https") ? https : http;

    const req = client.get(urlStr, (res) => {
      if (res.statusCode >= 400) {
        return reject(new Error(`HTTP ${res.statusCode} while fetching audio`));
      }

      // Handle redirects (3xx)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadDirectAudioFile(res.headers.location, outputDir, setProgress)
          .then(resolve)
          .catch(reject);
      }

      const ctype = (res.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      const extMap = {
        "audio/wav": "wav",
        "audio/x-wav": "wav",
        "audio/webm": "webm",
        "audio/ogg": "ogg",
        "audio/opus": "opus",
        "audio/flac": "flac",
        "audio/aac": "aac",
        "audio/mpeg": "mp3",
        "audio/mp4": "m4a",
      };
      const ext = extMap[ctype] || "mp3";

      const target = path.join(outputDir, `direct_audio.${ext}`);
      const file = fs.createWriteStream(target);

      // Track download progress if content-length is available
      const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
      let receivedBytes = 0;

      res.on("data", (chunk) => {
        receivedBytes += chunk.length;
        if (totalBytes > 0) {
          const pct = ((receivedBytes / totalBytes) * 100).toFixed(1);
          setProgress(`Downloading: ${pct}%`);
        }
      });

      res.pipe(file);

      file.on("finish", () => {
        file.close(() => {
          resolve({ downloadedPath: target, title: `direct-audio.${ext}` });
        });
      });

      file.on("error", (err) => {
        fs.unlink(target, () => {});
        reject(err);
      });
    });

    req.on("error", reject);

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Direct audio download timed out."));
    });
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  detectSource,
  sanitizeYoutubeUrl,
  sanitizeFilename,
  downloadVideoFile,
  downloadDirectAudioFile,
  // Exported for testing
  FORMAT_CHAIN,
  YOUTUBE_PLAYER_CLIENTS,
};