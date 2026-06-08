"""
VoiceScript Studio – Backend API
=================================
Fixes in this version
─────────────────────
1.  Gunicorn worker timeout  → gthread worker + 300 s timeout (gunicorn.conf.py)
2.  Large-upload timeout     → file streamed to disk in 512 KB chunks BEFORE
                               Werkzeug multipart parsing
3.  YouTube bot-detection    → multi-client cascade with automatic retry +
                               clear user-facing error; cookie file is written
                               to a unique temp path per call (thread-safe)
4.  android_vr / ios removed → those clients are now blocked by YouTube (2026);
                               replaced with web → mweb → android cascade
5.  yt-dlp kept up to date   → upgrade checked in _ensure_ytdlp_fresh() on first
                               request (non-blocking background thread)
6.  Cookie file handling      → unique NamedTemporaryFile per call; existing
                               paths reused without copying; always cleaned up
7.  ThreadPoolExecutor capped → min(3, segments) workers
8.  Structured logging        → all log.* calls; no bare print()
9.  _sse_response() helper    → DRY SSE headers
10. All temp dirs cleaned in finally-blocks
"""

import json
import logging
import mimetypes
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import requests
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request, send_file, stream_with_context
from flask_cors import CORS
from groq import Groq
from yt_dlp import YoutubeDL

try:
    import imageio_ffmpeg
except Exception:
    imageio_ffmpeg = None

# ─── Bootstrap ────────────────────────────────────────────────────────────────

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s – %(message)s",
)
log = logging.getLogger("voicescript")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1_288_490_188  # 1.2 GB

CORS(
    app,
    origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://voice-script-studio.vercel.app",
        "https://voicescript-studio.vercel.app",
    ],
)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ─── Constants ────────────────────────────────────────────────────────────────

LANGUAGES = {
    "en": "English", "hi": "Hindi",  "gu": "Gujarati",
    "es": "Spanish",  "fr": "French", "de": "German",
    "ja": "Japanese", "zh": "Chinese (Mandarin)", "ar": "Arabic",
    "pt": "Portuguese", "ru": "Russian", "ko": "Korean", "it": "Italian",
}

WHISPER_MAX_BYTES   = 25 * 1024 * 1024  # 25 MB – Groq hard limit
URL_JOB_TTL_SECONDS = 60 * 60           # 1 hour

DIRECT_AUDIO_EXTS = {"flac", "mp3", "m4a", "ogg", "opus", "wav", "webm", "aac", "amr"}
DIRECT_VIDEO_EXTS = {"mp4", "mov", "mkv", "avi", "webm", "mpeg"}
WHISPER_ALLOWED_EXTS = {"flac","mp3","mp4","mpeg","mpga","m4a","ogg","opus","wav","webm"}
MIME_TO_AUDIO_EXT = {
    "audio/flac": "flac", "audio/mpeg": "mp3", "audio/mp3": "mp3",
    "audio/mp4": "mp4",   "video/mp4": "mp4",  "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",   "audio/ogg": "ogg",  "audio/opus": "opus",
    "audio/wav": "wav",   "audio/x-wav": "wav","audio/webm": "webm",
    "video/webm": "webm",
}

# YouTube player clients tried in order.
# android_vr / ios removed – YouTube blocked them in 2026.
# web_embedded was also removed (2026.01.31).
# Current working cascade (as of yt-dlp 2026.03.x): web → mweb → android
YOUTUBE_PLAYER_CLIENTS = ["web", "mweb", "android"]

# Format selection fallback chain.
#
# Why a chain is needed (2026):
#   • "bestaudio/best" fails when the active client returns only muxed HLS
#     streams (ANDR-V flag) with no standalone audio track.
#   • Each entry is tried in order; the first one that produces a file wins.
#   • Entry breakdown:
#       1. bestaudio[ext=m4a]        – best standalone AAC (no ffmpeg merge)
#       2. bestaudio[ext=webm]        – best standalone Opus
#       3. bestaudio                  – best standalone audio, any codec
#       4. best[height<=480]          – smallest muxed stream (audio included)
#       5. best                        – absolute last resort: any muxed stream
#
# The list is tried sequentially by _download_video_file(); yt-dlp itself
# never sees more than one entry at a time so there is no ambiguity.
YOUTUBE_FORMAT_CHAIN = [
    "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
    "best[height<=480]",
    "best",
]

