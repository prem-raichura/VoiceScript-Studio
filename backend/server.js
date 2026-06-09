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
const youtubeController = require("./src/controllers/youtubeController");

const app = express();

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
app.use("/api/", apiLimiter);

// Increase max payload size
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Routes
app.get("/", healthController.index);
app.get("/health", healthController.health);

// API Routes
const apiRouter = express.Router();

apiRouter.post("/detect-source", youtubeController.detectSourceRoute);
apiRouter.post("/extract-audio-url", youtubeController.extractAudioUrl);
apiRouter.get("/extract-audio-url/status/:job_id", youtubeController.extractAudioUrlStatus);
apiRouter.get("/extract-audio-url/download/:job_id", youtubeController.extractAudioUrlDownload);

apiRouter.post("/transcribe", transcribeController.transcribe);
apiRouter.post("/transcribe-chunk", transcribeController.transcribeChunk);
apiRouter.post("/transcribe-large", transcribeController.transcribeLarge);

apiRouter.post("/translate-text", translateController.translateText);

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
