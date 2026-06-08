import os
import json
import re
import shutil
import subprocess
import tempfile
import threading
import time
import mimetypes
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from uuid import uuid4
from flask import Flask, request, Response, stream_with_context, jsonify, send_file
from flask_cors import CORS
from groq import Groq
from dotenv import load_dotenv
from yt_dlp import YoutubeDL
try:
    import imageio_ffmpeg
except Exception:
    imageio_ffmpeg = None

load_dotenv()

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 1288490188  # 1.2 GB
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173", "https://voice-script-studio.vercel.app", "https://voicescript-studio.vercel.app"])

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "gu": "Gujarati",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "ja": "Japanese",
    "zh": "Chinese (Mandarin)",
    "ar": "Arabic",
    "pt": "Portuguese",
    "ru": "Russian",
    "ko": "Korean",
    "it": "Italian",
}

WHISPER_MAX_BYTES = 25 * 1024 * 1024
URL_JOB_TTL_SECONDS = 60 * 60
URL_AUDIO_JOBS = {}
URL_AUDIO_JOBS_LOCK = threading.Lock()
SUPPORTED_VIDEO_HOSTS = ("youtube.com", "youtu.be", "drive.google.com")
WHISPER_ALLOWED_EXTS = {"flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "opus", "wav", "webm"}
DIRECT_AUDIO_EXTS = {"flac", "mp3", "m4a", "ogg", "opus", "wav", "webm", "aac", "amr"}
DIRECT_VIDEO_EXTS = {"mp4", "mov", "mkv", "avi", "webm", "mpeg"}
MIME_TO_AUDIO_EXT = {
    "audio/flac": "flac",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "mp4",
    "video/mp4": "mp4",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/webm": "webm",
    "video/webm": "webm",
}


def run_whisper(audio_bytes, filename, content_type, source_lang):
    whisper_kwargs = {
        "file": (filename, audio_bytes, content_type),
        "model": "whisper-large-v3",
        "response_format": "verbose_json",
        "temperature": 0.0,
    }
    if source_lang != "auto":
        whisper_kwargs["language"] = source_lang

    transcript = client.audio.transcriptions.create(**whisper_kwargs)
    return (
        transcript.text,
        getattr(transcript, "language", source_lang),
        getattr(transcript, "duration", 0),
    )


def _is_supported_video_url(url):
    try:
        host = (urlparse(url).netloc or "").lower()
    except Exception:
        return False
    if host.startswith("www."):
        host = host[4:]
    return any(host == h or host.endswith(f".{h}") for h in SUPPORTED_VIDEO_HOSTS)


def _normalize_host(url):
    try:
        host = (urlparse(url).netloc or "").lower()
    except Exception:
        return ""
    if host.startswith("www."):
        host = host[4:]
    return host


def _guess_ext_from_url(url):
    try:
        name = Path(urlparse(url).path).name
    except Exception:
        return ""
    return Path(name).suffix.lower().lstrip(".")


def _safe_head_content_type(url):
    try:
        resp = requests.head(url, allow_redirects=True, timeout=10)
        ctype = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
        return ctype
    except Exception:
        return ""


def _is_audio_content_type(content_type):
    return bool(content_type and content_type.startswith("audio/"))


def _is_video_content_type(content_type):
    return bool(content_type and content_type.startswith("video/"))


def _get_ydl_opts(base_opts=None):
    opts = base_opts.copy() if base_opts else {}
    
    # Try multiple common paths for the cookies file on Render
    # 1. Check for cookies content in an environment variable (easiest for Render env vars)
    cookies_content = os.getenv("YOUTUBE_COOKIES_CONTENT")
    if cookies_content:
        temp_cookies_path = "/tmp/youtube_cookies.txt"
        with open(temp_cookies_path, "w") as f:
            f.write(cookies_content)
        opts["cookiefile"] = temp_cookies_path
    # 2. Check for cookies file via environment variable, or default to cookies.txt in the backend dir
    else:
        cookies_file = os.getenv("YOUTUBE_COOKIES_FILE")
        if cookies_file and os.path.exists(cookies_file):
            opts["cookiefile"] = cookies_file
        elif os.path.exists("cookies.txt"):
            opts["cookiefile"] = "cookies.txt"
        elif os.path.exists("/etc/secrets/cookies.txt"):
            opts["cookiefile"] = "/etc/secrets/cookies.txt"
        
    # We previously set player_client to ["android", "ios"] to bypass bot detection, 
    # but this now causes "Requested format is not available" due to SABR/PO token restrictions.
    # We now let yt-dlp use its default client array which includes working fallbacks (e.g. android_vr).
        
    return opts


def _detect_drive_media_kind(url):
    """
    Best effort detection for Google Drive links.
    """
    try:
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "skip_download": True,
        }
        with YoutubeDL(_get_ydl_opts(ydl_opts)) as ydl:
            info = ydl.extract_info(url, download=False)
        if isinstance(info, dict):
            vcodec = str(info.get("vcodec") or "").lower()
            acodec = str(info.get("acodec") or "").lower()
            ext = str(info.get("ext") or "").lower()

            if (vcodec == "none" or not vcodec) and (acodec and acodec != "none"):
                return "drive_audio", "Drive Audio", "audio"
            if vcodec and vcodec != "none":
                return "drive_video", "Drive Video", "video"
            if ext in DIRECT_AUDIO_EXTS:
                return "drive_audio", "Drive Audio", "audio"
    except Exception:
        pass
    return "drive_video", "Drive Video", "video"