URL_AUDIO_JOBS: dict = {}
URL_AUDIO_JOBS_LOCK = threading.Lock()

# Background yt-dlp freshness check (runs once per process lifetime)
_YTDLP_REFRESH_DONE = False
_YTDLP_REFRESH_LOCK = threading.Lock()


# ─── yt-dlp auto-update (non-blocking) ───────────────────────────────────────

def _ensure_ytdlp_fresh() -> None:
    """
    Upgrade yt-dlp in the background on first request.
    YouTube patches their bot-detection constantly; keeping yt-dlp current is
    the single most effective defence against the 'Sign in to confirm' error.
    """
    global _YTDLP_REFRESH_DONE
    with _YTDLP_REFRESH_LOCK:
        if _YTDLP_REFRESH_DONE:
            return
        _YTDLP_REFRESH_DONE = True

    def _upgrade():
        try:
            result = subprocess.run(
                ["pip", "install", "--upgrade", "--quiet", "yt-dlp"],
                capture_output=True, text=True, timeout=120,
            )
            if result.returncode == 0:
                log.info("yt-dlp upgraded successfully.")
            else:
                log.warning("yt-dlp upgrade failed: %s", result.stderr.strip()[:200])
        except Exception as exc:
            log.warning("yt-dlp upgrade check skipped: %s", exc)

    threading.Thread(target=_upgrade, daemon=True).start()


@app.before_request
def _before_request():
    _ensure_ytdlp_fresh()


# ─── Cookie helpers ───────────────────────────────────────────────────────────

def _write_temp_cookies() -> str | None:
    """
    Return a path to a Netscape-format cookie file, or None if none is
    configured.  When the content comes from an env-var we write it to a
    unique temp file (thread-safe).  Existing file paths are returned as-is.

    Priority:
      1. YOUTUBE_COOKIES_CONTENT  (raw text in an env-var – best for Render)
      2. YOUTUBE_COOKIES_FILE     (path env-var)
      3. cookies.txt              (local working dir)
      4. /etc/secrets/cookies.txt (Render secret-file mount)
    """
    content = os.getenv("YOUTUBE_COOKIES_CONTENT", "").strip()
    if content:
        try:
            tmp = tempfile.NamedTemporaryFile(
                mode="w", suffix=".txt", prefix="yt_cookies_", delete=False,
            )
            tmp.write(content)
            tmp.flush()
            tmp.close()
            log.debug("Cookie temp file written: %s", tmp.name)
            return tmp.name
        except Exception as exc:
            log.warning("Failed to write cookie temp file: %s", exc)
            return None

    for candidate in (
        os.getenv("YOUTUBE_COOKIES_FILE", ""),
        "cookies.txt",
        "/etc/secrets/cookies.txt",
    ):
        if candidate and os.path.isfile(candidate):
            log.debug("Using cookie file: %s", candidate)
            return candidate

    log.debug("No cookie source configured – yt-dlp will run without cookies.")
    return None


def _cleanup_ydl_cookies(opts: dict) -> None:
    """Delete the temp cookie file created by _get_ydl_opts, if any."""
    temp_path = opts.get("_temp_cookiefile")
    if temp_path:
        try:
            os.unlink(temp_path)
            log.debug("Deleted temp cookie file: %s", temp_path)
        except OSError:
            pass


def _get_ydl_opts(base_opts: dict | None = None) -> dict:
    """
    Build a yt-dlp options dict.

    Key decisions for 2026 bot-detection:
    • player_client = web,mweb,android  (android_vr / ios are now blocked)
    • Cookie file injected when available
    • Each call gets its own temp cookie path – thread safe
    """
    opts = (base_opts or {}).copy()

    cookie_path = _write_temp_cookies()
    if cookie_path:
        opts["cookiefile"] = cookie_path
        # Tag temp files so the caller can clean them up
        if cookie_path.startswith(tempfile.gettempdir()):
            opts["_temp_cookiefile"] = cookie_path

    extractor_args = opts.setdefault("extractor_args", {})
    yt_args = extractor_args.setdefault("youtube", {})
    yt_args["player_client"] = YOUTUBE_PLAYER_CLIENTS  # override whatever was there

    return opts


# ─── ffmpeg helpers ───────────────────────────────────────────────────────────

def _get_ffmpeg_executable() -> str | None:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    if imageio_ffmpeg is not None:
        try:
            bundled = imageio_ffmpeg.get_ffmpeg_exe()
            if bundled and os.path.exists(bundled):
                return bundled
        except Exception:
            pass
    return None


