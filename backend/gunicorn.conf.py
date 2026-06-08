# gunicorn.conf.py
# Place this file in the same directory as app.py
#
# Render start command:
#   gunicorn app:app -c gunicorn.conf.py

import multiprocessing

# ── Workers ────────────────────────────────────────────────────────────────
# gthread workers handle large uploads without blocking the whole process.
# Sync workers time out mid-upload on large files (the bug you hit).
worker_class = "gthread"

# 2 workers is safe on Render free/starter (512 MB RAM).
# Each worker spawns `threads` threads so you still get concurrency.
workers = 2
threads = 4

# ── Timeouts ───────────────────────────────────────────────────────────────
# 300 s = 5 min.  Large-file uploads + segmentation + Whisper calls need time.
timeout = 300
graceful_timeout = 30
keepalive = 5

# ── Request limits ─────────────────────────────────────────────────────────
max_requests = 500          # Restart worker after N requests (avoids memory leaks)
max_requests_jitter = 50    # Randomise restarts so all workers don't restart at once

# ── Network ────────────────────────────────────────────────────────────────
bind = "0.0.0.0:10000"      # Render's default port

# ── Logging ────────────────────────────────────────────────────────────────
accesslog = "-"             # stdout
errorlog = "-"              # stderr
loglevel = "info"
