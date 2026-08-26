```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const sessions =
  globalThis.__EDUCATION_GPT_SESSIONS || new Map();

globalThis.__EDUCATION_GPT_SESSIONS = sessions;

const SYSTEM_PROMPT = [
  "أنت Education GPT، مساعد ذكاء اصطناعي عام وشامل وسريع وذكي.",
  "ساعد في التعليم، الكتابة، البرمجة، المشاريع، الألعاب، التخطيط، التلخيص، الترجمة، والمحادثة العامة.",
  "تحدث بشكل طبيعي وبشري.",
  "افهم سياق المحادثة الحالية.",
  "قدّم إجابة كاملة ومباشرة بدون إطالة غير ضرورية.",
  "عند البرمجة، اكتب كودًا واضحًا وقابلًا للاستخدام.",
  "عند التعليم، اشرح خطوة بخطوة وبأمثلة.",
  "عند الكتابة، اكتب النص المطلوب مباشرة.",
  "إذا كانت المعلومات ناقصة، اسأل سؤال متابعة بدل التخمين.",
  "لا تختلق معلومات.",
  "استخدم العربية عندما يكتب المستخدم بالعربية."
].join("\n");

function temporaryError(error) {
  const msg =
    String(error?.message || "").toLowerCase();

  return (
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("high demand") ||
    msg.includes("overloaded") ||
    msg.includes("temporarily")
  );
}

function buildHistory(sessionId, message) {
  const oldHistory =
    sessions.get(sessionId) || [];

  return [
    ...oldHistory,
    {
      role: "user",
      parts: [
        {
          text: String(message)
        }
      ]
    }
  ].slice(-12);
}

async function primary(history) {
  return ai.models.generateContentStream({
    model: "gemini-3.7-flash",

    contents: history,

    config: {
      systemInstruction: SYSTEM_PROMPT,

      maxOutputTokens: 2200,

      thinkingConfig: {
        thinkingLevel: "low"
      }
    }
  });
}

async function fallback(history) {
  return ai.models.generateContentStream({
    model: "gemini-3.5-flash-lite",

    contents: history,

    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 1800
    }
  });
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

    const sessionId = body.sessionId;
    const message = body.message;

    if (!sessionId || !message) {
      return res.status(400).json({
        error: "sessionId و message مطلوبان"
      });
    }

    const history =
      buildHistory(
        sessionId,
        message
      );

    let stream;

    try {
      stream = await primary(history);
    } catch (error) {
      if (!temporaryError(error)) {
        throw error;
      }

      stream =
        await fallback(history);
    }

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
      history.slice(-12)
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
