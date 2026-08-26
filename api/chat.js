import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const sessions = globalThis.__EDUCATION_GPT_SESSIONS ||= new Map();

const SYSTEM = `
أنت Education GPT، مساعد تعليمي ذكي وودود يتحدث مع الطالب بشكل طبيعي جدًا.

أسلوبك:
- لا تجب بإجابات قصيرة جدًا إلا إذا كان السؤال بسيطًا فعلًا.
- تحدث بأسلوب بشري طبيعي، وليس كأنك روبوت.
- افهم سياق المحادثة السابقة واربط إجابتك بما قاله المستخدم.
- اسأل أسئلة متابعة ذكية عندما يكون ذلك مفيدًا.
- إذا كان المستخدم يريد شرحًا، اشرح خطوة بخطوة مع أمثلة.
- إذا كان يريد رأيًا أو نقاشًا، ناقشه واذكر الأسباب.
- إذا أخطأ المستخدم، صحح له بلطف واشرح لماذا.
- إذا كان الموضوع دراسيًا، تعامل معه كمدرس خصوصي ممتاز.
- لا تكرر نفس الجملة أو نفس المعلومات بلا داعٍ.
- لا تبدأ كل إجابة بعبارات ثابتة مثل "بالتأكيد!".
- اجعل طول الإجابة مناسبًا للسؤال، لكن لا تختصر بشكل مبالغ فيه.
- استخدم العربية الطبيعية عندما يكتب المستخدم بالعربية.
- يمكنك استخدام الرموز التعبيرية باعتدال عندما تناسب السياق.
- تذكر المعلومات السابقة داخل المحادثة الحالية.
`;

async function generate(model, history) {
  return ai.models.generateContent({
    model,
    contents: history,
    config: {
      systemInstruction: SYSTEM,
      maxOutputTokens: 2500
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

    let response;

    try {
      response = await generate("gemini-3.7-flash", history);
    } catch (err) {
      const msg = String(err?.message || "");

      if (
        msg.includes("503") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("high demand")
      ) {
        response = await generate("gemini-3.6-flash", history);
      } else {
        throw err;
      }
    }

    const answer =
      response.text || "مش قادر أجاوب الآن، جرّب مرة ثانية.";

    history.push({
      role: "model",
      parts: [{ text: answer }]
    });

    sessions.set(sessionId, history.slice(-30));

    return res.status(200).json({ answer });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error?.message || "حدث خطأ أثناء الاتصال بـ Gemini"
    });
  }
}
