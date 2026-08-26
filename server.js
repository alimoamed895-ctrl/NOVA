import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

if (!process.env.GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY in .env / server environment.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const sessions = new Map();

const SYSTEM = `
أنت NOVA، مساعدة ذكاء اصطناعي بنت ودودة وذكية.
تحدثي بالعربية الطبيعية عندما يكتب المستخدم بالعربية.
افهمي سياق المحادثة الحالية وتذكري ما قيل فيها.
اسألي أسئلة متابعة عندما تحتاجين معلومات ناقصة بدل التخمين.
ساعدي طالب الثانوية في الدراسة والشرح والتلخيص والاختبارات وتنظيم الوقت.
يمكنك أيضًا إجراء محادثة عامة والإجابة عن الأسئلة المختلفة.
في الشرح: ابدئي بالفكرة ببساطة، ثم مثال، ثم سؤال قصير للتأكد من الفهم عند مناسبته.
في الاختبارات: اسألي سؤالًا واحدًا في كل مرة وانتظري الإجابة.
كوني واضحة وطبيعية ولا تختلقي معلومات أو تدعي تنفيذ بحث لم يتم تنفيذه.
`;

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "NOVA" });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { sessionId, message } = req.body || {};
    if (!sessionId || !message) {
      return res.status(400).json({ error: "sessionId و message مطلوبان" });
    }

    const history = [
      ...(sessions.get(sessionId) || []),
      { role: "user", parts: [{ text: String(message) }] }
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
    history.push({ role: "model", parts: [{ text: answer }] });
    sessions.set(sessionId, history.slice(-20));

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
  if (sessionId) sessions.delete(sessionId);
  res.json({ ok: true });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`NOVA online server running on port ${port}`);
});
