const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const http = require("http");
const urlParse = require("url").parse;

const DIRECT_AUDIO_EXTS = new Set(["flac", "mp3", "m4a", "ogg", "opus", "wav", "webm", "aac", "amr"]);
const DIRECT_VIDEO_EXTS = new Set(["mp4", "mov", "mkv", "avi", "webm", "mpeg"]);
const WHISPER_ALLOWED_EXTS = new Set(["flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "opus", "wav", "webm"]);

const YOUTUBE_PLAYER_CLIENTS = ["web", "mweb", "android"];

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

async function safeHeadContentType(urlStr) {
  return new Promise((resolve) => {
    const client = urlStr.startsWith("https") ? https : http;
    const req = client.request(urlStr, { method: "HEAD", timeout: 10000 }, (res) => {
      resolve((res.headers["content-type"] || "").split(";")[0].trim().toLowerCase());
    });
    req.on("error", () => resolve(""));
    req.on("timeout", () => { req.abort(); resolve(""); });
    req.end();
  });
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
    // ignore
  }
  return urlStr;
}

function sanitizeFilename(name) {
  const cleaned = (name || "extracted-audio").replace(/[^\w\-. ]+/g, "").trim();
  return cleaned.substring(0, 120);
}

function getTempCookieFile() {
  const content = (process.env.YOUTUBE_COOKIES_CONTENT || "").trim();
  if (content) {
    try {
      const tmpPath = path.join(os.tmpdir(), `yt_cookies_${Date.now()}.txt`);
      fs.writeFileSync(tmpPath, content);
      return { path: tmpPath, isTemp: true };
    } catch (e) {
      console.warn("Failed to write cookie temp file:", e);
    }
  }

  for (const candidate of [process.env.YOUTUBE_COOKIES_FILE, "cookies.txt", "/etc/secrets/cookies.txt"]) {
    if (candidate && fs.existsSync(candidate)) {
      return { path: candidate, isTemp: false };
    }
  }

  return { path: null, isTemp: false };
}

async function runYtDlp(urlStr, args = []) {
  return new Promise((resolve, reject) => {
    const cookieData = getTempCookieFile();
    const finalArgs = [...args];
    if (cookieData.path) {
      finalArgs.push("--cookies", cookieData.path);
    }

    // append default opts
    finalArgs.push("--quiet", "--no-warnings", "--no-playlist");

    const proc = spawn("yt-dlp", [...finalArgs, urlStr]);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      if (cookieData.isTemp && fs.existsSync(cookieData.path)) {
        try { fs.unlinkSync(cookieData.path); } catch (e) {}
      }
      if (code !== 0) {
        return reject(new Error(`yt-dlp error: ${stderr.trim().slice(-400)}`));
      }
      resolve(stdout);
    });
  });
}

async function detectDriveMediaKind(urlStr) {
  try {
    const out = await runYtDlp(urlStr, ["--dump-json", "--skip-download"]);
    const info = JSON.parse(out);
    const vcodec = String(info.vcodec || "").toLowerCase();
    const acodec = String(info.acodec || "").toLowerCase();
    const ext = String(info.ext || "").toLowerCase();

    if ((!vcodec || vcodec === "none") && (acodec && acodec !== "none")) {
      return { type: "drive_audio", label: "Drive Audio", kind: "audio" };
    }
    if (vcodec && vcodec !== "none") {
      return { type: "drive_video", label: "Drive Video", kind: "video" };
    }
    if (DIRECT_AUDIO_EXTS.has(ext)) {
      return { type: "drive_audio", label: "Drive Audio", kind: "audio" };
    }
    if (DIRECT_VIDEO_EXTS.has(ext)) {
      return { type: "drive_video", label: "Drive Video", kind: "video" };
    }
  } catch (e) {
    console.warn("Drive media detection failed:", e);
  }
  return { type: "unsupported", label: "Unsupported Drive Media", kind: "unknown" };
}

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