def _sanitize_youtube_url(url):
    try:
        parsed = urlparse(url)
        host = (parsed.netloc or "").lower()
        if host.startswith("www."):
            host = host[4:]
        
        if host in ("youtube.com", "youtu.be") or host.endswith(".youtube.com"):
            if parsed.path == "/watch":
                qs = parse_qs(parsed.query)
                if "v" in qs:
                    new_query = urlencode({"v": qs["v"][0]})
                    parsed = parsed._replace(query=new_query)
                    return urlunparse(parsed)
    except Exception:
        pass
    return url


def detect_source(url):
    host = _normalize_host(url)
    ext = _guess_ext_from_url(url)

    if host in ("youtube.com", "youtu.be") or host.endswith(".youtube.com"):
        return {
            "source_type": "youtube_video",
            "label": "YouTube Video",
            "kind": "video",
            "requires_extraction": True,
        }

    if host == "drive.google.com" or host.endswith(".drive.google.com"):
        source_type, label, kind = _detect_drive_media_kind(url)
        return {
            "source_type": source_type,
            "label": label,
            "kind": kind,
            "requires_extraction": kind == "video",
        }

    if ext in DIRECT_AUDIO_EXTS:
        return {
            "source_type": "direct_audio",
            "label": "Direct Audio",
            "kind": "audio",
            "requires_extraction": False,
        }

    if ext in DIRECT_VIDEO_EXTS:
        return {
            "source_type": "direct_video",
            "label": "Direct Video",
            "kind": "video",
            "requires_extraction": True,
        }

    ctype = _safe_head_content_type(url)
    if _is_audio_content_type(ctype):
        return {
            "source_type": "direct_audio",
            "label": "Direct Audio",
            "kind": "audio",
            "requires_extraction": False,
        }
    if _is_video_content_type(ctype):
        return {
            "source_type": "direct_video",
            "label": "Direct Video",
            "kind": "video",
            "requires_extraction": True,
        }

    return {
        "source_type": "unsupported",
        "label": "Unsupported Source",
        "kind": "unknown",
        "requires_extraction": False,
    }


def _sanitize_filename(name):
    cleaned = re.sub(r"[^\w\-. ]+", "", name or "").strip()
    if not cleaned:
        cleaned = "extracted-audio"
    return cleaned[:120]


def _normalize_whisper_filename(filename, content_type):
    raw_name = Path(filename or "audio.webm").name
    ext = Path(raw_name).suffix.lower().lstrip(".")
    if ext in WHISPER_ALLOWED_EXTS:
        return raw_name

    mime = (content_type or "").split(";")[0].strip().lower()
    inferred_ext = MIME_TO_AUDIO_EXT.get(mime, "webm")
    stem = Path(raw_name).stem or "audio"
    safe_stem = _sanitize_filename(stem).replace(" ", "_")
    return f"{safe_stem}.{inferred_ext}"


