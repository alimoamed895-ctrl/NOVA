```javascript id="1h8pkh"
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const sessions =
  globalThis.__EDUCATION_GPT_SESSIONS || new Map();

globalThis.__EDUCATION_GPT_SESSIONS = sessions;

const SYSTEM_PROMPT = [
  "أنت Education GPT، مساعد ذكاء اصطناعي عام وشامل وسريع وذكي.",
  "",
  "ساعد المستخدم في التعليم، البرمجة، الكتابة، التلخيص، الترجمة، التخطيط،",
  "المحادثة العامة، المشاريع، تطوير المواقع، الألعاب، حل المشكلات، والعصف الذهني.",
  "",
  "أنت لست مدرسًا فقط.",
  "إذا طلب المستخدم البرمجة، تصرف كمبرمج ومهندس برمجيات.",
  "إذا طلب الكتابة، اكتب النص المطلوب مباشرة وبأسلوب مناسب.",
  "إذا طلب التعليم، اشرح خطوة بخطوة وبأمثلة.",
  "إذا طلب فكرة مشروع أو لعبة، ساعده في تحويلها إلى خطوات وكود عملي.",
  "",
  "تحدث بشكل طبيعي وبشري.",
  "افهم سياق المحادثة الحالية وتذكر ما قيل سابقًا.",
  "لا تعطِ إجابات قصيرة بشكل مبالغ فيه.",
  "لا تكرر نفسك.",
  "إذا كانت المعلومات ناقصة، اسأل سؤال متابعة بدل التخمين.",
  "إذا أخطأ المستخدم، صححه بلطف واشرح السبب.",
  "لا تختلق معلومات.",
  "استخدم العربية عندما يكتب المستخدم بالعربية.",
  "استخدم المصطلحات الإنجليزية عند الحاجة في البرمجة والتقنية.",
  "لا تدّعي أنك نفذت شيئًا لم تنفذه فعليًا."
].join("\n");

function isTemporaryError(error) {
  const message =
    String(error && error.message ? error.message : "").toLowerCase();

  return (
    message.includes("503") ||
    message.includes("unavailable") ||
    message.includes("high demand") ||
    message.includes("overloaded") ||
    message.includes("temporarily")
  );
}

function getHistory(sessionId, message) {
  const previous = sessions.get(sessionId) || [];

  return [
    ...previous,
    {
      role: "user",
      parts: [
        {
          text: String(message)
        }
      ]
    }
  ].slice(-20);
}

async function createMainStream(history) {
  return ai.models.generateContentStream({
    model: "gemini-3.7-flash",
    contents: history,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 3000,
      thinkingConfig: {
        thinkingLevel: "low"
      }
    }
  });
}

async function createFallbackStream(history) {
  return ai.models.generateContentStream({
    model: "gemini-3.5-flash-lite",
    contents: history,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      maxOutputTokens: 2200
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

    const history = getHistory(
      sessionId,
      message
    );

    let stream;

    try {
      stream = await createMainStream(history);
    } catch (error) {
      if (!isTemporaryError(error)) {
        throw error;
      }

      stream = await createFallbackStream(history);
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

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    let fullAnswer = "";

    for await (const chunk of stream) {
      const text = chunk && chunk.text
        ? chunk.text
        : "";

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
      history.slice(-20)
    );

  } catch (error) {
    console.error(
      "Education GPT runtime error:",
      error
    );

    if (!res.headersSent) {
      return res.status(500).json({
        error:
          error && error.message
            ? error.message
            : "حدث خطأ أثناء تشغيل Education GPT"
      });
    }

    res.end();
  }
}
```
