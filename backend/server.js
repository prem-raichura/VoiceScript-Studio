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
const uploadController = require("./src/controllers/uploadController");

const app = express();

// Render (and most PaaS) put the app behind a reverse proxy. Without this,
// express-rate-limit sees every request as coming from the proxy IP and
// throttles all users together (and logs ERR_ERL_* validation errors).
app.set("trust proxy", 1);

// Production Middlewares
app.use(helmet());
app.use(morgan("combined"));

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(",") 
  : [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://voice-script-studio.vercel.app",
      "https://voicescript-studio.vercel.app",
    ];

app.use(
  cors({
    origin: allowedOrigins,
  })
);

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
});

// We DO NOT apply it globally because it breaks the /status polling endpoint.

// Increase max payload size
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Routes
app.get("/", healthController.index);
app.get("/health", healthController.health);

// API Routes
const apiRouter = express.Router();

apiRouter.post("/transcribe", apiLimiter, transcribeController.transcribe);
apiRouter.post("/transcribe-chunk", apiLimiter, transcribeController.transcribeChunk);
apiRouter.post("/transcribe-large", apiLimiter, transcribeController.transcribeLarge);
apiRouter.post("/transcribe-url", apiLimiter, transcribeController.transcribeFromUrl);
apiRouter.post("/transcribe-session", apiLimiter, transcribeController.transcribeSession);

// Chunked file upload routes (no Cloudinary needed)
apiRouter.post("/upload-init", apiLimiter, uploadController.initSession);
apiRouter.post("/upload-chunk", uploadController.uploadChunk); // No rate limit — called many times per file

apiRouter.post("/translate-text", apiLimiter, translateController.translateText);

app.use("/api", apiRouter);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong on the server!" });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`VoiceScript Studio Node.js Backend running on port ${PORT}`);
});
