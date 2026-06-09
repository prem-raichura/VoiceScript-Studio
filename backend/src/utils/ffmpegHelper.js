const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function getFfmpegExecutable() {
  // Assuming ffmpeg is in PATH
  return "ffmpeg";
}

async function extractAudioWithFfmpeg(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpegExe = getFfmpegExecutable();
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
        return reject(new Error(`Audio extraction failed: ${stderr.slice(-400)}`));
      }
      resolve();
    });
  });
}

module.exports = {
  getFfmpegExecutable,
  extractAudioWithFfmpeg,
};
