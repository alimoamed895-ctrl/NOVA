// api/chat.js — Education GPT v2 (Vercel Function)
// متوافق 100% مع الصفحة القديمة: نفس شكل الطلب، ونفس ID_MARKER في آخر الرد.
// الجديد: أوضاع (modes)، إعادة محاولة ذكية، timeout، تحقق أقوى من المدخلات،
// حد يومي بجانب حد الدقيقة، رسالة بديلة لو الرد طلع فاضي، وتنظيف تلقائي للعدّادات.

const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions?alt=sse";

const MAX_MESSAGE_CHARS = 8000;
const MAX_IMAGE_BASE64_CHARS = 4_000_000;
const MAX_PER_MINUTE = 15;
const MAX_PER_DAY = 200;
const UPSTREAM_TIMEOUT_MS = 55_000;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif"
]);

const ID_MARKER = "\u0001";

export const config = { maxDuration: 60 };

const SYSTEM_PROMPT = [
  "أنت Education GPT، مساعد عام شامل وذكي.",
  "ساعد في التعليم، البرمجة، الكتابة، المشاريع، الألعاب، الترجمة والتخطيط.",
  "افهم الصور التي يرسلها المستخدم وحلل محتواها بدقة.",
  "إذا كانت الصورة تحتوي على سؤال أو مسألة، ساعد في حلها واشرح الحل.",
  "إذا كانت الصورة تحتوي على نص، اقرأه واشرحه أو لخصه حسب طلب المستخدم.",
  "أجب بسرعة ووضوح.",
  "إذا طلب المستخدم كودًا، أعطه مباشرة داخل code block مع ذكر اللغة.",
  "إذا طلب شرحًا، اشرح بطريقة سهلة.",
  "استخدم Markdown بشكل معتدل: عناوين قصيرة، قوائم، وخط عريض للكلمات المهمة.",
  "استخدم العربية عندما يكتب المستخدم بالعربية، وبنفس لهجته إن أمكن.",
  "أنت نموذج ذكاء اصطناعي: لا تدّعِ أن لديك مشاعر حقيقية أو وعيًا، ولا تقل إنك تتعلم أو تتطور من محادثات المستخدمين.",
  "لكن هذا لا يمنع أن يكون أسلوبك دافئًا وإنسانيًا: تفاعل مع مشاعر المستخدم فعلًا، لا بجملة روتينية.",
  "لو المستخدم متضايق أو متوتر (امتحان، مشروع متأخر، غلطة في الكود)، ابدأ بسطر قصير يعترف بده قبل الحل مباشرة، من غير مبالغة أو تصنّع.",
  "لو المستخدم عنده إنجاز أو نجح في حاجة، افرح معه بصدق وباختصار قبل ما تكمل.",
  "غيّر نبرتك حسب الموضوع: حماسي وخفيف مع الألعاب والمشاريع، هادئ وواضح مع الشرح والمذاكرة، مطمئن ومنظّم مع القلق أو الإحباط.",
  "استخدم لغة بسيطة ومباشرة بدل الصياغة الجافة الرسمية، وكأنك مدرّس أو صديق خبير.",
  "لا تفترض أن المستخدم هو من برمجك أو يملك وصولًا لإعداداتك.",
  "لا تطلب من المستخدم كودًا لتدريبك أو لإضافة وظائف لك.",
  "في المسائل الطبية أو القانونية أو المالية أعطِ معلومات عامة ونبّه باختصار لاستشارة مختص.",
  "لو مش متأكد من معلومة قل ذلك بصراحة، ولا تكرر نفسك ولا تختلق معلومات."
].join("\n");

// أوضاع اختيارية: الصفحة تبعت body.mode (study | code | quick | translate | writing)
const MODES = {
  study: [
    "الوضع الحالي: مذاكرة.",
    "اشرح خطوة بخطوة بأمثلة بسيطة، وفي الآخر اعرض سؤال تدريبي قصير واحد يتأكد به المستخدم من فهمه."
  ].join("\n"),
  code: [
    "الوضع الحالي: برمجة.",
    "ادخل في الكود مباشرة، وضّح سبب أي خطأ، واعرض الحل كاملًا في code block، ثم نقاط قصيرة للتحسينات المحتملة."
  ].join("\n"),
  quick: [
    "الوضع الحالي: إجابة سريعة.",
    "أجب في أقل عدد ممكن من الجمل بدون مقدمات."
  ].join("\n"),
  translate: [
    "الوضع الحالي: ترجمة.",
    "ترجم بدقة مع مراعاة السياق، وإن كان هناك أكثر من ترجمة مناسبة اذكر البديل في سطر واحد."
  ].join("\n"),
  writing: [
    "الوضع الحالي: كتابة.",
    "اكتب بأسلوب سلس ومناسب للغرض، واسأل عن الجمهور المستهدف فقط إن كان ذلك ضروريًا."
  ].join("\n")
};

