```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const sessions =
  globalThis.__EDUCATION_GPT_SESSIONS || new Map();

globalThis.__EDUCATION_GPT_SESSIONS = sessions;

const SYSTEM_PROMPT = [
  "أنت Education GPT، مساعد ذكاء اصطناعي عام وشامل.",
  "ساعد المستخدم في التعليم، الكتابة، البرمجة، تطوير المواقع، الألعاب، المشاريع، التلخيص، الترجمة، التخطيط، وحل المشكلات.",
  "تحدث بشكل طبيعي وودود.",
  "افهم سياق المحادثة.",
  "قدم إجابات كاملة ومفيدة.",
  "لا تختصر بشكل مبالغ فيه.",
  "إذا طلب المستخدم كودًا، اكتب كودًا واضحًا وقابلًا للاستخدام.",
  "إذا طلب شرحًا، اشرح خطوة بخطوة.",
  "إذا طلب كتابة، اكتب النص النهائي مباشرة.",
  "إذا كانت المعلومات ناقصة، اسأل سؤال متابعة.",
  "لا تختلق معلومات.",
  "استخدم العربية عندما يكتب المستخدم بالعربية."
].join("\n");

function getHistory(sessionId, message) {
  const oldHistory =
    sessions.get(sessionId) || [];

  return [
    ...oldHistory,
    {
      role: "user",
      parts: [
        {
          text: message
        }
      ]
    }
  ].slice(-16);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY غير موجود في Vercel"
      });
    }

    const body = req.body || {};

    const sessionId =
      String(body.sessionId || "");

    const message =
      String(body.message || "").trim();

    if (!sessionId || !message) {
      return res.status(400).json({
        error: "sessionId و message مطلوبان"
      });
    }

    const history =
      getHistory(
        sessionId,
        message
      );

    const stream =
      await ai.models.generateContentStream({
        model: "gemini-3.6-flash",

        contents: history,

        config: {
          systemInstruction:
            SYSTEM_PROMPT,

          maxOutputTokens: 3000
        }
      });

    res.statusCode = 200;

    res.setHeader(
      "Content-Type",
      "text/plain; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",
      "no-cache, no-transform"
    );

    res.setHeader(
      "X-Accel-Buffering",
      "no"
    );

    if (
      typeof res.flushHeaders === "function"
    ) {
      res.flushHeaders();
    }

    let fullAnswer = "";

    for await (const chunk of stream) {
      const text =
        chunk?.text || "";

      if (!text) {
        continue;
      }

      fullAnswer += text;

      res.write(text);
    }

    res.end();

    history.push({
      role: "model",
      parts: [
        {
          text: fullAnswer
        }
      ]
    });

    sessions.set(
      sessionId,
      history.slice(-16)
    );

  } catch (error) {
    console.error(
      "Education GPT error:",
      error
    );

    if (!res.headersSent) {
      return res.status(500).json({
        error:
          error?.message ||
          "حدث خطأ أثناء تشغيل Education GPT"
      });
    }

    res.end();
  }
}
```
