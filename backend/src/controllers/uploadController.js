/**
 * Upload Session Controller
 * Handles chunked file uploads to the server.
 * Files are stored in /tmp and cleaned up after transcription.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const multer = require("multer");

// In-memory session store: sessionId → { dir, chunks: Set<number>, totalChunks }
const uploadSessions = new Map();

// Auto-cleanup sessions after 30 min
const SESSION_TTL_MS = 30 * 60 * 1000;

function scheduleCleanup(sessionId) {
  setTimeout(() => cleanupSession(sessionId), SESSION_TTL_MS);
}

const chunkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5.5 * 1024 * 1024 }, // 5.5 MB overhead buffer
}).single("chunk");

// POST /api/upload-init
exports.initSession = (req, res) => {
  const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `upload_${sessionId}_`));
  uploadSessions.set(sessionId, { dir, chunks: new Set(), totalChunks: null });
  scheduleCleanup(sessionId);
  console.log(`[upload] Session created: ${sessionId} → ${dir}`);
  res.json({ session_id: sessionId });
};

// POST /api/upload-chunk
exports.uploadChunk = (req, res) => {
  chunkUpload(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No chunk data received" });

    const { session_id, chunk_index, total_chunks } = req.body;
    const session = uploadSessions.get(session_id);
    if (!session) return res.status(404).json({ error: "Session not found or expired" });

    const idx = parseInt(chunk_index, 10);
    const chunkPath = path.join(session.dir, `chunk_${String(idx).padStart(6, "0")}`);
    fs.writeFileSync(chunkPath, req.file.buffer);

    session.chunks.add(idx);
    session.totalChunks = parseInt(total_chunks, 10);

    const complete = session.chunks.size === session.totalChunks;
    console.log(`[upload] ${session_id} chunk ${idx + 1}/${total_chunks} received (${(req.file.buffer.length / 1024).toFixed(0)} KB)`);
    res.json({ ok: true, received: idx, complete });
  });
};

// Assembles all chunks into a single file. Returns { outputPath, dir }.
exports.assembleSession = (sessionId, filename) => {
  return new Promise((resolve, reject) => {
    const session = uploadSessions.get(sessionId);
    if (!session) return reject(new Error("Session not found or expired"));

    const ext = path.extname(filename || "audio.mp3").replace(".", "").toLowerCase() || "mp3";
    const outputPath = path.join(session.dir, `assembled.${ext}`);

    const chunkFiles = fs.readdirSync(session.dir)
      .filter((f) => f.startsWith("chunk_"))
      .sort();

    if (chunkFiles.length === 0) return reject(new Error("No chunks found for session"));

    const ws = fs.createWriteStream(outputPath);
    for (const cf of chunkFiles) {
      ws.write(fs.readFileSync(path.join(session.dir, cf)));
    }
    ws.end();
    ws.on("finish", () => {
      const size = fs.statSync(outputPath).size;
      console.log(`[upload] ${sessionId} assembled → ${outputPath} (${(size / 1024 / 1024).toFixed(1)} MB)`);
      resolve({ outputPath, dir: session.dir, ext });
    });
    ws.on("error", reject);
  });
};

exports.cleanupSession = cleanupSession;

function cleanupSession(sessionId) {
  const session = uploadSessions.get(sessionId);
  if (session) {
    try { fs.rmSync(session.dir, { recursive: true, force: true }); } catch { }
    uploadSessions.delete(sessionId);
    console.log(`[upload] Session cleaned up: ${sessionId}`);
  }
}
