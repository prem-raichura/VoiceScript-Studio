const { spawn, spawnSync } = require("child_process");
const fs = require("fs");

/**
 * Returns "ffmpeg" if ffmpeg is available in PATH, or null if it is not.
 * Results are cached after the first check.
 */
let _ffmpegAvailable = null;

function getFfmpegExecutable() {
  if (_ffmpegAvailable === null) {
    const result = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
    _ffmpegAvailable = result.error ? null : "ffmpeg";
    if (!_ffmpegAvailable) {
      console.warn("[ffmpegHelper] ffmpeg not found in PATH – video audio extraction will use raw download fallback.");
    }
  }
  return _ffmpegAvailable;
}

/**
 * Extracts audio from a video file to an MP3 using ffmpeg.
 * @param {string} inputPath - Path to the input video/audio file.
 * @param {string} outputPath - Path to write the output MP3.
 */
async function extractAudioWithFfmpeg(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpegExe = getFfmpegExecutable();
    if (!ffmpegExe) {
      return reject(new Error("ffmpeg is not available. Cannot extract audio."));
    }

    const cmdArgs = [
      "-y",
      "-i", inputPath,
      "-vn", "-acodec", "libmp3lame", "-q:a", "4",
      outputPath,
    ];

    const proc = spawn(ffmpegExe, cmdArgs);

    let stderr = "";
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0 || !fs.existsSync(outputPath)) {
        return reject(new Error(`Audio extraction failed (exit ${code}): ${stderr.slice(-400)}`));
      }
      resolve();
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });
  });
}

module.exports = {
  getFfmpegExecutable,
  extractAudioWithFfmpeg,
};
