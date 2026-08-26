import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const sessions = globalThis.__EDUCATION_GPT_SESSIONS ||= new Map();

const SYSTEM = `
أنت Education GPT، مساعد ذكاء اصطناعي تعليمي ودود وذكي.
تحدث بالعربية الطبيعية عندما يكتب المستخدم بالعربية.
ساعد الطالب في شرح الدروس والتلخيص والاختبارات وخطط المذاكرة.
افهم سياق المحادثة الحالية.
لا تختلق المعلومات.
في الاختبارات اسأل سؤالاً واحداً في كل مرة.
`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY غير موجود في Vercel"
      });
    }

    const { sessionId, message } = req.body || {};

    if (!sessionId || !message) {
      return res.status(400).json({
        error: "sessionId و message مطلوبان"
      });
    }

    const history = [
      ...(sessions.get(sessionId) || []),
      {
        role: "user",
        parts: [{ text: String(message) }]
      }
    ].slice(-20);

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: history,
      config: {
        systemInstruction: SYSTEM,
        maxOutputTokens: 1200
      }
    });

    const answer = response.text || "لم أستطع إنشاء رد الآن.";

    history.push({
      role: "model",
      parts: [{ text: answer }]
    });

    sessions.set(sessionId, history);

    return res.status(200).json({ answer });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: error?.message || "حدث خطأ أثناء الاتصال بـ Gemini"
    });
  }
}
