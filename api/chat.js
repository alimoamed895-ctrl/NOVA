import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const sessions = globalThis.__EDUCATION_GPT_SESSIONS ||= new Map();

const SYSTEM = `
أنت Education GPT، مساعد ذكاء اصطناعي تعليمي ذكي وودود.

تحدث مع المستخدم بشكل طبيعي مثل مساعد ذكي حقيقي.
افهم سياق المحادثة السابقة واربط الإجابة بما قاله المستخدم.
لا تعطِ إجابات قصيرة بشكل مبالغ فيه.
اسأل أسئلة متابعة ذكية عندما يكون ذلك مفيدًا.
في الشرح الدراسي: اشرح خطوة بخطوة مع أمثلة.
إذا أخطأ المستخدم، صحح له بلطف ووضح السبب.
في الاختبارات: اسأل سؤالًا واحدًا في كل مرة وانتظر الإجابة.
استخدم العربية الطبيعية إذا كان المستخدم يكتب بالعربية.
لا تختلق معلومات.
`;

async function getStream(history) {
  try {
    return await ai.models.generateContentStream({
      model: "gemini-3.7-flash",
      contents: history,
      config: {
        systemInstruction: SYSTEM,
        maxOutputTokens: 1800
      }
    });
  } catch (error) {
    const message = String(error?.message || "");

    if (
      message.includes("503") ||
      message.includes("UNAVAILABLE") ||
      message.includes("high demand")
    ) {
      return await ai.models.generateContentStream({
        model: "gemini-3.6-flash",
        contents: history,
        config: {
          systemInstruction: SYSTEM,
          maxOutputTokens: 1800
        }
      });
    }

    throw error;
  }
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
    ].slice(-30);

    const stream = await getStream(history);

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");

    let fullAnswer = "";

    for await (const chunk of stream) {
      const text = chunk.text || "";

      if (text) {
        fullAnswer += text;
        res.write(text);
      }
    }

    res.end();

    history.push({
      role: "model",
      parts: [{ text: fullAnswer }]
    });

    sessions.set(sessionId, history.slice(-30));

  } catch (error) {
    console.error(error);

    if (!res.headersSent) {
      return res.status(500).json({
        error: error?.message || "حدث خطأ أثناء الاتصال بـ Gemini"
      });
    }

    res.end();
  }
}
