const { client } = require("../utils/groqClient");
const { sseResponse, sendSseMessage } = require("../utils/sseHelper");

const LANGUAGES = {
  en: "English", hi: "Hindi", gu: "Gujarati",
  es: "Spanish", fr: "French", de: "German",
  ja: "Japanese", zh: "Chinese (Mandarin)", ar: "Arabic",
  pt: "Portuguese", ru: "Russian", ko: "Korean", it: "Italian",
};

async function translateStream(res, originalText, targetLang) {
  const targetName = LANGUAGES[targetLang] || targetLang;

  try {
    const stream = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a professional translator. Translate the following text accurately to ${targetName}. Preserve tone, punctuation, and formatting. Output ONLY the translated text – no preamble, no explanation, no quotes.`,
        },
        { role: "user", content: originalText },
      ],
      max_tokens: 8192,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) {
        sendSseMessage(res, { type: "translation_chunk", text: delta });
      }
    }
  } catch (error) {
    console.error("Translation error:", error);
    sendSseMessage(res, { type: "error", message: error.message });
  }

  sendSseMessage(res, { type: "done" });
  res.end();
}

exports.translateText = async (req, res) => {
  const text = (req.body.text || "").trim();
  const targetLang = (req.body.target_lang || "en").trim() || "en";

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  sseResponse(res);
  await translateStream(res, text, targetLang);
};

exports.translateStream = translateStream;
