# نشر NOVA على الإنترنت

1. ارفع ملفات المشروع إلى GitHub.
2. لا ترفع ملف `.env` ولا مفتاح Gemini.
3. افتح Render.
4. اختر New → Web Service.
5. اربط مستودع GitHub.
6. Build Command: `npm install`
7. Start Command: `npm start`
8. أضف Environment Variable:
   - Key: `GEMINI_API_KEY`
   - Value: مفتاح Gemini الخاص بك
9. اضغط Deploy.
10. Render سيعطيك رابطًا عامًا مثل `https://nova-online-ai.onrender.com`.

هذه النسخة مناسبة كبداية متعددة الأجهزة. الذاكرة الحالية للمحادثة محفوظة في ذاكرة السيرفر، لذلك يمكن أن تختفي عند إعادة تشغيل الخدمة.
