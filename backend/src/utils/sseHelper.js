/**
 * Setup Server-Sent Events headers
 */
function sseResponse(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
}

/**
 * Send an SSE message
 */
function sendSseMessage(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

module.exports = {
  sseResponse,
  sendSseMessage,
};
