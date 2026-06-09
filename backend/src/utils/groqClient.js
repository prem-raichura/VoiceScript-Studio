const Groq = require("groq-sdk");
const dotenv = require("dotenv");
dotenv.config();

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

module.exports = { client };