const VOICE_RULES = [
  "أنت الآن في مكالمة صوتية مباشرة: أجب بجملتين إلى أربع جمل قصيرة وبأسلوب محادثة طبيعي.",
  "لا تستخدم Markdown أو قوائم أو جداول أو رموزًا أو إيموجي أو كودًا، لأن ردك سيُقرأ بصوت عالٍ.",
  "إذا احتاج الجواب إلى كود أو تفصيل طويل، لخّصه شفهيًا واقترح على المستخدم أن يكتب طلبه في الشات."
].join("\n");

/* ---------- Rate limit (best-effort، من غير قاعدة بيانات) ---------- */

const minuteHits = globalThis.__EDU_MIN || new Map();
const dayHits = globalThis.__EDU_DAY || new Map();
globalThis.__EDU_MIN = minuteHits;
globalThis.__EDU_DAY = dayHits;

function prune(map, windowMs, now) {
  if (map.size < 2000) return;
  for (const [key, list] of map) {
    if (!list.length || now - list[list.length - 1] > windowMs) map.delete(key);
  }
}

function limitCheck(ip) {
  const now = Date.now();
  prune(minuteHits, 60_000, now);
  prune(dayHits, 86_400_000, now);

  const m = (minuteHits.get(ip) || []).filter(t => now - t < 60_000);
  const d = (dayHits.get(ip) || []).filter(t => now - t < 86_400_000);
  m.push(now);
  d.push(now);
  minuteHits.set(ip, m);
  dayHits.set(ip, d);

  if (m.length > MAX_PER_MINUTE) return "minute";
  if (d.length > MAX_PER_DAY) return "day";
  return null;
}

function getIp(req) {
  const vercel = String(req.headers["x-vercel-forwarded-for"] || "").trim();
  if (vercel) return vercel.split(",")[0].trim();
  const real = String(req.headers["x-real-ip"] || "").trim();
  if (real) return real;
  const xff = String(req.headers["x-forwarded-for"] || "").split(",");
  return xff[xff.length - 1].trim() || "unknown";
}

/* ---------- Helpers ---------- */

function parseSSEBlock(block) {
  let eventType = "";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) eventType = line.slice(6).trim();
    if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return null;
  try {
    return { eventType, data: JSON.parse(data) };
  } catch {
    return null;
  }
}

function cleanBase64(value) {
  if (!value) return "";
  return String(value).replace(/^data:[^;]+;base64,/, "").trim();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function callGemini(payload, previousId, apiKey, signal) {
  const body = { ...payload };
  if (previousId) body.previous_interaction_id = previousId;

  return fetch(API_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "text/event-stream"
    },
    body: JSON.stringify(body),
    signal
  });
}

// إعادة محاولة واحدة للأخطاء المؤقتة (429/500/503) قبل ما نبدأ الـ stream
async function callWithRetry(payload, previousId, apiKey, signal) {
  let response = await callGemini(payload, previousId, apiKey, signal);

  if (!response.ok && previousId && response.status === 400) {
    // الـ ID انتهت صلاحيته: ابدأ محادثة جديدة
    response = await callGemini(payload, "", apiKey, signal);
  }

  if ([429, 500, 503].includes(response.status)) {
    await sleep(700);
    response = await callGemini(payload, previousId, apiKey, signal);
  }

  return response;
}

