/**
 * Vercel Blob controller.
 * - handleBlobUpload: issues a short-lived client-upload token so the browser
 *   uploads the file straight to Blob (bypasses Vercel's 4.5 MB request cap,
 *   supports multipart up to 1 GB+).
 * - deleteBlob: removes a stored blob once transcription is done.
 *
 * Requires env BLOB_READ_WRITE_TOKEN (auto-injected on Vercel once a Blob
 * store is linked; set manually for local dev).
 */
const { handleUpload } = require("@vercel/blob/client");
const { del } = require("@vercel/blob");

const ONE_GB = 1024 * 1024 * 1024;

exports.handleBlobUpload = async (req, res) => {
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (/* pathname */) => ({
        allowedContentTypes: [
          "audio/*",
          "video/*",
          "application/octet-stream",
        ],
        maximumSizeInBytes: ONE_GB,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log(`[blob] upload complete: ${blob.url}`);
      },
    });
    return res.json(jsonResponse);
  } catch (err) {
    console.error("[blob] upload token error:", err);
    return res.status(400).json({ error: err.message });
  }
};

exports.deleteBlob = async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "url is required" });
  try {
    await del(url);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[blob] delete error:", err);
    return res.status(500).json({ error: err.message });
  }
};