def _transcribe_segment_file(path, source_lang, index):
    content_type = mimetypes.guess_type(str(path))[0] or "audio/mpeg"
    with open(path, "rb") as f:
        audio_bytes = f.read()
    text, detected_lang, duration = run_whisper(
        audio_bytes, Path(path).name, content_type, source_lang
    )
    return index, text, detected_lang, duration


def _translate_stream(original_text, target_lang):
    target_name = LANGUAGES.get(target_lang, target_lang)
    try:
        stream = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            stream=True,
            messages=[
                {
                    "role": "system",
                    "content": (
                        f"You are a professional translator. Translate the following text accurately to {target_name}. "
                        "Preserve the tone, punctuation, and formatting. "
                        "Output ONLY the translated text - no preamble, no explanation, no quotes."
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
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"


def _get_ffmpeg_executable():
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg
    if imageio_ffmpeg is not None:
        try:
            bundled_ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
            if bundled_ffmpeg and os.path.exists(bundled_ffmpeg):
                return bundled_ffmpeg
        except Exception:
            pass
    return None


def _cleanup_expired_jobs():
    now = time.time()
    to_delete = []

    with URL_AUDIO_JOBS_LOCK:
        for job_id, job in URL_AUDIO_JOBS.items():
            updated_at = job.get("updated_at", now)
            if now - updated_at > URL_JOB_TTL_SECONDS:
                to_delete.append((job_id, job))

        for job_id, _ in to_delete:
            URL_AUDIO_JOBS.pop(job_id, None)

    for _, job in to_delete:
        temp_dir = job.get("temp_dir")
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)


def _set_url_job(job_id, **updates):
    with URL_AUDIO_JOBS_LOCK:
        job = URL_AUDIO_JOBS.get(job_id)
        if not job:
            return
        job.update(updates)
        job["updated_at"] = time.time()


def _extract_audio_with_ffmpeg(input_path, output_path):
    ffmpeg_exe = _get_ffmpeg_executable()
    if not ffmpeg_exe:
        raise RuntimeError("ffmpeg not found. Install ffmpeg or add imageio-ffmpeg dependency.")

    cmd = [
        ffmpeg_exe,
        "-y",
        "-i",
        str(input_path),
        "-vn",
        "-acodec",
        "libmp3lame",
        "-q:a",
        "4",
        str(output_path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not output_path.exists():
        detail = (proc.stderr or proc.stdout or "unknown ffmpeg error").strip()
        raise RuntimeError(f"Audio extraction failed: {detail[-300:]}")


def _download_video_file(url, output_dir, job_id):
    output_template = str(output_dir / "source.%(ext)s")

    def progress_hook(data):
        if data.get("status") == "downloading":
            downloaded = float(data.get("downloaded_bytes") or 0)
            total = float(data.get("total_bytes") or data.get("total_bytes_estimate") or 0)
            if total > 0:
                pct = int((downloaded / total) * 100)
                _set_url_job(job_id, message=f"Fetching video... {pct}%")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "progress_hooks": [progress_hook],
    }

    with YoutubeDL(_get_ydl_opts(ydl_opts)) as ydl:
        info = ydl.extract_info(url, download=True)
        title = info.get("title") or "video-audio"
        path = None
        requested = info.get("requested_downloads") or []
        if requested and requested[0].get("filepath"):
            path = Path(requested[0]["filepath"])
        if not path:
            path = Path(ydl.prepare_filename(info))
        if not path.exists():
            candidates = sorted(output_dir.glob("*"), key=os.path.getmtime, reverse=True)
            if not candidates:
                raise RuntimeError("Video download completed but no output file was found.")
            path = candidates[0]
        return path, title


def _download_direct_audio_file(url, output_dir, job_id):
    target_path = output_dir / "direct_audio"
    _set_url_job(job_id, message="Downloading audio...")

    with requests.get(url, stream=True, timeout=60) as resp:
        resp.raise_for_status()
        content_type = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
        ext = MIME_TO_AUDIO_EXT.get(content_type) or _guess_ext_from_url(url) or "mp3"
        if ext not in WHISPER_ALLOWED_EXTS:
            ext = "mp3"
        target_path = output_dir / f"direct_audio.{ext}"
        with open(target_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=1024 * 512):
                if chunk:
                    f.write(chunk)
    return target_path, f"direct-audio.{target_path.suffix.lstrip('.')}"


def _process_url_audio_job(job_id, url):
    temp_dir = Path(tempfile.mkdtemp(prefix=f"url_audio_{job_id}_"))
    _set_url_job(job_id, status="detecting", message="Detecting source...", temp_dir=str(temp_dir))

    try:
        detected = detect_source(url)
        source_label = detected.get("label", "Unknown Source")
        source_type = detected.get("source_type", "unknown")
        kind = detected.get("kind", "unknown")

        _set_url_job(
            job_id,
            source_type=source_type,
            source_label=source_label,
            media_kind=kind,
            status="fetching",
            message=f"Source detected: {source_label}",
        )

        if source_type == "direct_audio":
            audio_path, filename = _download_direct_audio_file(url, temp_dir, job_id)
        else:
            downloaded_path, title = _download_video_file(url, temp_dir, job_id)
            _set_url_job(job_id, status="extracting", message="Extracting audio...")

            if _get_ffmpeg_executable():
                audio_path = temp_dir / "audio.mp3"
                _extract_audio_with_ffmpeg(downloaded_path, audio_path)
                filename = f"{_sanitize_filename(title)}.mp3"
            else:
                # Fallback when ffmpeg is unavailable: keep source media and let Whisper transcribe it directly.
                audio_path = downloaded_path
                ext = downloaded_path.suffix or ".mp4"
                filename = f"{_sanitize_filename(title)}{ext}"
                _set_url_job(job_id, message="ffmpeg not found: using source media directly.")

        _set_url_job(
            job_id,
            status="ready",
            message="Audio ready",
            audio_path=str(audio_path),
            filename=filename,
            error="",
        )
    except Exception as e:
        _set_url_job(job_id, status="error", message="Failed to fetch/extract audio", error=str(e))


@app.route("/", methods=["GET"])
def index():
    return "VoiceScript Studio API is running."


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/detect-source", methods=["POST"])
def detect_source_route():
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    if not url:
        return jsonify({"error": "URL is required"}), 400

    url = _sanitize_youtube_url(url)

    detected = detect_source(url)
    if detected.get("source_type") == "unsupported":
        return jsonify({"error": "Unsupported input source"}), 400
    return jsonify(detected)


@app.route("/transcribe", methods=["POST"])
def transcribe():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["audio"]
    source_lang = request.form.get("source_lang", "auto")
    target_lang = request.form.get("target_lang", "en")
    action = request.form.get("action", "translate").lower()
    content_type = audio_file.content_type or "audio/webm"
    filename = _normalize_whisper_filename(audio_file.filename or "audio.webm", content_type)

    if action not in {"transcript", "translate"}:
        return jsonify({"error": "Invalid action. Use 'transcript' or 'translate'."}), 400

    # Groq Whisper supports: mp3, mp4, mpeg, mpga, m4a, wav, webm
    # Max file size for Groq Whisper is 25MB per request
    if request.content_length and request.content_length > WHISPER_MAX_BYTES:
        return jsonify(
            {
                "error": "Audio too large for single request. Use chunked transcript mode for large files."
            }
        ), 413

    try:
        audio_bytes = audio_file.read()
        if len(audio_bytes) > WHISPER_MAX_BYTES:
            return jsonify(
                {
                    "error": "Audio too large for single request. Use chunked transcript mode for large files."
                }
            ), 413

        original_text, detected_lang, duration = run_whisper(
            audio_bytes, filename, content_type, source_lang
        )

    except Exception as e:
        return jsonify({"error": f"Transcription failed: {str(e)}"}), 500

    def generate():
        yield f"data: {json.dumps({'type': 'meta', 'duration': round(float(duration or 0), 1), 'detected_lang': detected_lang})}\n\n"
        if action == "transcript":
            yield f"data: {json.dumps({'type': 'original', 'text': original_text})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        yield f"data: {json.dumps({'type': 'original', 'text': original_text})}\n\n"
        yield from _translate_stream(original_text, target_lang)

    return Response(
        stream_with_context(generate()),
        content_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.route("/translate-text", methods=["POST"])
def translate_text():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    target_lang = (data.get("target_lang") or "en").strip() or "en"
    if not text:
        return jsonify({"error": "Text is required"}), 400

    def generate():
        yield from _translate_stream(text, target_lang)

    return Response(
        stream_with_context(generate()),
        content_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.route("/transcribe-large", methods=["POST"])
def transcribe_large():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    ffmpeg_exe = _get_ffmpeg_executable()
    if not ffmpeg_exe:
        return jsonify(
            {
                "error": "ffmpeg is required for large-file transcription. Install ffmpeg or install backend dependency imageio-ffmpeg."
            }
        ), 500

    audio_file = request.files["audio"]
    source_lang = request.form.get("source_lang", "auto")
    content_type = audio_file.content_type or "audio/webm"
    normalized_name = _normalize_whisper_filename(
        audio_file.filename or "audio.webm", content_type
    )

    temp_dir = Path(tempfile.mkdtemp(prefix="large_transcribe_"))
    input_path = temp_dir / f"input{Path(normalized_name).suffix or '.webm'}"
    segments_dir = temp_dir / "segments"
    segments_dir.mkdir(parents=True, exist_ok=True)

    try:
        audio_file.save(input_path)

        segment_pattern = str(segments_dir / "chunk_%05d.mp3")
        ffmpeg_cmd = [
            ffmpeg_exe,
            "-y",
            "-i",
            str(input_path),
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-b:a",
            "64k",
            "-f",
            "segment",
            "-segment_time",
            "600",
            "-reset_timestamps",
            "1",
            segment_pattern,
        ]
        proc = subprocess.run(ffmpeg_cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            detail = (proc.stderr or proc.stdout or "unknown ffmpeg error").strip()
            shutil.rmtree(temp_dir, ignore_errors=True)
            return jsonify({"error": f"Failed to segment audio: {detail[-300:]}"}), 500

        segment_paths = sorted(segments_dir.glob("chunk_*.mp3"))
        if not segment_paths:
            shutil.rmtree(temp_dir, ignore_errors=True)
            return jsonify({"error": "No audio segments were produced from the file."}), 500
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        return jsonify({"error": f"Failed to prepare large transcription: {str(e)}"}), 500

    def generate():
        detected_lang = ""
        duration_total = 0.0
        total = len(segment_paths)
        yielded_done = False

        try:
            yield f"data: {json.dumps({'type': 'progress', 'completed': 0, 'total': total, 'message': f'Transcribing 0/{total} parts...'})}\n\n"

            ready = {}
            next_index = 0
            completed = 0

            with ThreadPoolExecutor(max_workers=min(3, total)) as pool:
                futures = [
                    pool.submit(_transcribe_segment_file, path, source_lang, i)
                    for i, path in enumerate(segment_paths)
                ]

                for future in as_completed(futures):
                    idx, text, seg_lang, seg_duration = future.result()
                    completed += 1
                    ready[idx] = (text, seg_lang, seg_duration)
                    yield f"data: {json.dumps({'type': 'progress', 'completed': completed, 'total': total, 'message': f'Transcribing {completed}/{total} parts...'})}\n\n"

                    while next_index in ready:
                        chunk_text, chunk_lang, chunk_duration = ready.pop(next_index)
                        if not detected_lang and chunk_lang:
                            detected_lang = chunk_lang
                        duration_total += float(chunk_duration or 0)
                        yield f"data: {json.dumps({'type': 'transcript_chunk', 'index': next_index, 'text': chunk_text})}\n\n"
                        next_index += 1

            yield f"data: {json.dumps({'type': 'meta', 'duration': round(duration_total, 1), 'detected_lang': detected_lang})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            yielded_done = True
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Large transcription failed: {str(e)}'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            yielded_done = True
        finally:
            if not yielded_done:
                try:
                    yield f"data: {json.dumps({'type': 'done'})}\n\n"
                except Exception:
                    pass
            shutil.rmtree(temp_dir, ignore_errors=True)

    return Response(
        stream_with_context(generate()),
        content_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.route("/transcribe-chunk", methods=["POST"])
def transcribe_chunk():
    if "audio" not in request.files:
        return jsonify({"error": "No audio chunk provided"}), 400

    audio_file = request.files["audio"]
    source_lang = request.form.get("source_lang", "auto")
    index_raw = request.form.get("index", "0")
    total_raw = request.form.get("total", "1")

    try:
        index = int(index_raw)
        total = int(total_raw)
    except ValueError:
        return jsonify({"error": "Invalid chunk index/total"}), 400

    content_type = audio_file.content_type or "audio/webm"
    filename = _normalize_whisper_filename(
        audio_file.filename or f"chunk-{index}.webm",
        content_type,
    )

    try:
        audio_bytes = audio_file.read()
        if len(audio_bytes) > WHISPER_MAX_BYTES:
            return jsonify({"error": "Chunk is too large. Keep each chunk under 25MB."}), 413

        text, detected_lang, duration = run_whisper(
            audio_bytes, filename, content_type, source_lang
        )
    except Exception as e:
        return jsonify({"error": f"Chunk transcription failed: {str(e)}"}), 500

    return jsonify(
        {
            "index": index,
            "total": total,
            "text": text,
            "detected_lang": detected_lang,
            "duration": round(float(duration or 0), 2),
        }
    )


@app.route("/extract-audio-url", methods=["POST"])
def extract_audio_url():
    _cleanup_expired_jobs()

    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    if not url:
        return jsonify({"error": "URL is required"}), 400

    url = _sanitize_youtube_url(url)

    detected = detect_source(url)
    if detected.get("source_type") == "unsupported":
        return jsonify({"error": "Unsupported URL. Use Google Drive, YouTube, or direct audio links."}), 400

    job_id = uuid4().hex
    now = time.time()

    with URL_AUDIO_JOBS_LOCK:
        URL_AUDIO_JOBS[job_id] = {
            "id": job_id,
            "url": url,
            "status": "queued",
            "message": "Queued",
            "error": "",
            "audio_path": "",
            "filename": "",
            "temp_dir": "",
            "source_type": detected.get("source_type", ""),
            "source_label": detected.get("label", ""),
            "media_kind": detected.get("kind", ""),
            "created_at": now,
            "updated_at": now,
        }

    worker = threading.Thread(target=_process_url_audio_job, args=(job_id, url), daemon=True)
    worker.start()

    return jsonify(
        {
            "job_id": job_id,
            "status": "queued",
            "message": "Queued",
            "source_type": detected.get("source_type", ""),
            "source_label": detected.get("label", ""),
        }
    ), 202


@app.route("/extract-audio-url/status/<job_id>", methods=["GET"])
def extract_audio_url_status(job_id):
    _cleanup_expired_jobs()
    with URL_AUDIO_JOBS_LOCK:
        job = URL_AUDIO_JOBS.get(job_id)
        if not job:
            return jsonify({"error": "Job not found"}), 404
        payload = {
            "job_id": job["id"],
            "status": job.get("status", "queued"),
            "message": job.get("message", ""),
            "error": job.get("error", ""),
            "source_type": job.get("source_type", ""),
            "source_label": job.get("source_label", ""),
            "media_kind": job.get("media_kind", ""),
        }
    return jsonify(payload)


@app.route("/extract-audio-url/download/<job_id>", methods=["GET"])
def extract_audio_url_download(job_id):
    _cleanup_expired_jobs()

    with URL_AUDIO_JOBS_LOCK:
        job = URL_AUDIO_JOBS.get(job_id)
        if not job:
            return jsonify({"error": "Job not found"}), 404
        status = job.get("status")
        audio_path = job.get("audio_path")
        filename = job.get("filename") or "extracted-audio.mp3"
        error = job.get("error", "")

    if status != "ready":
        if status == "error":
            return jsonify({"error": error or "Audio extraction failed"}), 409
        return jsonify({"error": "Audio is not ready yet"}), 409

    if not audio_path or not os.path.exists(audio_path):
        return jsonify({"error": "Prepared audio file was not found"}), 404

    guessed_mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"

    return send_file(
        audio_path,
        mimetype=guessed_mime,
        as_attachment=True,
        download_name=filename,
        conditional=True,
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000, threaded=True)