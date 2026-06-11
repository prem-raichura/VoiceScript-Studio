const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const http = require("http");

// ─── Constants ───────────────────────────────────────────────────────────────

const DIRECT_AUDIO_EXTS = new Set(["flac", "mp3", "m4a", "ogg", "opus", "wav", "webm", "aac", "amr"]);
const DIRECT_VIDEO_EXTS = new Set(["mp4", "mov", "mkv", "avi", "webm", "mpeg"]);

// Simple format preference list — yt-dlp tries each in order, stops at first success
const FORMAT_ATTEMPTS = [
  "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
  "bestaudio/best",
  "b[ext=mp4]/b",
  "18",    // 360p mp4+audio, extremely widely available
  "worst", // last resort — any quality
];

// ─── Cookie Handling ──────────────────────────────────────────────────────────
//
// Priority order:
//  1. YOUTUBE_COOKIES_CONTENT env var (paste full file text) → written to temp file
//  2. YOUTUBE_COOKIES_FILE env var    (path to cookies.txt on disk)
//  3. cookies.txt in project root
//  4. /etc/secrets/cookies.txt        (Render secret file mount)
//  5. No cookies (works for some public videos)

function getCookiePath() {
  // 1. Content directly in env var
  const content = (process.env.YOUTUBE_COOKIES_CONTENT || "").trim();
  if (content) {
    try {
      const tmpPath = path.join(os.tmpdir(), `yt_cookies_${Date.now()}.txt`);
      fs.writeFileSync(tmpPath, content, "utf8");
      console.log("[cookies] Using YOUTUBE_COOKIES_CONTENT env var");
      return { path: tmpPath, isTemp: true };
    } catch (e) {
      console.warn("[cookies] Failed to write temp cookie file:", e.message);
    }
  }

  // 2-4. File path candidates
  const candidates = [
    process.env.YOUTUBE_COOKIES_FILE,
    path.join(process.cwd(), "cookies.txt"),
    "/etc/secrets/cookies.txt",
  ].filter(Boolean);

  for (const f of candidates) {
    if (fs.existsSync(f)) {
      console.log(`[cookies] Using cookie file: ${f}`);
      return { path: f, isTemp: false };
    }
  }

  console.warn("[cookies] No cookies found — downloads may fail on restricted videos.");
  return { path: null, isTemp: false };
}

function releaseCookies(cookie) {
  if (cookie?.isTemp && cookie?.path) {
    try { fs.unlinkSync(cookie.path); } catch (_) {}
  }
}

// ─── URL Helpers ─────────────────────────────────────────────────────────────

function normalizeHost(urlStr) {
  try {
    const h = new URL(urlStr).hostname.toLowerCase();
    return h.startsWith("www.") ? h.slice(4) : h;
  } catch { return ""; }
}

function guessExtFromUrl(urlStr) {
  try {
    return path.extname(new URL(urlStr).pathname).toLowerCase().replace(".", "");
  } catch { return ""; }
}

function sanitizeYoutubeUrl(urlStr) {
  try {
    const p = new URL(urlStr);
    const h = p.hostname.toLowerCase().replace(/^www\./, "");
    if (["youtube.com", "youtu.be"].includes(h) || h.endsWith(".youtube.com")) {
      if (p.pathname === "/watch" && p.searchParams.has("v")) {
        return `https://${p.hostname}/watch?v=${p.searchParams.get("v")}`;
      }
    }
  } catch (_) {}
  return urlStr;
}

function sanitizeFilename(name) {
  return (name || "extracted-audio").replace(/[^\w\-. ]+/g, "").trim().slice(0, 120);
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
    const cookie = getCookiePath();
    const args = ["--dump-json", "--skip-download", "--quiet", "--no-warnings", "--no-playlist"];
    if (cookie.path) args.push("--cookies", cookie.path);
    const out = await runRaw([...args, urlStr]);
    releaseCookies(cookie);
    const info = JSON.parse(out);
    const vcodec = String(info.vcodec || "").toLowerCase();
    const acodec = String(info.acodec || "").toLowerCase();
    const ext    = String(info.ext   || "").toLowerCase();
    if ((!vcodec || vcodec === "none") && acodec && acodec !== "none") return { type: "drive_audio", label: "Drive Audio", kind: "audio" };
    if (vcodec && vcodec !== "none") return { type: "drive_video", label: "Drive Video", kind: "video" };
    if (DIRECT_AUDIO_EXTS.has(ext)) return { type: "drive_audio", label: "Drive Audio", kind: "audio" };
    if (DIRECT_VIDEO_EXTS.has(ext)) return { type: "drive_video", label: "Drive Video", kind: "video" };
  } catch (e) {
    console.warn("[detectDriveMediaKind]", e.message);
  }
  return { type: "unsupported", label: "Unsupported Drive Media", kind: "unknown" };
}

