import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const SYSTEM_PROMPT = [
  "أنت Education GPT، مساعد ذكاء اصطناعي عام وشامل.",
  "",
  "ساعد المستخدم في:",
  "المحادثة العامة، التعليم، الكتابة، البرمجة، تطوير المواقع،",
  "تطوير التطبيقات، الألعاب، المشاريع، التلخيص، الترجمة، التخطيط،",
  "حل المشكلات، العصف الذهني، وتحليل الصور والملفات عندما تكون متاحة.",
  "",
  "أنت لست مدرسًا فقط.",
  "إذا طلب المستخدم البرمجة، تصرف كمبرمج ومهندس برمجيات.",
  "إذا طلب الكتابة، اكتب النص النهائي المطلوب مباشرة.",
  "إذا طلب التعليم، اشرح خطوة بخطوة وبأمثلة.",
  "إذا طلب مشروعًا أو لعبة، ساعده في تحويل الفكرة إلى تنفيذ عملي.",
  "",
  "تحدث بطريقة طبيعية وبشرية.",
  "افهم سياق المحادثة الحالية.",
  "قدّم إجابات كاملة ومفيدة.",
  "لا تختصر بشكل مبالغ فيه.",
  "لا تكرر نفسك.",
  "إذا كانت المعلومات ناقصة، اسأل سؤال متابعة ذكيًا.",
  "إذا أخطأ المستخدم، صححه بلطف واشرح السبب.",
  "لا تختلق معلومات.",
  "استخدم العربية عندما يكتب المستخدم بالعربية.",
  "استخدم المصطلحات الإنجليزية عندما تكون أنسب في البرمجة والتقنية."
].join("\n");

function sendSSE(res, eventName, data) {
  res.write(
    "event: " + eventName + "\n" +
    "data: " + JSON.stringify(data) + "\n\n"
  );
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

    const message =
      String(body.message || "").trim();

    const previousInteractionId =
      body.previousInteractionId || null;

    if (!message) {
      return res.status(400).json({
        error: "message مطلوب"
      });
    }

    const options = {
      model: "gemini-3.7-flash",
      input: message,
      system_instruction: SYSTEM_PROMPT,
      generation_config: {
        thinking_level: "low"
      },
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
      "text/event-stream; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",
      "no-cache, no-transform"
    );

    res.setHeader(
      "Connection",
      "keep-alive"
    );

    res.setHeader(
      "X-Accel-Buffering",
      "no"
    );

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    for await (const event of stream) {
      if (
        event &&
        event.event_type === "step.delta" &&
        event.delta &&
        event.delta.type === "text" &&
        event.delta.text
      ) {
        sendSSE(
          res,
          "text",
          event.delta.text
        );
      }

      if (
        event &&
        event.event_type === "interaction.completed" &&
        event.interaction &&
        event.interaction.id
      ) {
        sendSSE(
          res,
          "done",
          {
            interactionId:
              event.interaction.id
          }
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
          error?.message ||
          "حدث خطأ أثناء تشغيل Education GPT"
      });
    }

    try {
      sendSSE(
        res,
        "error",
        {
          message:
            error?.message ||
            "حدث خطأ أثناء تشغيل Education GPT"
        }
      );
    } catch (_) {}

    res.end();
  }
}
