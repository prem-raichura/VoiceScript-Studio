const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

dotenv.config();

const healthController = require("./src/controllers/healthController");
const transcribeController = require("./src/controllers/transcribeController");
const translateController = require("./src/controllers/translateController");
const blobController = require("./src/controllers/blobController");

const app = express();

// Vercel (and most PaaS) put the app behind a reverse proxy. Without this,
// express-rate-limit sees every request as coming from the proxy IP and
// throttles all users together (and logs ERR_ERL_* validation errors).
app.set("trust proxy", 1);

// Production Middlewares
app.use(helmet());
app.use(morgan("combined"));

const allowedOrigins = (process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://voice-script-studio.vercel.app",
      "https://voicescript-studio.vercel.app",
    ]
)
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

// Dynamic origin check. A plain array origin makes cors send NO
// Access-Control-Allow-Origin on a miss, which the browser reports as a vague
// "cross origin" error. Reflecting the origin explicitly (and allowing any
// *.vercel.app preview deploy) makes failures obvious and previews work.
function isAllowedOrigin(origin) {
  if (allowedOrigins.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    if (host.endsWith(".vercel.app")) return true;
  } catch {
    /* malformed origin → not allowed */
  }
  return false;
}

const corsOptions = {
  origin(origin, callback) {
    // No Origin header → curl, health checks, server-to-server. Allow.
    if (!origin) return callback(null, true);
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(null, false); // no ACAO header → browser blocks
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
// Short-circuit every preflight with the same policy.
app.options("*", cors(corsOptions));

// Rate limiting. NOTE: on serverless the in-memory store resets per cold
// instance, so this is best-effort throttling only.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

// Increase JSON payload size (used for blob URLs / metadata, not raw files).
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Health
app.get("/", healthController.index);
app.get("/health", healthController.health);

// API Routes
const apiRouter = express.Router();

// ── Vercel Blob: client-upload token + cleanup ──
apiRouter.post("/blob/upload", blobController.handleBlobUpload);
apiRouter.post("/blob/delete", apiLimiter, blobController.deleteBlob);

// ── Transcription ──
// Whole file (<=25 MB) lives in Blob; backend fetches it, transcribes, deletes.
apiRouter.post("/transcribe-blob", apiLimiter, transcribeController.transcribeBlob);
// Single small audio chunk (<4.5 MB) posted directly — used by client-side
// ffmpeg.wasm segmentation for files larger than 25 MB.
apiRouter.post("/transcribe-chunk", transcribeController.transcribeChunk);
// Direct public audio link (no yt-dlp, no segmentation).
apiRouter.post("/transcribe-url", apiLimiter, transcribeController.transcribeFromUrl);

// ── Translation ──
apiRouter.post("/translate-text", apiLimiter, translateController.translateText);

app.use("/api", apiRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Something went wrong on the server!" });
});

// Only listen when run directly (local dev). On Vercel the app is imported
// by api/index.js and invoked per-request.
if (require.main === module) {
  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => {
    console.log(`VoiceScript Studio Node.js Backend running on port ${PORT}`);
  });
}

module.exports = app;
