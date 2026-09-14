// ضع هذا الملف في مجلد api/ باسم image.js
// (بجانب chat.js الموجود عندك بالفعل)

function cleanBase64(value) {
  if (!value) return "";
  return String(value).replace(/^data:[^;]+;base64,/, "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY غير موجود في Vercel" });
    }

    const body = req.body || {};
    const prompt = String(body.prompt || "").trim();
    const imageData = cleanBase64(body.imageData || "");
    const imageMimeType = String(body.imageMimeType || "").trim();

    if (!prompt) {
      return res.status(400).json({ error: "prompt مطلوب" });
    }

    // ملاحظة مهمة: اسم موديل توليد الصور بيتغيّر بسرعة عند جوجل.
    // شوف قائمة الموديلات الحالية اللي عندك صلاحية عليها في
    // https://ai.google.dev/gemini-api/docs/models
    // وحط الاسم الصحيح هنا (غالبًا شيء يحتوي على "image" في اسمه).
    const IMAGE_MODEL = "gemini-2.5-flash-image";

    const parts = [{ text: prompt }];

    // لو المستخدم بعت صورة موجودة، يبقى ده "تعديل صورة" مش "توليد من الصفر"
    if (imageData && imageMimeType) {
      parts.push({
        inline_data: {
          mime_type: imageMimeType,
          data: imageData
        }
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"]
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini image error:", errorText);
      return res.status(response.status).json({ error: errorText || "فشل توليد الصورة" });
    }

    const data = await response.json();

    // نلقط أول جزء صورة (inline_data) في الرد
    const responseParts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = responseParts.find(p => p.inlineData || p.inline_data);
    const textPart = responseParts.find(p => p.text);

    if (!imagePart) {
      return res.status(500).json({
        error: "لم يرجع الموديل صورة. حاول تصيغ الطلب بشكل مختلف.",
        modelText: textPart?.text || null
      });
    }

    const inline = imagePart.inlineData || imagePart.inline_data;

    return res.status(200).json({
      imageData: inline.data,
      mimeType: inline.mimeType || inline.mime_type,
      text: textPart?.text || null
    });

  } catch (error) {
    console.error("Education GPT image error:", error);
    return res.status(500).json({ error: error?.message || "حدث خطأ أثناء توليد الصورة" });
  }
}
