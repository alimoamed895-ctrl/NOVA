/* enhancements.js — إضافات Education GPT (من غير تعديل كود index.html)
   التركيب: أضف السطر ده قبل </body> في index.html:
   <script src="/enhancements.js" defer></script>
*/
(() => {
  const $ = id => document.getElementById(id);
  const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const del = k => { try { localStorage.removeItem(k); } catch {} };

  /* ---------- CSS ---------- */
  const style = document.createElement("style");
  style.textContent = `
  .modes{display:flex;gap:6px;overflow-x:auto;padding:0 2px 9px;scrollbar-width:none}
  .modes::-webkit-scrollbar{display:none}
  .mode{flex:none;padding:6px 13px;border:1px solid var(--line);border-radius:999px;background:var(--panel-2);color:var(--muted);font-size:12px}
  .mode:hover{border-color:var(--purple);color:var(--text)}
  .mode.on{background:var(--grad);color:#fff;border-color:transparent}
  .bubble pre{position:relative}
  .code-copy{position:absolute;top:6px;right:6px;padding:3px 9px;border:1px solid var(--line);border-radius:7px;background:var(--panel-2);color:var(--muted);font-size:11px;direction:rtl}
  .code-copy:hover{color:var(--text);border-color:var(--purple)}
  .regen{margin-inline-start:6px;padding:5px 9px;border:1px solid var(--line);border-radius:8px;background:var(--panel-2);color:var(--muted);font-size:11px}
  .regen:hover{color:var(--text);border-color:var(--purple)}
  .side-tool{width:100%;padding:11px;border:1px solid var(--line);border-radius:13px;background:var(--panel);color:var(--text);text-align:right;font-size:13px}
  .side-tool:hover{border-color:var(--purple)}
  [data-theme="light"]{--bg:#f3f5fb;--panel:#ffffff;--panel-2:#eef1fa;--line:#cfd7ee;--text:#14182b;--muted:#5b6585}
  [data-theme="light"] body{background:var(--bg)}
  [data-theme="light"] .sidebar{background:#fff}
  [data-theme="light"] .topbar,[data-theme="light"] .composer-area{background:rgba(255,255,255,.92)}
  [data-theme="light"] .message.user .bubble{background:#ece6ff;border-color:#c9b9ff}
  [data-theme="light"] .bubble code,[data-theme="light"] .bubble pre{background:#eef1fa}
  [data-theme="light"] .status{background:#e8fbf1;color:#15803d;border-color:#86efac}
  [data-theme="light"] .avatar.user-avatar{background:#8a94b3}
  `;
  document.head.appendChild(style);

  /* ---------- الثيم (فاتح / داكن) ---------- */
  const applyTheme = t => document.documentElement.setAttribute("data-theme", t);
  applyTheme(get("education_gpt_theme") || "dark");

  /* ---------- الأوضاع ---------- */
  const MODES = [
    ["", "🌐 عام"], ["study", "📖 مذاكرة"], ["code", "💻 برمجة"],
    ["quick", "⚡ سريع"], ["translate", "🔤 ترجمة"], ["writing", "✍️ كتابة"]
  ];
  let mode = get("education_gpt_mode") || "";

  const bar = document.createElement("div");
  bar.className = "modes";
  MODES.forEach(([id, label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mode" + (id === mode ? " on" : "");
    b.textContent = label;
    b.onclick = () => {
      mode = id;
      set("education_gpt_mode", id);
      bar.querySelectorAll(".mode").forEach(x => x.classList.toggle("on", x === b));
    };
    bar.appendChild(b);
  });
  document.querySelector(".composer-area")?.prepend(bar);

  /* ---------- إضافة mode للطلب + حفظ آخر رسالة ---------- */
  let lastText = "";
  const realFetch = window.fetch.bind(window);
  window.fetch = (url, opts = {}) => {
    try {
      if (String(url).includes("/api/chat") && typeof opts.body === "string") {
        const body = JSON.parse(opts.body);
        if (mode && !body.voice) body.mode = mode;
        if (body.message && !body.voice) lastText = body.message;
        opts = { ...opts, body: JSON.stringify(body) };
      }
    } catch {}
    return realFetch(url, opts);
  };

  function lastUserFromHistory() {
    try {
      const h = JSON.parse(get("education_gpt_history") || "[]");
      for (let i = h.length - 1; i >= 0; i--) {
        if (h[i].role === "user") return String(h[i].text).replace(/^🖼️ \[صورة\] /, "");
      }
    } catch {}
    return "";
  }

  /* ---------- زرار نسخ الكود + إعادة توليد ---------- */
  let queued = false;
  function refresh() {
    queued = false;

    document.querySelectorAll(".bubble pre").forEach(pre => {
      if (pre.querySelector(".code-copy")) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "code-copy";
      b.textContent = "نسخ الكود";
      pre.appendChild(b);
    });

    const acts = [...document.querySelectorAll(".message:not(.user) .actions")];
    const last = acts[acts.length - 1];
    document.querySelectorAll(".regen").forEach(b => { if (b.parentElement !== last) b.remove(); });
    if (last && !last.querySelector(".regen")) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "regen";
      b.textContent = "🔄 إعادة";
      last.appendChild(b);
    }
  }
  const chatEl = $("chat");
  if (chatEl) {
    new MutationObserver(() => {
      if (!queued) { queued = true; requestAnimationFrame(refresh); }
    }).observe(chatEl, { childList: true, subtree: true });
    refresh();

    chatEl.addEventListener("click", async e => {
      const copyBtn = e.target.closest(".code-copy");
      if (copyBtn) {
        const code = copyBtn.parentElement.querySelector("code");
        try {
          await navigator.clipboard.writeText((code || copyBtn.parentElement).innerText);
          copyBtn.textContent = "تم ✓";
          setTimeout(() => (copyBtn.textContent = "نسخ الكود"), 1200);
        } catch {}
        return;
      }
      if (e.target.closest(".regen")) {
        if ($("send")?.classList.contains("stop")) return;
        const text = lastText || lastUserFromHistory();
        if (!text) return;
        $("input").value = text;
        $("send").click();
      }
    });
  }

  /* ---------- أدوات في الشريط الجانبي ---------- */
  const spacer = document.querySelector(".sidebar .spacer");
  if (spacer) {
    const title = document.createElement("div");
    title.className = "section-title";
    title.textContent = "أدوات";

    const exp = document.createElement("button");
    exp.className = "side-tool";
    exp.type = "button";
    exp.textContent = "⬇️ تصدير المحادثة";
    exp.onclick = () => {
      let h = [];
      try { h = JSON.parse(get("education_gpt_history") || "[]"); } catch {}
      if (!h.length) return alert("مفيش محادثة لتصديرها.");
      const md = "# محادثة Education GPT\n\n" + h
        .map(m => (m.role === "user" ? "### 🧑 أنت\n" : "### ✨ Education GPT\n") + m.text)
        .join("\n\n---\n\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
      a.download = "education-gpt-chat.md";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };

    const theme = document.createElement("button");
    theme.className = "side-tool";
    theme.type = "button";
    const label = () => (document.documentElement.dataset.theme === "light" ? "🌙 الوضع الداكن" : "☀️ الوضع الفاتح");
    theme.textContent = label();
    theme.onclick = () => {
      const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      applyTheme(next);
      set("education_gpt_theme", next);
      theme.textContent = label();
    };

    spacer.before(title, exp, theme);
  }

  /* ---------- الاسم + تسجيل الخروج ---------- */
  const name = get("education_gpt_name");
  const user = get("education_gpt_user");
  const login = document.querySelector(".login-link");
  if (name) {
    const h1 = document.querySelector("#welcome h1");
    if (h1) h1.textContent = "أهلًا " + name + " ✨";
  }
  if (login && (user || get("education_gpt_guest"))) {
    login.textContent = user ? "👤 " + (name || user) + " · خروج" : "👤 زائر · تسجيل الدخول";
    login.onclick = e => {
      e.preventDefault();
      ["education_gpt_user", "education_gpt_name", "education_gpt_remember", "education_gpt_guest"].forEach(del);
      location.href = "/login.html";
    };
  }

  /* ---------- اختصارات ---------- */
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      $("input")?.focus();
    }
  });
})();