async function downloadVideoFile(urlStr, outputDir, setProgress) {
  const outputTemplate = path.join(outputDir, "source.%(ext)s");
  const formatChain = [
    "default",
    "ba/b",
    "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
    "best"
  ];

  const clientRounds = [
    "default",
    YOUTUBE_PLAYER_CLIENTS.join(","),
    "web",
    "mweb"
  ];

  let lastExc = null;

  for (let roundIdx = 0; roundIdx < clientRounds.length; roundIdx++) {
    const clients = clientRounds[roundIdx];
    for (const fmt of formatChain) {
      // Cleanup partial files
      fs.readdirSync(outputDir).forEach(file => {
        if (file.startsWith("source.")) fs.unlinkSync(path.join(outputDir, file));
      });

      const cookieData = getTempCookieFile();
      const args = [
        "-o", outputTemplate,
        "--no-warnings", "--no-playlist", "--newline",
        "--print", "FINAL_INFO:%(title)s|%(filepath)s"
      ];
      if (fmt !== "default") {
        args.push("-f", fmt);
      }
      if (clients !== "default") {
        args.push("--extractor-args", `youtube:player_client=${clients}`);
      }
      
      if (cookieData.path) {
        args.push("--cookies", cookieData.path);
      }

      setProgress(`Fetching video… (round ${roundIdx + 1}, format: ${fmt.slice(0, 40)})`);

      try {
        const proc = spawn("yt-dlp", [...args, urlStr]);
        let stdout = "";
        let stderr = "";

        proc.stdout.on("data", d => {
          const text = d.toString();
          stdout += text;
          // Extract percentage like: [download]  15.5% of ...
          const match = text.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
          if (match) {
            setProgress(`Downloading: ${match[1]}%`);
          }
        });
        proc.stderr.on("data", d => stderr += d.toString());

        await new Promise((resolve, reject) => {
          proc.on("close", code => {
            if (code !== 0) {
              if (stderr.includes("Sign in to confirm") || stderr.toLowerCase().includes("bot")) {
                reject(new Error("YouTube bot-detection triggered. Please update cookies."));
              } else {
                reject(new Error(`yt-dlp err: ${stderr.slice(-200)}`));
              }
            } else {
              resolve();
            }
          });
        });

        // Try to parse out the title and path from print
        let title = "video-audio";
        for (const line of stdout.split("\n")) {
          if (line.includes("FINAL_INFO:")) {
            const parts = line.split("FINAL_INFO:")[1].trim().split("|");
            if (parts.length > 0) title = parts[0];
          }
        }
        
        let dlPath = null;
        fs.readdirSync(outputDir).forEach(file => {
          if (file.startsWith("source.")) {
            const fullPath = path.join(outputDir, file);
            if (!dlPath || fs.statSync(fullPath).mtime > fs.statSync(dlPath).mtime) {
              dlPath = fullPath;
            }
          }
        });

        if (!dlPath) throw new Error("Download completed but no file found.");

        return { downloadedPath: dlPath, title };
      } catch (e) {
        lastExc = e;
        if (e.message.includes("YouTube bot-detection")) throw e;
      } finally {
        if (cookieData.isTemp && fs.existsSync(cookieData.path)) {
          try { fs.unlinkSync(cookieData.path); } catch (e) {}
        }
      }
    }
  }

  throw new Error(`Could not download audio. Last error: ${lastExc ? lastExc.message : "Unknown"}`);
}

async function downloadDirectAudioFile(urlStr, outputDir, setProgress) {
  setProgress("Downloading audio…");
  return new Promise((resolve, reject) => {
    const client = urlStr.startsWith("https") ? https : http;
    client.get(urlStr, (res) => {
      if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
      const ctype = (res.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      // simplistic extension guess
      let ext = "mp3";
      if (ctype === "audio/wav") ext = "wav";
      else if (ctype === "audio/webm") ext = "webm";
      else if (ctype === "audio/ogg") ext = "ogg";

      const target = path.join(outputDir, `direct_audio.${ext}`);
      const file = fs.createWriteStream(target);
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve({ downloadedPath: target, title: `direct-audio.${ext}` });
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}

module.exports = {
  detectSource,
  sanitizeYoutubeUrl,
  sanitizeFilename,
  downloadVideoFile,
  downloadDirectAudioFile
};
