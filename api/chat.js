```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const sessions =
  globalThis.__EDUCATION_GPT_INTERACTIONS || new Map();

globalThis.__EDUCATION_GPT_INTERACTIONS = sessions;

const SYSTEM_PROMPT = [
  "أنت Education GPT، مساعد ذكاء اصطناعي عام وشامل.",
  "ساعد المستخدم في التعليم، الكتابة، البرمجة، تطوير المواقع، الألعاب، المشاريع، التلخيص، الترجمة، التخطيط، والمحادثة العامة.",
  "تحدث بشكل طبيعي وودود مثل مساعد ذكي حقيقي.",
  "افهم سياق المحادثة الحالية واستمر فيها بشكل طبيعي.",
  "قدّم إجابات كاملة ومفيدة، بدون اختصار غير ضروري.",
  "إذا كان السؤال يحتاج شرحًا، اشرح خطوة بخطوة وبأمثلة.",
  "إذا طلب المستخدم كودًا، اكتب كودًا واضحًا وقابلًا للاستخدام.",
  "إذا طلب المستخدم كتابة، اكتب النص النهائي مباشرة.",
  "إذا كانت المعلومات ناقصة، اسأل سؤال متابعة ذكيًا.",
  "لا تختلق معلومات.",
  "استخدم العربية عندما يكتب المستخدم بالعربية."
].join("\n");

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
    const message = String(body.message || "").trim();

    if (!sessionId || !message) {
      return res.status(400).json({
        error: "sessionId و message مطلوبان"
      });
    }

    const previousInteractionId =
      sessions.get(sessionId) || undefined;

    const options = {
      model: "gemini-3.6-flash",
      input: message,
      system_instruction: SYSTEM_PROMPT,
      stream: true
    };

    if (previousInteractionId) {
      options.previous_interaction_id =
        previousInteractionId;
    }

    const stream =
      await ai.interactions.create(options);

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

    let answer = "";

    for await (const event of stream) {
      if (
        event &&
        event.event_type === "step.delta" &&
        event.delta &&
        event.delta.type === "text" &&
        event.delta.text
      ) {
        answer += event.delta.text;
        res.write(event.delta.text);
      }

      if (
        event &&
        event.event_type === "interaction.completed" &&
        event.interaction &&
        event.interaction.id
      ) {
        sessions.set(
          sessionId,
          event.interaction.id
        );
      }
    }

    res.end();

  } catch (error) {
    console.error(
      "Education GPT error:",
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
