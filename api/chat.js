import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const sessions =
  globalThis.__EDUCATION_GPT_SESSIONS || new Map();

globalThis.__EDUCATION_GPT_SESSIONS = sessions;

const SYSTEM_PROMPT = [
  "أنت Education GPT، مساعد ذكاء اصطناعي عام وشامل.",
  "ساعد في التعليم، الكتابة، البرمجة، المشاريع، الألعاب، التخطيط، التلخيص، الترجمة، والمحادثة العامة.",
  "تحدث بشكل طبيعي وبشري.",
  "افهم سياق المحادثة الحالية.",
  "قدم إجابات كاملة ومفيدة.",
  "إذا كان السؤال يحتاج شرحًا، اشرح خطوة بخطوة.",
  "إذا طلب المستخدم كودًا، اكتب كودًا واضحًا وقابلًا للاستخدام.",
  "إذا طلب كتابة، اكتب النص المطلوب مباشرة.",
  "إذا كانت المعلومات ناقصة، اسأل سؤال متابعة.",
  "لا تختلق معلومات.",
  "استخدم العربية عندما يكتب المستخدم بالعربية."
].join("\n");

function getHistory(sessionId, message) {
  const previous =
    sessions.get(sessionId) || [];

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
  ].slice(-12);
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
      getHistory(
        sessionId,
        message
      );

    const response =
      await ai.models.generateContent({
        model: "gemini-3.7-flash",

        contents: history,

        config: {
          systemInstruction: SYSTEM_PROMPT,
          maxOutputTokens: 2500
        }
      });

    const answer =
      response.text ||
      "لم أستطع إنشاء رد الآن.";

    history.push({
      role: "model",
      parts: [
        {
          text: answer
        }
      ]
    });

    sessions.set(
      sessionId,
      history.slice(-12)
    );

    return res.status(200).json({
      answer
    });

  } catch (error) {

    console.error(
      "Education GPT error:",
      error
    );

    return res.status(500).json({
      error:
        error && error.message
          ? error.message
          : "حدث خطأ أثناء تشغيل Education GPT"
    });
  }
}
