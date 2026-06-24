// Vercel serverless entry point.
// vercel.json rewrites every request to this function; Express then routes it.
const app = require("../server");

module.exports = app;
