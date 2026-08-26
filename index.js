import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY");
}

const ai = new GoogleGenAI({ apiKey });
const sessions = new Map();

const SYSTEM = `
أنت Education GPT، مساعد ذكاء اصطناعي تعليمي ودود وذكي.
تحدث بالعربية الطبيعية عندما يكتب المستخدم بالعربية.
ساعد الطالب في شرح الدروس والتلخيص والاختبارات وخطط المذاكرة.
افهم سياق المحادثة الحالية.
لا تختلق المعلومات.
في الاختبارات اسأل سؤالاً واحداً في كل مرة.
`;

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/chat", async (req, res) => {
  try {
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

    res.json({ answer });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error?.message || "حدث خطأ أثناء الاتصال بـ Gemini"
    });
  }
});

app.post("/api/new-chat", (req, res) => {
  const { sessionId } = req.body || {};

  if (sessionId) {
    sessions.delete(sessionId);
  }

  res.json({ ok: true });
});

export default app;