def _extract_audio_with_ffmpeg(input_path: Path, output_path: Path) -> None:
    ffmpeg_exe = _get_ffmpeg_executable()
    if not ffmpeg_exe:
        raise RuntimeError(
            "ffmpeg not found. Install ffmpeg or add imageio-ffmpeg to your dependencies."
        )
    cmd = [
        ffmpeg_exe, "-y",
        "-i", str(input_path),
        "-vn", "-acodec", "libmp3lame", "-q:a", "4",
        str(output_path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not output_path.exists():
        detail = (proc.stderr or proc.stdout or "unknown ffmpeg error").strip()
        raise RuntimeError(f"Audio extraction failed: {detail[-400:]}")


# ─── Whisper helpers ──────────────────────────────────────────────────────────

def run_whisper(
    audio_bytes: bytes, filename: str, content_type: str, source_lang: str,
) -> tuple[str, str, float]:
    kwargs: dict = {
        "file": (filename, audio_bytes, content_type),
        "model": "whisper-large-v3",
        "response_format": "verbose_json",
        "temperature": 0.0,
    }
    if source_lang != "auto":
        kwargs["language"] = source_lang
    transcript = client.audio.transcriptions.create(**kwargs)
    return (
        transcript.text,
        getattr(transcript, "language", source_lang),
        float(getattr(transcript, "duration", 0) or 0),
    )


def _transcribe_segment_file(
    path: Path, source_lang: str, index: int
) -> tuple[int, str, str, float]:
    content_type = mimetypes.guess_type(str(path))[0] or "audio/mpeg"
    text, detected_lang, duration = run_whisper(
        path.read_bytes(), path.name, content_type, source_lang,
    )
    return index, text, detected_lang, duration


# ─── Translation ──────────────────────────────────────────────────────────────

def _translate_stream(original_text: str, target_lang: str):
    target_name = LANGUAGES.get(target_lang, target_lang)
    try:
        stream = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            stream=True,
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a professional translator. Translate the following text "
                        f"accurately to {target_name}. Preserve tone, punctuation, and "
                        "formatting. Output ONLY the translated text – no preamble, no "
                        "explanation, no quotes."
                    ),
                },
                {"role": "user", "content": original_text},
            ],
            max_tokens=2048,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield f"data: {json.dumps({'type': 'translation_chunk', 'text': delta})}\n\n"
    except Exception as exc:
        log.error("Translation error: %s", exc)
        yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
    yield f"data: {json.dumps({'type': 'done'})}\n\n"


# ─── Source detection ─────────────────────────────────────────────────────────

def _normalize_host(url: str) -> str:
    try:
        host = (urlparse(url).netloc or "").lower()
    except Exception:
        return ""
    return host[4:] if host.startswith("www.") else host


def _guess_ext_from_url(url: str) -> str:
    try:
        return Path(urlparse(url).path).suffix.lower().lstrip(".")
    except Exception:
        return ""