async function detectSource(urlStr) {
  const host = normalizeHost(urlStr);
  const ext  = guessExtFromUrl(urlStr);

  if (["youtube.com", "youtu.be"].includes(host) || host.endsWith(".youtube.com"))
    return { source_type: "youtube_video", label: "YouTube Video", kind: "video", requires_extraction: true };

  if (host === "drive.google.com" || host.endsWith(".drive.google.com")) {
    const { type, label, kind } = await detectDriveMediaKind(urlStr);
    return { source_type: type, label, kind, requires_extraction: kind === "video" };
  }

  if (DIRECT_AUDIO_EXTS.has(ext))
    return { source_type: "direct_audio", label: "Direct Audio", kind: "audio", requires_extraction: false };

  if (DIRECT_VIDEO_EXTS.has(ext))
    return { source_type: "direct_video", label: "Direct Video", kind: "video", requires_extraction: true };

  const ctype = await safeHeadContentType(urlStr);
  if (ctype.startsWith("audio/")) return { source_type: "direct_audio", label: "Direct Audio", kind: "audio", requires_extraction: false };
  if (ctype.startsWith("video/")) return { source_type: "direct_video", label: "Direct Video", kind: "video", requires_extraction: true };

  return { source_type: "unsupported", label: "Unsupported Source", kind: "unknown", requires_extraction: false };
}

// ─── Raw yt-dlp runner ────────────────────────────────────────────────────────

function runRaw(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("yt-dlp", args);
    let out = "", err = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("close", (code) => code === 0 ? resolve(out) : reject(new Error(err.trim().slice(-400))));
    proc.on("error", (e) => reject(e));
  });
}

// ─── File Helpers ─────────────────────────────────────────────────────────────

function cleanPartialFiles(dir) {
  try { fs.readdirSync(dir).filter(f => f.startsWith("source.")).forEach(f => { try { fs.unlinkSync(path.join(dir, f)); } catch (_) {} }); } catch (_) {}
}

function findDownload(dir) {
  let best = null, t = 0;
  try {
    fs.readdirSync(dir).forEach(f => {
      if (!f.startsWith("source.")) return;
      const full = path.join(dir, f);
      const mt = fs.statSync(full).mtimeMs;
      if (mt > t) { t = mt; best = full; }
    });
  } catch (_) {}
  return best;
}

// ─── Main Download ────────────────────────────────────────────────────────────

/**
 * Downloads audio from a YouTube/video URL using yt-dlp.
 *
 * Key strategy: specify --extractor-args "youtube:player_client=tv_embedded"
 * which is a deprecated client. yt-dlp skips it and auto-falls back to
 * android_vr — a client that does NOT require JS signature solving.
 * This was proven to work in manual testing:
 *   yt-dlp --cookies <file> --extractor-args "youtube:player_client=tv_embedded" -f bestaudio -o out.%(ext)s <url>
 *
 * Auth: YOUTUBE_COOKIES_CONTENT env → YOUTUBE_COOKIES_FILE env → cookies.txt in project root
 */