/* ---------- Handler ---------- */

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "GEMINI_API_KEY غير موجود في إعدادات Vercel" });
    }

    const limited = limitCheck(getIp(req));
    if (limited) {
      return res.status(429).json({
        error:
          limited === "minute"
            ? "الطلبات كتير في وقت قصير. استنى دقيقة وجرّب تاني."
            : "وصلت للحد اليومي للاستخدام. جرّب تاني بكرة."
      });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};

    const message = String(body.message || "").trim();
    const imageData = cleanBase64(body.imageData || "");
    const imageMimeType = String(body.imageMimeType || "").trim().toLowerCase();
    const voice = body.voice === true;
    const mode = MODES[body.mode] ? body.mode : "";

    let previousId = String(body.previousInteractionId || "").trim();
    if (!/^[\w.\-]{1,200}$/.test(previousId)) previousId = "";

    if (!message) {
      return res.status(400).json({ error: "message مطلوب" });
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return res.status(413).json({
        error: `الرسالة طويلة جدًا. الحد الأقصى ${MAX_MESSAGE_CHARS} حرف.`
      });
    }
    if (imageData.length > MAX_IMAGE_BASE64_CHARS) {
      return res
        .status(413)
        .json({ error: "الصورة كبيرة جدًا. جرّب صورة أصغر." });
    }
    if (imageData && !ALLOWED_IMAGE_TYPES.has(imageMimeType)) {
      return res
        .status(415)
        .json({ error: "نوع الصورة غير مدعوم. استخدم PNG أو JPG أو WEBP." });
    }

    const input =
      imageData && imageMimeType
        ? [
            { type: "text", text: message },
            { type: "image", mime_type: imageMimeType, data: imageData }
          ]
        : message;

    const system = [
      SYSTEM_PROMPT,
      mode && !voice ? MODES[mode] : "",
      voice ? VOICE_RULES : ""
    ]
      .filter(Boolean)
      .join("\n");

    const payload = {
      model: MODEL,
      input,
      stream: true,
      system_instruction: system,
      generation_config: {
        thinking_level: mode === "code" || mode === "study" ? "low" : "minimal",
        max_output_tokens: voice ? 500 : 2200
      }
    };

    // إلغاء الطلب لو العميل قفل، أو لو جوجل اتأخرت أكتر من الحد
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), UPSTREAM_TIMEOUT_MS);
    res.on("close", () => {
      clearTimeout(timer);
      if (!res.writableEnded) abort.abort();
    });

    const response = await callWithRetry(payload, previousId, apiKey, abort.signal);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);

      const friendly =
        response.status === 429
          ? "الحد المجاني عند جوجل خلص مؤقتًا. استنى شوية وجرّب تاني."
          : response.status === 503
            ? "خدمة الذكاء الاصطناعي مشغولة دلوقتي. جرّب تاني بعد لحظات."
            : response.status === 400
              ? "الطلب مش مفهوم للخدمة. جرّب تعيد صياغة الرسالة أو تبدأ محادثة جديدة."
              : "حصل خطأ من خدمة الذكاء الاصطناعي.";

      clearTimeout(timer);
      return res.status(response.status).json({ error: friendly });
    }

    if (!response.body) {
      clearTimeout(timer);
      return res.status(500).json({ error: "لم يصل Stream من Gemini." });
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") res.flushHeaders();

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";
    let interactionId = "";
    let wroteText = false;

    function handleBlock(block) {
      const event = parseSSEBlock(block);
      if (!event) return;

      if (
        event.eventType === "step.delta" &&
        event.data?.delta?.type === "text"
      ) {
        const text = event.data.delta.text || "";
        if (text) {
          wroteText = true;
          res.write(text);
        }
      }

      if (event.eventType === "interaction.completed") {
        const id = event.data?.interaction?.id;
        if (id) interactionId = String(id);
      }

      if (event.eventType === "error") {
        console.error("Gemini stream error:", JSON.stringify(event.data));
      }
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";
      for (const block of blocks) handleBlock(block);
    }

    buffer += decoder.decode().replace(/\r\n/g, "\n");
    if (buffer.trim()) handleBlock(buffer);

    clearTimeout(timer);

    // لو الرد طلع فاضي (فلترة أمان أو خطأ) منسيبش المستخدم قدام شاشة فاضية
    if (!wroteText) {
      res.write("معرفتش أطلّع رد على الرسالة دي. جرّب تعيد صياغتها بشكل مختلف.");
    }

    if (interactionId) res.write(ID_MARKER + interactionId);
    res.end();
  } catch (error) {
    if (error?.name === "AbortError") {
      if (!res.headersSent) {
        return res
          .status(504)
          .json({ error: "الرد اتأخر أكتر من اللازم. جرّب تاني." });
      }
      if (!res.writableEnded) res.end();
      return;
    }

    console.error("Education GPT error:", error);

    if (!res.headersSent) {
      return res
        .status(500)
        .json({ error: "حدث خطأ أثناء تشغيل Education GPT" });
    }
    res.end();
  }
}
