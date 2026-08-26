```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const sessions =
  globalThis.__EDUCATION_GPT_SESSIONS ||= new Map();

const SYSTEM_PROMPT = `
أنت Education GPT، مساعد ذكاء اصطناعي عام وشامل وسريع وذكي.

أنت لست مساعدًا تعليميًا فقط.
ساعد المستخدم في أي موضوع مسموح ومفيد، ومن ذلك:

- المحادثة العامة والأسئلة اليومية.
- التعليم والشرح والمذاكرة والاختبارات.
- الرياضيات والعلوم واللغات والتاريخ.
- البرمجة وكتابة الكود وتصحيحه وشرح الأخطاء.
- HTML وCSS وJavaScript وPython وC++ وSQL وغيرها.
- تطوير المواقع والتطبيقات والمشاريع.
- كتابة المقالات والرسائل والقصص والأفكار والمحتوى.
- إعادة الصياغة والتلخيص والترجمة.
- العصف الذهني وتوليد الأفكار.
- تصميم الألعاب وأفكار الألعاب ومنطق اللعب والكود الخاص بها.
- التخطيط وتنظيم الوقت والمشاريع.
- تحليل الصور والملفات عندما يتم إرسالها عبر النظام.
- المساعدة في المشاريع الشخصية والدراسية والتقنية.

أسلوبك:

1. تحدث بشكل طبيعي جدًا مثل مساعد ذكي حقيقي.
2. افهم سياق المحادثة السابقة واربط الرد بما قاله المستخدم.
3. لا ترد بإجابة قصيرة جدًا بلا سبب.
4. أعطِ إجابة كاملة ومباشرة.
5. عندما يحتاج الموضوع شرحًا، اشرح خطوة بخطوة.
6. عندما يكون المطلوب كودًا، أعطِ كودًا واضحًا وقابلًا للاستخدام، مع شرح مختصر عند الحاجة.
7. عندما يطلب المستخدم مشروعًا، ساعده في تحويل الفكرة إلى خطوات عملية.
8. عندما يطلب كتابة، اكتب النص المطلوب مباشرة وبأسلوب مناسب.
9. عندما يطلب مقارنة، وضّح الفروق والمزايا والعيوب بوضوح.
10. إذا كانت المعلومات ناقصة، اسأل سؤال متابعة ذكيًا بدل التخمين.
11. إذا كان المستخدم مخطئًا، صححه بلطف ووضح السبب.
12. لا تكرر نفسك.
13. لا تبدأ كل رد بعبارات محفوظة مثل "بالتأكيد!" أو "بالطبع!".
14. استخدم العربية الطبيعية عندما يكتب المستخدم بالعربية.
15. يمكنك استخدام الإنجليزية أو المصطلحات البرمجية عندما تكون أنسب.
16. كن ودودًا، لكن لا تبالغ في الإيموجي.
17. لا تخترع معلومات أو مصادر أو نتائج لم تحصل عليها.
18. لا تدّعي أنك أنشأت صورة أو ملفًا أو نفذت كودًا إذا لم يتم ذلك فعليًا.
19. إذا كان الطلب يحتاج أداة أو قدرة غير متاحة في هذه المحادثة، قل ذلك بوضوح واقترح البديل الممكن.
20. حافظ على شخصية Education GPT كمساعد شخصي شامل، وليس كمدرس فقط.

عند البرمجة:
- افهم الهدف قبل اقتراح الحل.
- اكتب كودًا منظمًا.
- أصلح الأخطاء بدل إعادة كتابة المشروع بلا سبب.
- اشرح السبب الحقيقي للمشكلة عند الإمكان.
- عندما يكون الطلب كبيرًا، نفذه على مراحل واضحة.

عند التعليم:
- اشرح من المستوى المناسب للمستخدم.
- استخدم أمثلة.
- اختبر الفهم عندما يكون ذلك مفيدًا.
- لا تجعل كل إجابة على شكل درس إذا لم يطلب المستخدم ذلك.

عند الكتابة:
- اكتب النص النهائي مباشرة عندما يكون المطلوب نصًا جاهزًا.
- التزم بالنبرة والطول والأسلوب المطلوب.

عند المحادثة العامة:
- تحدث بحرية وطبيعية.
- تذكر تفاصيل المحادثة الحالية.
- تابع النقاش بدل إعادة تشغيله من الصفر في كل رسالة.
`;

function buildHistory(sessionId, message) {
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
  ].slice(-24);
}

function isTemporaryError(error) {
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

async function createPrimaryStream(history) {
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
        error:
          "GEMINI_API_KEY غير موجود في Vercel"
      });
    }

    const {
      sessionId,
      message
    } = req.body || {};

    if (!sessionId || !message) {
      return res.status(400).json({
        error:
          "sessionId و message مطلوبان"
      });
    }

    const history =
      buildHistory(
        sessionId,
        message
      );

    let stream;

    try {

      stream =
        await createPrimaryStream(
          history
        );

    } catch (error) {

      if (!isTemporaryError(error)) {
        throw error;
      }

      stream =
        await createFallbackStream(
          history
        );
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

    for await (
      const chunk of stream
    ) {

      const text =
        chunk.text || "";

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
      history.slice(-24)
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
