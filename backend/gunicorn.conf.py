# gunicorn.conf.py
# Place in the same directory as app.py
#
# Render start command:
#   gunicorn app:app -c gunicorn.conf.py

# ── Workers ────────────────────────────────────────────────────────────────────
# gthread workers don't block the process during large uploads.
# Sync workers time out mid-read on big files – that was the original bug.
worker_class = "gthread"
workers      = 2   # safe for Render free/starter (512 MB RAM)
threads      = 4   # each worker handles up to 4 concurrent requests

# ── Timeouts ───────────────────────────────────────────────────────────────────
timeout          = 300   # 5 min – large uploads + segmentation + Whisper need time
graceful_timeout = 30
keepalive        = 5

# ── Request limits ─────────────────────────────────────────────────────────────
max_requests        = 500   # restart worker after N requests (avoids slow memory leaks)
max_requests_jitter = 50    # stagger restarts so all workers don't restart at once

# ── Network ────────────────────────────────────────────────────────────────────
bind = "0.0.0.0:10000"   # Render's default port

# ── Logging ────────────────────────────────────────────────────────────────────
accesslog = "-"    # stdout
errorlog  = "-"    # stderr
loglevel  = "info"