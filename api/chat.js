const sessions =
  globalThis.__EDUCATION_GPT_SESSIONS ||
  new Map();

globalThis.__EDUCATION_GPT_SESSIONS =
  sessions;

const SYSTEM_PROMPT = [
  "أنت Education GPT، مساعد عام شامل وذكي.",
  "ساعد في التعليم، البرمجة، الكتابة، المشاريع، الألعاب، الترجمة والتخطيط.",
  "افهم الصور التي يرسلها المستخدم وحلل محتواها بدقة.",
  "إذا كانت الصورة تحتوي على سؤال أو مسألة، ساعد في حلها واشرح الحل.",
  "إذا كانت الصورة تحتوي على نص، اقرأه واشرحه أو لخصه حسب طلب المستخدم.",
  "أجب بسرعة ووضوح.",
  "إذا طلب المستخدم كودًا، أعطه مباشرة.",
  "إذا طلب شرحًا، اشرح بطريقة سهلة.",
  "استخدم العربية عندما يكتب المستخدم بالعربية.",
  "لا تكرر نفسك ولا تختلق معلومات."
].join("\n");


function parseSSEBlock(block) {
  let eventType = "";
  let data = "";

  for (const line of block.split("\n")) {

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

  try {
    return {
      eventType,
      data: JSON.parse(data)
    };
  } catch {
    return null;
  }
}


function cleanBase64(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .replace(/^data:[^;]+;base64,/, "")
    .trim();
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
      ).trim();


    const message =
      String(
        body.message || ""
      ).trim();


    const imageData =
      cleanBase64(
        body.imageData || ""
      );


    const imageMimeType =
      String(
        body.imageMimeType ||
        ""
      ).trim();


    if (!sessionId || !message) {
      return res.status(400).json({
        error:
          "sessionId و message مطلوبان"
      });
    }


    const previousInteractionId =
      sessions.get(sessionId) || null;


    let input;


    if (
      imageData &&
      imageMimeType
    ) {

      input = [
        {
          type: "text",
          text: message
        },
        {
          type: "image",
          mime_type:
            imageMimeType,
          data:
            imageData
        }
      ];

    } else {

      input =
        message;
    }


    const payload = {

      model:
        "gemini-3.1-flash-lite",

      input,

      stream:
        true,

      system_instruction:
        SYSTEM_PROMPT,

      generation_config: {

        thinking_level:
          "minimal",

        max_output_tokens:
          1800
      }
    };


    if (previousInteractionId) {

      payload.previous_interaction_id =
        previousInteractionId;
    }


    const response =
      await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions?alt=sse",
        {
          method: "POST",

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
        "Gemini API error:",
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
          "لم يصل Stream من Gemini."
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
      new TextDecoder(
        "utf-8"
      );


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
          parseSSEBlock(
            block
          );


        if (!event) {
          continue;
        }


        if (
          event.eventType ===
            "step.delta" &&
          event.data?.delta?.type ===
            "text"
        ) {

          const text =
            event.data.delta.text ||
            "";


          if (text) {
            res.write(
              text
            );
          }
        }


        if (
          event.eventType ===
            "interaction.completed"
        ) {

          const interactionId =
            event.data?.interaction?.id;


          if (interactionId) {

            sessions.set(
              sessionId,
              interactionId
            );
          }
        }
      }
    }


    const remaining =
      decoder.decode();


    if (remaining) {
      buffer += remaining;
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
