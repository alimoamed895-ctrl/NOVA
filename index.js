
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const app = express();

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const publicDir =
  path.join(__dirname, "public");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const sessions =
  globalThis.__EDUCATION_GPT_SESSIONS ||
  new Map();

globalThis.__EDUCATION_GPT_SESSIONS =
  sessions;

const SYSTEM_PROMPT = [
  "أنت Education GPT، مساعد ذكاء اصطناعي عام وشامل.",
  "ساعد المستخدم في التعليم، الكتابة، البرمجة، تطوير المواقع، الألعاب، المشاريع، التلخيص، الترجمة، التخطيط، وحل المشكلات.",
  "تحدث بشكل طبيعي وودود.",
  "افهم سياق المحادثة.",
  "قدم إجابات كاملة ومفيدة.",
  "لا تختصر بشكل مبالغ فيه.",
  "إذا طلب المستخدم كودًا، اكتب كودًا واضحًا وقابلًا للاستخدام.",
  "إذا طلب شرحًا، اشرح خطوة بخطوة.",
  "إذا طلب كتابة، اكتب النص النهائي مباشرة.",
  "إذا كانت المعلومات ناقصة، اسأل سؤال متابعة.",
  "لا تختلق معلومات.",
  "استخدم العربية عندما يكتب المستخدم بالعربية."
].join("\n");

app.use(
  express.json({
    limit: "10mb"
  })
);

app.use(
  express.static(publicDir)
);

app.get(
  "/",
  async (req, res) => {
    try {
      const html =
        await fs.readFile(
          path.join(
            publicDir,
            "index.html"
          ),
          "utf8"
        );

      res
        .status(200)
        .type("html")
        .send(html);

    } catch (error) {
      console.error(error);

      res
        .status(500)
        .send(
          "Education GPT: فشل تحميل الصفحة الرئيسية."
        );
    }
  }
);

app.get(
  "/login",
  (req, res) => {
    res.redirect(
      "/login.html"
    );
  }
);

app.post(
  "/api/chat",
  async (req, res) => {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res
          .status(500)
          .json({
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

      if (
        !sessionId ||
        !message
      ) {
        return res
          .status(400)
          .json({
            error:
              "sessionId و message مطلوبان"
          });
      }

      const previous =
        sessions.get(
          sessionId
        ) || [];

      const history = [
        ...previous,
        {
          role: "user",
          parts: [
            {
              text: message
            }
          ]
        }
      ].slice(-16);

      const stream =
        await ai.models.generateContentStream(
          {
            model:
              "gemini-3.6-flash",

            contents:
              history,

            config: {
              systemInstruction:
                SYSTEM_PROMPT,

              maxOutputTokens:
                3000
            }
          }
        );

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

      let fullAnswer =
        "";

      for await (
        const chunk of stream
      ) {
        const text =
          chunk?.text || "";

        if (!text) {
          continue;
        }

        fullAnswer +=
          text;

        res.write(
          text
        );
      }

      res.end();

      history.push({
        role: "model",
        parts: [
          {
            text:
              fullAnswer
          }
        ]
      });

      sessions.set(
        sessionId,
        history.slice(-16)
      );

    } catch (error) {
      console.error(
        "Education GPT chat error:",
        error
      );

      if (
        !res.headersSent
      ) {
        return res
          .status(500)
          .json({
            error:
              error?.message ||
              "حدث خطأ أثناء تشغيل Education GPT"
          });
      }

      res.end();
    }
  }
);

export default app;
