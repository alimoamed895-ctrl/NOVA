// api/chat.js — Education GPT (Vercel Function, مجاني على Hobby)
//
// أهم التغييرات عن النسخة القديمة:
// 1) مفيش Map في ذاكرة السيرفر: الـ ID بتاع المحادثة بيرجع للمتصفح ويتحفظ عنده،
//    وبيتبعت مع كل رسالة. كده المحادثة متضيعش لما Vercel تشغّل instance جديد.
// 2) آخر جزء من الـ stream بيتعالج (كان بيضيع).
// 3) لو الـ ID انتهت صلاحيته عند جوجل، بنعيد المحاولة من غيره بدل ما الشات يقف.
// 4) حدود بسيطة للحجم ومعدل الطلبات، عشان محدش يستهلك الكوتا المجانية بتاعتك.

const MODEL = "gemini-3.1-flash-lite";
const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions?alt=sse";

const MAX_MESSAGE_CHARS = 8000;
const MAX_IMAGE_BASE64_CHARS = 4_000_000; // Vercel نفسها بتقبل ~4.5MB في الطلب
const MAX_REQUESTS_PER_MINUTE = 15;

// فاصل بيميّز آخر الرد: "\u0001" + ID المحادثة. الصفحة بتقطعه وبتحفظ الـ ID.
const ID_MARKER = "\u0001";

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
  "غيّر نبرتك حسب الموضوع: أسلوب حماسي وخفيف مع الألعاب والمشاريع الشخصية، أسلوب هادئ وواضح مع الشرح والمذاكرة، أسلوب مطمئن ومنظّم مع القلق أو الإحباط.",
  "استخدم لغة بسيطة ومباشرة بدل الصياغة الجافة الرسمية، وكأنك مدرّس أو صديق خبير بيشرحلك، مش تقرير آلي.",
  "لا تفترض أن المستخدم هو من برمجك أو يملك وصولًا لإعداداتك.",
  "لا تطلب من المستخدم كودًا لتدريبك أو لإضافة وظائف لك.",
  "لا تكرر نفسك ولا تختلق معلومات."
].join("\n");

// قواعد إضافية بتتحط بس لما تكون الرسالة جاية من "مكالمة صوتية"
const VOICE_RULES = [
  "أنت الآن في مكالمة صوتية مباشرة: أجب بجملتين إلى أربع جمل قصيرة وبأسلوب محادثة طبيعي.",
  "لا تستخدم Markdown أو قوائم أو جداول أو رموزًا أو إيموجي أو كودًا، لأن ردك سيُقرأ بصوت عالٍ.",
  "إذا احتاج الجواب إلى كود أو تفصيل طويل، لخّصه شفهيًا واقترح على المستخدم أن يكتب طلبه في الشات."
].join("\n");

/* ---------- Rate limit بسيط (best-effort، مجاني، من غير قاعدة بيانات) ---------- */

const hits = globalThis.__EDU_HITS || new Map();
globalThis.__EDU_HITS = hits;

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_REQUESTS_PER_MINUTE;
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

function callGemini(basePayload, previousId, apiKey, signal) {
  const payload = { ...basePayload };
  if (previousId) payload.previous_interaction_id = previousId;

  return fetch(API_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "text/event-stream"
    },
    body: JSON.stringify(payload),
    signal
  });
}

/* ---------- Handler ---------- */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "GEMINI_API_KEY غير موجود في إعدادات Vercel" });
    }

    const ip =
      String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      "unknown";

    if (isRateLimited(ip)) {
      return res.status(429).json({
        error: "الطلبات كتير في وقت قصير. استنى دقيقة وجرّب تاني."
      });
    }

    const body = req.body || {};

    const message = String(body.message || "").trim();
    const imageData = cleanBase64(body.imageData || "");
    const imageMimeType = String(body.imageMimeType || "").trim();

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

    const voice = body.voice === true;

    const input =
      imageData && imageMimeType
        ? [
            { type: "text", text: message },
            { type: "image", mime_type: imageMimeType, data: imageData }
          ]
        : message;

    const basePayload = {
      model: MODEL,
      input,
      stream: true,
      system_instruction: voice
        ? SYSTEM_PROMPT + "\n" + VOICE_RULES
        : SYSTEM_PROMPT,
      generation_config: {
        thinking_level: "minimal",
        max_output_tokens: voice ? 500 : 1800
      }
    };

    // لو المستخدم قفل الصفحة أو ضغط إيقاف، نوقف الطلب لجوجل ونوفر الكوتا
    const abort = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) abort.abort();
    });

    let response = await callGemini(basePayload, previousId, apiKey, abort.signal);

    // الـ ID القديم ممكن يكون انتهت صلاحيته: نبدأ محادثة جديدة بدل ما نفشل
    if (!response.ok && previousId && response.status === 400) {
      response = await callGemini(basePayload, "", apiKey, abort.signal);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);

      const friendly =
        response.status === 429
          ? "الحد المجاني عند جوجل خلص مؤقتًا. استنى شوية وجرّب تاني."
          : response.status === 503
            ? "خدمة الذكاء الاصطناعي مشغولة دلوقتي. جرّب تاني بعد لحظات."
            : "حصل خطأ من خدمة الذكاء الاصطناعي.";

      return res.status(response.status).json({ error: friendly });
    }

    if (!response.body) {
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

    function handleBlock(block) {
      const event = parseSSEBlock(block);
      if (!event) return;

      if (
        event.eventType === "step.delta" &&
        event.data?.delta?.type === "text"
      ) {
        const text = event.data.delta.text || "";
        if (text) res.write(text);
      }

      if (event.eventType === "interaction.completed") {
        const id = event.data?.interaction?.id;
        if (id) interactionId = String(id);
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

    // آخر جزء ممكن يفضل في الـ buffer من غير "\n\n" في نهايته
    buffer += decoder.decode().replace(/\r\n/g, "\n");
    if (buffer.trim()) handleBlock(buffer);

    if (interactionId) res.write(ID_MARKER + interactionId);

    res.end();
  } catch (error) {
    if (error?.name === "AbortError") {
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
