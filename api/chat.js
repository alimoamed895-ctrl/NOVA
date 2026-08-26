const sessions =
  globalThis.__EDUCATION_GPT_SESSIONS ||
  new Map();

globalThis.__EDUCATION_GPT_SESSIONS =
  sessions;

const SYSTEM_PROMPT = [
  "أنت Education GPT، مساعد ذكاء اصطناعي عام وشامل.",
  "ساعد المستخدم في التعليم، الكتابة، البرمجة، تطوير المواقع، الألعاب، المشاريع، التلخيص، الترجمة، التخطيط، وحل المشكلات.",
  "تحدث بطريقة طبيعية وودودة.",
  "افهم سياق المحادثة.",
  "قدم إجابات كاملة ومفيدة.",
  "لا تختصر بشكل مبالغ فيه.",
  "إذا طلب المستخدم كودًا، اكتب كودًا واضحًا وقابلًا للاستخدام.",
  "إذا طلب شرحًا، اشرح خطوة بخطوة وبأمثلة.",
  "إذا طلب كتابة، اكتب النص النهائي مباشرة.",
  "إذا كانت المعلومات ناقصة، اسأل سؤال متابعة ذكيًا.",
  "لا تختلق معلومات.",
  "استخدم العربية عندما يكتب المستخدم بالعربية.",
  "استخدم المصطلحات الإنجليزية عند الحاجة في البرمجة والتقنية."
].join("\n");


function parseSSEBlock(block) {
  let eventType = "";
  let data = "";

  const lines =
    block.split("\n");

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventType =
        line.slice(6).trim();
    }

    if (line.startsWith("data:")) {
      data +=
        line.slice(5).trim();
    }
  }

  if (!data) {
    return null;
  }

  let parsed;

  try {
    parsed =
      JSON.parse(data);
  } catch {
    return null;
  }

  return {
    eventType,
    data: parsed
  };
}


export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }

  try {
    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "GEMINI_API_KEY غير موجود في Vercel"
      });
    }


    const body =
      req.body || {};

    const sessionId =
      String(
        body.sessionId || ""
      );

    const message =
      String(
        body.message || ""
      ).trim();


    if (!sessionId || !message) {
      return res.status(400).json({
        error:
          "sessionId و message مطلوبان"
      });
    }


    const previousInteractionId =
      sessions.get(sessionId) || null;


    const payload = {
      model:
        "gemini-3.6-flash",

      input:
        message,

      stream:
        true,

      system_instruction:
        SYSTEM_PROMPT
    };


    if (previousInteractionId) {
      payload.previous_interaction_id =
        previousInteractionId;
    }


    const response =
      await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method:
            "POST",

          headers: {
            "x-goog-api-key":
              apiKey,

            "Content-Type":
              "application/json",

            "Accept":
              "text/event-stream"
          },

          body:
            JSON.stringify(
              payload
            )
        }
      );


    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        "Gemini REST error:",
        errorText
      );

      return res.status(
        response.status
      ).json({
        error:
          errorText ||
          "Gemini API error"
      });
    }


    if (!response.body) {
      return res.status(500).json({
        error:
          "Gemini لم يُرجع Stream."
      });
    }


    res.statusCode =
      200;


    res.setHeader(
      "Content-Type",
      "text/plain; charset=utf-8"
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


    if (
      typeof res.flushHeaders ===
      "function"
    ) {
      res.flushHeaders();
    }


    const reader =
      response.body.getReader();


    const decoder =
      new TextDecoder();


    let buffer =
      "";


    while (true) {

      const result =
        await reader.read();


      if (result.done) {
        break;
      }


      buffer +=
        decoder.decode(
          result.value,
          {
            stream: true
          }
        );


      const blocks =
        buffer.split("\n\n");


      buffer =
        blocks.pop() || "";


      for (
        const block of blocks
      ) {

        const event =
          parseSSEBlock(block);


        if (!event) {
          continue;
        }


        if (
          event.eventType ===
            "step.delta" &&
          event.data &&
          event.data.delta &&
          event.data.delta.type ===
            "text"
        ) {

          const text =
            event.data.delta.text ||
            "";


          if (text) {
            res.write(text);
          }
        }


        if (
          event.eventType ===
            "interaction.completed"
        ) {

          const interaction =
            event.data.interaction;


          if (
            interaction &&
            interaction.id
          ) {

            sessions.set(
              sessionId,
              interaction.id
            );
          }
        }

      }
    }


    const remaining =
      decoder.decode();


    if (remaining) {

      buffer +=
        remaining;
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


    res.end();
  }
}