async function downloadVideoFile(urlStr, outputDir, setProgress) {
  const template = path.join(outputDir, "source.%(ext)s");
  const cookie = getCookiePath();
  const cookieLabel = cookie.path ? path.basename(cookie.path) : "none";

  // These args trigger yt-dlp to skip the deprecated client and fall back to android_vr
  // android_vr bypasses the JS signature challenge entirely — proven to work
  const baseArgs = [
    "-o", template,
    "--no-playlist",
    "--newline",
    "--extractor-args", "youtube:player_client=tv_embedded",
  ];
  if (cookie.path) baseArgs.push("--cookies", cookie.path);

  // Format preference list — tries best audio first
  const formats = [
    "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
    "bestaudio/best",
    "b[ext=mp4]/b",
    "18",
    "worst",
  ];

  let lastError = null;
  let attempt   = 0;
  const log     = [];

  for (const fmt of formats) {
    attempt++;
    cleanPartialFiles(outputDir);
    setProgress(`Fetching audio… (attempt ${attempt}/${formats.length})`);
    console.log(`[yt-dlp] attempt ${attempt}: fmt="${fmt}" cookies="${cookieLabel}"`);

    const args = [...baseArgs, "-f", fmt, urlStr];

    try {
      const stdout = await new Promise((resolve, reject) => {
        const proc = spawn("yt-dlp", args);
        let out = "", err = "";

        proc.stdout.on("data", (d) => {
          const text = d.toString();
          out += text;
          const pct = text.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
          if (pct) setProgress(`Downloading: ${pct[1]}%`);
        });
        proc.stderr.on("data", (d) => { err += d.toString(); });
        proc.on("error", (e) => reject(Object.assign(e, { stderr: err })));
        proc.on("close", (code) => {
          if (code !== 0) return reject(Object.assign(new Error(err.trim().slice(-400)), { stderr: err }));
          resolve(out);
        });
      });

      const dlPath = findDownload(outputDir);
      if (!dlPath) {
        log.push(`attempt ${attempt} fmt="${fmt}": exit-0-no-file`);
        lastError = new Error("yt-dlp exited cleanly but wrote no output file");
        continue;
      }

      // Use filename as title (yt-dlp sets it from the video title)
      const title = sanitizeFilename(path.basename(dlPath, path.extname(dlPath))) || "audio";
      releaseCookies(cookie);
      console.log(`[yt-dlp] ✓ Downloaded: ${dlPath}`);
      return { downloadedPath: dlPath, title };

    } catch (e) {
      lastError = e;
      const stderr = (e.stderr || e.message || "").toLowerCase();

      let cls = "UNKNOWN";
      if (stderr.includes("requested format is not available") ||
          stderr.includes("only images are available") ||
          stderr.includes("no video formats found")) cls = "FORMAT_UNAVAILABLE";
      else if (stderr.includes("private video") || stderr.includes("video unavailable")) cls = "VIDEO_UNAVAILABLE";
      else if (stderr.includes("sign in") || stderr.includes("403") || stderr.includes("no longer valid")) cls = "COOKIES_EXPIRED";

      log.push(`attempt ${attempt} fmt="${fmt}": ${cls}`);
      console.warn(`[yt-dlp] attempt ${attempt} (${cls})`);

      if (cls === "VIDEO_UNAVAILABLE") { releaseCookies(cookie); throw new Error("Video is unavailable (private, deleted, or geo-restricted)."); }
    }
  }

  releaseCookies(cookie);
  const cookiesExpired = log.some(l => l.includes("COOKIES_EXPIRED"));
  throw new Error(
    `YouTube audio download failed after ${attempt} attempts.\n\n` +
    (cookiesExpired
      ? "• Cookies expired — re-export from Chrome using 'Get cookies.txt LOCALLY' and replace cookies.txt in the backend folder."
      : "• All format attempts failed. Try re-exporting fresh YouTube cookies from Chrome.") +
    `\n\nAttempts:\n${log.join("\n")}\n\nLast error: ${lastError?.message?.slice(0, 300) || "unknown"}`
  );
}

// ─── Direct Audio Download ────────────────────────────────────────────────────

async function downloadDirectAudioFile(urlStr, outputDir, setProgress) {
  setProgress("Downloading audio…");
  return new Promise((resolve, reject) => {
    const client = urlStr.startsWith("https") ? https : http;
    const req = client.get(urlStr, (res) => {
      if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
      if (res.statusCode >= 300 && res.headers.location)
        return downloadDirectAudioFile(res.headers.location, outputDir, setProgress).then(resolve).catch(reject);

      const ctype = (res.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
      const extMap = { "audio/wav":"wav","audio/x-wav":"wav","audio/webm":"webm","audio/ogg":"ogg",
                       "audio/opus":"opus","audio/flac":"flac","audio/aac":"aac","audio/mpeg":"mp3","audio/mp4":"m4a" };
      const ext  = extMap[ctype] || "mp3";
      const dest = path.join(outputDir, `direct_audio.${ext}`);
      const file = fs.createWriteStream(dest);

      const total = parseInt(res.headers["content-length"] || "0", 10);
      let recv = 0;
      res.on("data", (c) => { recv += c.length; if (total > 0) setProgress(`Downloading: ${((recv/total)*100).toFixed(1)}%`); });
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve({ downloadedPath: dest, title: `direct-audio.${ext}` })));
      file.on("error", (e) => { fs.unlink(dest, () => {}); reject(e); });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Direct audio download timed out.")); });
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  detectSource,
  sanitizeYoutubeUrl,
  sanitizeFilename,
  downloadVideoFile,
  downloadDirectAudioFile,
  FORMAT_CHAIN: FORMAT_ATTEMPTS,
  YOUTUBE_PLAYER_CLIENTS: [],
};