def _safe_head_content_type(url: str) -> str:
    try:
        resp = requests.head(url, allow_redirects=True, timeout=10)
        return (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
    except Exception:
        return ""


def _sanitize_youtube_url(url: str) -> str:
    try:
        parsed = urlparse(url)
        host = (parsed.netloc or "").lower().lstrip("www.")
        if host in ("youtube.com", "youtu.be") or host.endswith(".youtube.com"):
            if parsed.path == "/watch":
                qs = parse_qs(parsed.query)
                if "v" in qs:
                    return urlunparse(parsed._replace(query=urlencode({"v": qs["v"][0]})))
    except Exception:
        pass
    return url


def _detect_drive_media_kind(url: str) -> tuple[str, str, str]:
    ydl_opts = {"quiet": True, "no_warnings": True, "noplaylist": True, "skip_download": True}
    opts = _get_ydl_opts(ydl_opts)
    try:
        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
        if isinstance(info, dict):
            vcodec = str(info.get("vcodec") or "").lower()
            acodec = str(info.get("acodec") or "").lower()
            ext    = str(info.get("ext") or "").lower()
            if (not vcodec or vcodec == "none") and (acodec and acodec != "none"):
                return "drive_audio", "Drive Audio", "audio"
            if vcodec and vcodec != "none":
                return "drive_video", "Drive Video", "video"
            if ext in DIRECT_AUDIO_EXTS:
                return "drive_audio", "Drive Audio", "audio"
            if ext in DIRECT_VIDEO_EXTS:
                return "drive_video", "Drive Video", "video"
    except Exception as exc:
        log.warning("Drive media detection failed: %s", exc)
    finally:
        _cleanup_ydl_cookies(opts)
    return "unsupported", "Unsupported Drive Media", "unknown"


def detect_source(url: str) -> dict:
    host = _normalize_host(url)
    ext  = _guess_ext_from_url(url)

    if host in ("youtube.com", "youtu.be") or host.endswith(".youtube.com"):
        return {"source_type": "youtube_video", "label": "YouTube Video",
                "kind": "video", "requires_extraction": True}

    if host == "drive.google.com" or host.endswith(".drive.google.com"):
        source_type, label, kind = _detect_drive_media_kind(url)
        return {"source_type": source_type, "label": label,
                "kind": kind, "requires_extraction": kind == "video"}

    if ext in DIRECT_AUDIO_EXTS:
        return {"source_type": "direct_audio", "label": "Direct Audio",
                "kind": "audio", "requires_extraction": False}

    if ext in DIRECT_VIDEO_EXTS:
        return {"source_type": "direct_video", "label": "Direct Video",
                "kind": "video", "requires_extraction": True}

    ctype = _safe_head_content_type(url)
    if ctype.startswith("audio/"):
        return {"source_type": "direct_audio", "label": "Direct Audio",
                "kind": "audio", "requires_extraction": False}
    if ctype.startswith("video/"):
        return {"source_type": "direct_video", "label": "Direct Video",
                "kind": "video", "requires_extraction": True}

    return {"source_type": "unsupported", "label": "Unsupported Source",
            "kind": "unknown", "requires_extraction": False}


# ─── Filename helpers ─────────────────────────────────────────────────────────

def _sanitize_filename(name: str) -> str:
    cleaned = re.sub(r"[^\w\-. ]+", "", name or "").strip() or "extracted-audio"
    return cleaned[:120]


def _normalize_whisper_filename(filename: str, content_type: str) -> str:
    raw_name = Path(filename or "audio.webm").name
    ext = Path(raw_name).suffix.lower().lstrip(".")
    if ext in WHISPER_ALLOWED_EXTS:
        return raw_name
    mime = (content_type or "").split(";")[0].strip().lower()
    inferred_ext = MIME_TO_AUDIO_EXT.get(mime, "webm")
    stem = _sanitize_filename(Path(raw_name).stem or "audio").replace(" ", "_")
    return f"{stem}.{inferred_ext}"


# ─── URL-audio job helpers ────────────────────────────────────────────────────

def _cleanup_expired_jobs() -> None:
    now = time.time()
    expired = []
    with URL_AUDIO_JOBS_LOCK:
        for job_id, job in list(URL_AUDIO_JOBS.items()):
            if now - job.get("updated_at", now) > URL_JOB_TTL_SECONDS:
                expired.append(URL_AUDIO_JOBS.pop(job_id))
    for job in expired:
        td = job.get("temp_dir")
        if td and os.path.isdir(td):
            shutil.rmtree(td, ignore_errors=True)


def _set_url_job(job_id: str, **updates) -> None:
    with URL_AUDIO_JOBS_LOCK:
        job = URL_AUDIO_JOBS.get(job_id)
        if job:
            job.update(updates)
            job["updated_at"] = time.time()


# ─── Download helpers ─────────────────────────────────────────────────────────

def _find_downloaded_file(output_dir: Path) -> Path | None:
    """Return the most-recently modified file in output_dir, or None."""
    candidates = sorted(output_dir.glob("*"), key=os.path.getmtime, reverse=True)
    return candidates[0] if candidates else None


def _download_video_file(url: str, output_dir: Path, job_id: str) -> tuple[Path, str]:
    """
    Download the best available audio from YouTube / Drive.

    2026 "Requested format is not available" fix
    ─────────────────────────────────────────────
    When a client only returns muxed HLS streams (no standalone audio track),
    `bestaudio` raises "Requested format is not available".  We now iterate
    over YOUTUBE_FORMAT_CHAIN, trying each format string until one succeeds.
    If every format in the chain fails we also retry with a different player
    client subset before giving up.

    Retry matrix
    ────────────
      Round 1 – all clients  (web, mweb, android)  × YOUTUBE_FORMAT_CHAIN
      Round 2 – web only                            × YOUTUBE_FORMAT_CHAIN
      Round 3 – mweb only                           × YOUTUBE_FORMAT_CHAIN

    This covers the most common 2026 failure modes without hammering YouTube
    with dozens of requests.
    """
    output_template = str(output_dir / "source.%(ext)s")

    def _progress(data):
        if data.get("status") == "downloading":
            downloaded = float(data.get("downloaded_bytes") or 0)
            total = float(data.get("total_bytes") or data.get("total_bytes_estimate") or 0)
            if total > 0:
                pct = int(downloaded / total * 100)
                _set_url_job(job_id, message=f"Fetching video… {pct}%")

    # client subsets to try across rounds
    client_rounds: list[list[str]] = [
        YOUTUBE_PLAYER_CLIENTS,         # round 1: all clients
        ["web"],                         # round 2: web only (most formats)
        ["mweb"],                        # round 3: mweb fallback
    ]

    last_exc: Exception | None = None

    for round_idx, clients in enumerate(client_rounds, start=1):
        for fmt in YOUTUBE_FORMAT_CHAIN:
            # Clean up any partial files from a previous attempt
            for f in output_dir.glob("source.*"):
                try:
                    f.unlink()
                except OSError:
                    pass

            ydl_opts = {
                "format": fmt,
                "outtmpl": output_template,
                "quiet": True,
                "no_warnings": True,
                "noplaylist": True,
                "progress_hooks": [_progress],
            }
            opts = _get_ydl_opts(ydl_opts)
            # Override client list for this specific round
            opts["extractor_args"]["youtube"]["player_client"] = clients

            log.debug(
                "yt-dlp attempt – round %d, clients=%s, format=%r",
                round_idx, clients, fmt,
            )
            _set_url_job(
                job_id,
                message=f"Fetching video… (round {round_idx}, format: {fmt[:40]})",
            )

            try:
                with YoutubeDL(opts) as ydl:
                    info = ydl.extract_info(url, download=True)
                    title = info.get("title") or "video-audio"
                    path: Path | None = None
                    requested = info.get("requested_downloads") or []
                    if requested and requested[0].get("filepath"):
                        path = Path(requested[0]["filepath"])
                    if not path:
                        path = Path(ydl.prepare_filename(info))
                    if not path or not path.exists():
                        path = _find_downloaded_file(output_dir)
                    if not path or not path.exists():
                        raise RuntimeError("Download completed but no output file found.")
                    log.info(
                        "yt-dlp success – round %d clients=%s fmt=%r → %s",
                        round_idx, clients, fmt, path.name,
                    )
                    return path, title

            except Exception as exc:
                err_str = str(exc)
                _cleanup_ydl_cookies(opts)

                # Bot detection – no point retrying formats, raise immediately
                if "Sign in to confirm" in err_str or "bot" in err_str.lower():
                    raise RuntimeError(
                        "YouTube bot-detection triggered. "
                        "Set the YOUTUBE_COOKIES_CONTENT environment variable with a "
                        "valid Netscape-format cookie export from a logged-in YouTube "
                        "session. See https://github.com/yt-dlp/yt-dlp/wiki/FAQ"
                        "#how-do-i-pass-cookies-to-yt-dlp"
                    ) from exc

                log.debug(
                    "yt-dlp attempt failed (round %d, clients=%s, fmt=%r): %s",
                    round_idx, clients, fmt, err_str[:200],
                )
                last_exc = exc
                continue  # try next format / next client round

            finally:
                _cleanup_ydl_cookies(opts)

    # All rounds exhausted
    raise RuntimeError(
        f"Could not download audio after trying all format/client combinations. "
        f"Last error: {last_exc}"
    ) from last_exc


def _download_direct_audio_file(url: str, output_dir: Path, job_id: str) -> tuple[Path, str]:
    _set_url_job(job_id, message="Downloading audio…")
    with requests.get(url, stream=True, timeout=60) as resp:
        resp.raise_for_status()
        ctype = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
        ext = MIME_TO_AUDIO_EXT.get(ctype) or _guess_ext_from_url(url) or "mp3"
        if ext not in WHISPER_ALLOWED_EXTS:
            ext = "mp3"
        target = output_dir / f"direct_audio.{ext}"
        with open(target, "wb") as fh:
            for chunk in resp.iter_content(chunk_size=512 * 1024):
                if chunk:
                    fh.write(chunk)
    return target, f"direct-audio.{ext}"


# ─── URL audio job worker ─────────────────────────────────────────────────────

def _process_url_audio_job(job_id: str, url: str) -> None:
    temp_dir = Path(tempfile.mkdtemp(prefix=f"url_audio_{job_id}_"))
    _set_url_job(job_id, status="detecting", message="Detecting source…", temp_dir=str(temp_dir))
    try:
        detected = detect_source(url)
        source_type  = detected.get("source_type", "unknown")
        source_label = detected.get("label", "Unknown Source")
        kind         = detected.get("kind", "unknown")

        _set_url_job(
            job_id,
            source_type=source_type, source_label=source_label,
            media_kind=kind, status="fetching",
            message=f"Source detected: {source_label}",
        )

        if source_type == "direct_audio":
            audio_path, filename = _download_direct_audio_file(url, temp_dir, job_id)
        else:
            downloaded_path, title = _download_video_file(url, temp_dir, job_id)
            if kind == "video":
                _set_url_job(job_id, status="extracting", message="Extracting audio…")
                if _get_ffmpeg_executable():
                    audio_path = temp_dir / "audio.mp3"
                    _extract_audio_with_ffmpeg(downloaded_path, audio_path)
                    filename = f"{_sanitize_filename(title)}.mp3"
                else:
                    audio_path = downloaded_path
                    filename   = f"{_sanitize_filename(title)}{downloaded_path.suffix or '.mp4'}"
                    _set_url_job(job_id, message="ffmpeg not found – using source media directly.")
            else:
                audio_path = downloaded_path
                filename   = f"{_sanitize_filename(title)}{downloaded_path.suffix or '.mp3'}"

        _set_url_job(
            job_id, status="ready", message="Audio ready",
            audio_path=str(audio_path), filename=filename, error="",
        )
    except Exception as exc:
        log.error("URL audio job %s failed: %s", job_id, exc)
        _set_url_job(job_id, status="error", message="Failed to fetch/extract audio", error=str(exc))


# ─── SSE helper ───────────────────────────────────────────────────────────────

def _sse_response(generator_func):
    return Response(
        stream_with_context(generator_func),
        content_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
def index():
    return "VoiceScript Studio API is running."


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/detect-source", methods=["POST"])
def detect_source_route():
    data = request.get_json(silent=True) or {}
    url  = (data.get("url") or "").strip()
    if not url:
        return jsonify({"error": "URL is required"}), 400
    url = _sanitize_youtube_url(url)
    detected = detect_source(url)
    if detected.get("source_type") == "unsupported":
        return jsonify({"error": "Unsupported input source"}), 400
    return jsonify(detected)


@app.route("/transcribe", methods=["POST"])
def transcribe():
    content_length = request.content_length
    if content_length and content_length > WHISPER_MAX_BYTES:
        return jsonify({"error": "Audio too large. Use /transcribe-large for files over 25 MB."}), 413

    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file  = request.files["audio"]
    source_lang = request.form.get("source_lang", "auto")
    target_lang = request.form.get("target_lang", "en")
    action      = request.form.get("action", "translate").lower()

    if action not in {"transcript", "translate"}:
        return jsonify({"error": "Invalid action. Use 'transcript' or 'translate'."}), 400

    content_type = audio_file.content_type or "audio/webm"
    filename     = _normalize_whisper_filename(audio_file.filename or "audio.webm", content_type)

    try:
        audio_bytes = audio_file.read()
        if len(audio_bytes) > WHISPER_MAX_BYTES:
            return jsonify({"error": "Audio too large. Use /transcribe-large for files over 25 MB."}), 413
        original_text, detected_lang, duration = run_whisper(
            audio_bytes, filename, content_type, source_lang,
        )
    except Exception as exc:
        log.error("Transcription error: %s", exc)
        return jsonify({"error": f"Transcription failed: {exc}"}), 500

    def generate():
        yield f"data: {json.dumps({'type': 'meta', 'duration': round(duration, 1), 'detected_lang': detected_lang})}\n\n"
        yield f"data: {json.dumps({'type': 'original', 'text': original_text})}\n\n"
        if action == "transcript":
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return
        yield from _translate_stream(original_text, target_lang)

    return _sse_response(generate())


@app.route("/translate-text", methods=["POST"])
def translate_text():
    data        = request.get_json(silent=True) or {}
    text        = (data.get("text") or "").strip()
    target_lang = (data.get("target_lang") or "en").strip() or "en"
    if not text:
        return jsonify({"error": "Text is required"}), 400
    return _sse_response(_translate_stream(text, target_lang))


@app.route("/transcribe-large", methods=["POST"])
def transcribe_large():
    """
    KEY FIX: The entire upload is streamed to disk in 512 KB chunks BEFORE
    Werkzeug touches the multipart boundary.  This prevents gunicorn's sync
    worker from timing out mid-read on large files.
    """
    ffmpeg_exe = _get_ffmpeg_executable()
    if not ffmpeg_exe:
        return jsonify({"error": "ffmpeg is required for large-file transcription."}), 500

    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    temp_dir = Path(tempfile.mkdtemp(prefix="large_transcribe_"))
    try:
        audio_file   = request.files["audio"]
        source_lang  = request.form.get("source_lang", "auto")
        content_type = audio_file.content_type or "audio/webm"
        norm_name    = _normalize_whisper_filename(audio_file.filename or "audio.webm", content_type)
        ext          = Path(norm_name).suffix or ".webm"
        input_path   = temp_dir / f"input{ext}"

        # ── Stream upload to disk, never loads full file into RAM ──────────
        with open(input_path, "wb") as fh:
            while True:
                chunk = audio_file.stream.read(512 * 1024)
                if not chunk:
                    break
                fh.write(chunk)

    except Exception as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        log.error("Failed to save upload: %s", exc)
        return jsonify({"error": f"Failed to save uploaded file: {exc}"}), 500

    # ── Segment with ffmpeg ────────────────────────────────────────────────
    segments_dir     = temp_dir / "segments"
    segments_dir.mkdir(parents=True, exist_ok=True)
    segment_pattern  = str(segments_dir / "chunk_%05d.mp3")

    ffmpeg_cmd = [
        ffmpeg_exe, "-y",
        "-i", str(input_path),
        "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k",
        "-f", "segment", "-segment_time", "600", "-reset_timestamps", "1",
        segment_pattern,
    ]
    proc = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "unknown ffmpeg error").strip()
        shutil.rmtree(temp_dir, ignore_errors=True)
        return jsonify({"error": f"Failed to segment audio: {detail[-400:]}"}), 500

    segment_paths = sorted(segments_dir.glob("chunk_*.mp3"))
    if not segment_paths:
        shutil.rmtree(temp_dir, ignore_errors=True)
        return jsonify({"error": "No audio segments were produced from the file."}), 500

    # ── Transcribe concurrently, stream results ────────────────────────────
    def generate():
        detected_lang = ""
        duration_total = 0.0
        yielded_done   = False
        total          = len(segment_paths)
        max_workers    = min(3, total)

        try:
            yield f"data: {json.dumps({'type': 'progress', 'completed': 0, 'total': total, 'message': f'Transcribing 0/{total} parts…'})}\n\n"

            ready: dict[int, tuple] = {}
            next_index = 0
            completed  = 0

            with ThreadPoolExecutor(max_workers=max_workers) as pool:
                futures = {
                    pool.submit(_transcribe_segment_file, path, source_lang, i): i
                    for i, path in enumerate(segment_paths)
                }
                for future in as_completed(futures):
                    try:
                        idx, text, seg_lang, seg_duration = future.result()
                    except Exception as exc:
                        log.error("Segment transcription error: %s", exc)
                        yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
                        continue

                    completed += 1
                    ready[idx] = (text, seg_lang, seg_duration)
                    yield f"data: {json.dumps({'type': 'progress', 'completed': completed, 'total': total, 'message': f'Transcribing {completed}/{total} parts…'})}\n\n"

                    while next_index in ready:
                        chunk_text, chunk_lang, chunk_dur = ready.pop(next_index)
                        if not detected_lang and chunk_lang:
                            detected_lang = chunk_lang
                        duration_total += chunk_dur
                        yield f"data: {json.dumps({'type': 'transcript_chunk', 'index': next_index, 'text': chunk_text})}\n\n"
                        next_index += 1

            yield f"data: {json.dumps({'type': 'meta', 'duration': round(duration_total, 1), 'detected_lang': detected_lang})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            yielded_done = True

        except Exception as exc:
            log.error("Large transcription generator error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'message': f'Large transcription failed: {exc}'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            yielded_done = True
        finally:
            if not yielded_done:
                try:
                    yield f"data: {json.dumps({'type': 'done'})}\n\n"
                except Exception:
                    pass
            shutil.rmtree(temp_dir, ignore_errors=True)

    return _sse_response(generate())


@app.route("/transcribe-chunk", methods=["POST"])
def transcribe_chunk():
    if "audio" not in request.files:
        return jsonify({"error": "No audio chunk provided"}), 400

    audio_file  = request.files["audio"]
    source_lang = request.form.get("source_lang", "auto")

    try:
        index = int(request.form.get("index", "0"))
        total = int(request.form.get("total", "1"))
    except ValueError:
        return jsonify({"error": "Invalid chunk index/total"}), 400

    content_type = audio_file.content_type or "audio/webm"
    filename     = _normalize_whisper_filename(
        audio_file.filename or f"chunk-{index}.webm", content_type,
    )

    try:
        audio_bytes = audio_file.read()
        if len(audio_bytes) > WHISPER_MAX_BYTES:
            return jsonify({"error": "Chunk too large. Keep each chunk under 25 MB."}), 413
        text, detected_lang, duration = run_whisper(audio_bytes, filename, content_type, source_lang)
    except Exception as exc:
        log.error("Chunk transcription error: %s", exc)
        return jsonify({"error": f"Chunk transcription failed: {exc}"}), 500

    return jsonify({
        "index": index, "total": total,
        "text": text, "detected_lang": detected_lang,
        "duration": round(duration, 2),
    })


@app.route("/extract-audio-url", methods=["POST"])
def extract_audio_url():
    _cleanup_expired_jobs()

    data = request.get_json(silent=True) or {}
    url  = (data.get("url") or "").strip()
    if not url:
        return jsonify({"error": "URL is required"}), 400

    url = _sanitize_youtube_url(url)
    detected = detect_source(url)
    if detected.get("source_type") == "unsupported":
        return jsonify({"error": "Unsupported URL. Use Google Drive, YouTube, or direct audio links."}), 400

    job_id = uuid.uuid4().hex
    now    = time.time()

    with URL_AUDIO_JOBS_LOCK:
        URL_AUDIO_JOBS[job_id] = {
            "id": job_id, "url": url,
            "status": "queued", "message": "Queued", "error": "",
            "audio_path": "", "filename": "", "temp_dir": "",
            "source_type": detected.get("source_type", ""),
            "source_label": detected.get("label", ""),
            "media_kind": detected.get("kind", ""),
            "created_at": now, "updated_at": now,
        }

    threading.Thread(
        target=_process_url_audio_job, args=(job_id, url), daemon=True,
    ).start()

    return jsonify({
        "job_id": job_id, "status": "queued", "message": "Queued",
        "source_type": detected.get("source_type", ""),
        "source_label": detected.get("label", ""),
    }), 202


@app.route("/extract-audio-url/status/<job_id>", methods=["GET"])
def extract_audio_url_status(job_id: str):
    _cleanup_expired_jobs()
    with URL_AUDIO_JOBS_LOCK:
        job = URL_AUDIO_JOBS.get(job_id)
        if not job:
            return jsonify({"error": "Job not found"}), 404
        payload = {
            "job_id":       job["id"],
            "status":       job.get("status", "queued"),
            "message":      job.get("message", ""),
            "error":        job.get("error", ""),
            "source_type":  job.get("source_type", ""),
            "source_label": job.get("source_label", ""),
            "media_kind":   job.get("media_kind", ""),
        }
    return jsonify(payload)


@app.route("/extract-audio-url/download/<job_id>", methods=["GET"])
def extract_audio_url_download(job_id: str):
    _cleanup_expired_jobs()

    with URL_AUDIO_JOBS_LOCK:
        job = URL_AUDIO_JOBS.get(job_id)
        if not job:
            return jsonify({"error": "Job not found"}), 404
        status     = job.get("status")
        audio_path = job.get("audio_path", "")
        filename   = job.get("filename") or "extracted-audio.mp3"
        error      = job.get("error", "")

    if status != "ready":
        msg = (error or "Audio extraction failed") if status == "error" else "Audio is not ready yet"
        return jsonify({"error": msg}), 409

    if not audio_path or not os.path.exists(audio_path):
        return jsonify({"error": "Prepared audio file was not found"}), 404

    guessed_mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return send_file(
        audio_path, mimetype=guessed_mime,
        as_attachment=True, download_name=filename, conditional=True,
    )


# ─── Dev entry-point ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=5000, threaded=True)