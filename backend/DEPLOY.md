# Deploying the backend to Vercel

The backend is a single Express app wrapped as one serverless function
(`api/index.js`). `vercel.json` rewrites every request to it.

## What changed from the old Render/Docker backend

- **No ffmpeg / yt-dlp on the server.** Vercel serverless functions have no
  system binaries, a 512 MB `/tmp`, and a hard execution-time limit, so the old
  YouTube/Drive extraction and server-side segmentation were removed.
- **Files go through Vercel Blob.** The browser uploads straight to Blob
  (bypassing Vercel's 4.5 MB request-body cap, multipart up to ~1 GB). The
  backend fetches the stored file, transcribes it, then deletes it.
- **Large files (>25 MB)** are segmented client-side with ffmpeg.wasm and sent
  to `/api/transcribe-chunk` one small piece at a time, so no single request is
  large or long.
- **URL transcription** now accepts only direct public audio links
  (`/api/transcribe-url`), no yt-dlp.

## Routes

| Method | Path                    | Purpose                                         |
|--------|-------------------------|-------------------------------------------------|
| GET    | `/health`               | Health check                                    |
| POST   | `/api/blob/upload`      | Issues a client-upload token (Vercel Blob)      |
| POST   | `/api/blob/delete`      | Deletes a stored blob                           |
| POST   | `/api/transcribe-blob`  | Fetch blob → Whisper → SSE → delete blob (≤25MB)|
| POST   | `/api/transcribe-chunk` | Transcribe one small audio chunk → JSON         |
| POST   | `/api/transcribe-url`   | Transcribe a direct public audio link (≤25MB)   |
| POST   | `/api/translate-text`   | Stream a translation (SSE)                       |

## One-time setup

1. **Create the Vercel project** for the backend:
   - Import the repo in Vercel.
   - Set **Root Directory** to `backend`.
   - Framework preset: **Other**. Build command: none. Output: none.

2. **Add a Blob store**: Vercel dashboard → Storage → Create → Blob, and link it
   to this project. That auto-injects `BLOB_READ_WRITE_TOKEN`.

3. **Environment variables** (Project → Settings → Environment Variables):
   - `GROQ_API_KEY` — your Groq key.
   - `ALLOWED_ORIGINS` — your frontend URL(s), comma-separated,
     e.g. `https://voicescript-studio.vercel.app`.
   - `BLOB_READ_WRITE_TOKEN` — set automatically by the linked Blob store.

4. **Function duration**: `vercel.json` requests `maxDuration: 60`. The Hobby
   plan caps a function at 60 s; Pro + Fluid Compute allows up to 300 s. A 25 MB
   Whisper call usually finishes well within 60 s, but very long single files
   may need Pro.

## Frontend

Set `VITE_API_BASE_URL` to the deployed backend origin (e.g.
`https://voicescript-backend.vercel.app`). The browser uploads to Blob via the
backend's `/api/blob/upload` token route, so the frontend needs no Blob token.

## Local dev

```bash
cd backend
cp .env.example .env   # fill in GROQ_API_KEY + BLOB_READ_WRITE_TOKEN
npm install
npm run dev            # http://localhost:8000
```

`BLOB_READ_WRITE_TOKEN` for local dev is copied from the Vercel Blob store.
Note: Blob `onUploadCompleted` callbacks don't fire against `localhost` (Vercel
can't reach your machine) — that callback is only informational here.
