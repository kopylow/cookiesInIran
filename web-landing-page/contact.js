// Contact drawer — exposed as window.ContactUI.
// Loaded as a plain script (no ES modules) to match main.js / support.js /
// audiobook.js / comments.js.
//
// A simple form (name + optional email + optional phone + message) that POSTs to
// /api/contact, which emails the message to the site owner via Resend — the same
// mechanism the comment-reply notifications use. Spam defense mirrors the comment
// form: hidden honeypot field + per-IP rate limit (server) + Turnstile captcha.
(function () {
  "use strict";

  const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js";
  const ENDPOINT = "/api/contact";
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const SUPPORTED = ["de", "en", "ru"];

  const I18N = {
    de: {
      intro: "Schreib mir gern eine Nachricht: Feedback zum Buch, eine Frage oder einfach ein Hallo. E-Mail und Telefon sind optional, aber wenn du eine Antwort möchtest, hinterlasse bitte zumindest eine E-Mail.",
      name: "Name",
      email: "E-Mail (optional)",
      phone: "Telefon (optional)",
      message: "Nachricht",
      submit: "Absenden",
      sending: "Wird gesendet …",
      success: "Danke! Deine Nachricht ist unterwegs.",
      errName: "Bitte gib deinen Namen ein.",
      errMessage: "Bitte schreib eine Nachricht.",
      errEmail: "Diese E-Mail-Adresse sieht nicht gültig aus.",
      errPhone: "Diese Telefonnummer sieht nicht gültig aus.",
      errRate: "Zu viele Anfragen. Bitte versuche es später noch einmal.",
      errCaptcha: "Bitte bestätige, dass du kein Roboter bist.",
      errGeneric: "Etwas ist schiefgelaufen. Bitte versuche es später erneut.",
      privacy: "Datenschutz",
    },
    en: {
      intro: "Drop me a message: feedback on the book, a question, or simply a hello. Email and phone are optional, but if you would like a reply, please leave at least an email.",
      name: "Name",
      email: "Email (optional)",
      phone: "Phone (optional)",
      message: "Message",
      submit: "Send",
      sending: "Sending …",
      success: "Thank you! Your message is on its way.",
      errName: "Please enter your name.",
      errMessage: "Please write a message.",
      errEmail: "That email address doesn't look valid.",
      errPhone: "That phone number doesn't look valid.",
      errRate: "Too many requests. Please try again later.",
      errCaptcha: "Please confirm you're not a robot.",
      errGeneric: "Something went wrong. Please try again later.",
      privacy: "Privacy",
    },
    ru: {
      intro: "Напишите мне: отзыв о книге, вопрос или просто привет. E-mail и телефон необязательны, но если хотите ответ, оставьте, пожалуйста, хотя бы e-mail.",
      name: "Имя",
      email: "E-mail (необязательно)",
      phone: "Телефон (необязательно)",
      message: "Сообщение",
      submit: "Отправить",
      sending: "Отправляется …",
      success: "Спасибо! Ваше сообщение отправлено.",
      errName: "Пожалуйста, укажите имя.",
      errMessage: "Пожалуйста, напишите сообщение.",
      errEmail: "Этот адрес e-mail выглядит неправильным.",
      errPhone: "Этот номер телефона выглядит неправильным.",
      errRate: "Слишком много запросов. Попробуйте позже.",
      errCaptcha: "Подтвердите, что вы не робот.",
      errGeneric: "Что-то пошло не так. Попробуйте позже.",
      privacy: "Конфиденциальность",
    },
  };

  // Maps server error codes to localized status messages.
  const ERROR_KEY = {
    invalid_name: "errName",
    invalid_message: "errMessage",
    invalid_email: "errEmail",
    invalid_phone: "errPhone",
    rate_limited: "errRate",
    captcha_failed: "errCaptcha",
  };

  // --- module state ---
  let contentEl = null; // .drawer-content of #drawer-contact
  let currentLang = "de";
  let getLang = () => currentLang;
  let formEl = null;
  let captchaToken = null;
  let turnstileWidgetId = null;
  let turnstileLoaded = false;

  function t() {
    return I18N[currentLang] || I18N.en;
  }

  function lang2() {
    return SUPPORTED.includes(currentLang) ? currentLang : "en";
  }

  function el(tag, attrs, text) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") node.className = attrs[k];
        else node.setAttribute(k, attrs[k]);
      }
    }
    if (text != null) node.textContent = text;
    return node;
  }

  // A label + input/textarea pair, reusing the comment form's .form-field styles.
  function field(labelText, control) {
    const label = el("label", { class: "form-field" });
    label.appendChild(el("span", null, labelText));
    label.appendChild(control);
    return label;
  }

  // ---------- Turnstile (mirrors comments.js) ----------

  function turnstileSiteKey() {
    const meta = document.querySelector('meta[name="turnstile-site-key"]');
    return meta && meta.content ? meta.content.trim() : "";
  }

  function ensureTurnstile() {
    const key = turnstileSiteKey();
    if (!key || turnstileWidgetId !== null) return;
    if (!turnstileLoaded) {
      turnstileLoaded = true;
      const s = document.createElement("script");
      s.src = TURNSTILE_SCRIPT;
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
    const mount = formEl && formEl.querySelector(".form-turnstile-mount");
    if (!mount) return;
    const renderWhenReady = () => {
      if (window.turnstile && mount.isConnected) {
        turnstileWidgetId = window.turnstile.render(mount, {
          sitekey: key,
          callback: (token) => { captchaToken = token; },
          "error-callback": () => { captchaToken = null; },
          "expired-callback": () => { captchaToken = null; },
        });
      } else {
        setTimeout(renderWhenReady, 200);
      }
    };
    renderWhenReady();
  }

  function resetTurnstile() {
    if (window.turnstile && turnstileWidgetId !== null) {
      try { window.turnstile.reset(turnstileWidgetId); } catch (e) {}
    }
    captchaToken = null;
    turnstileWidgetId = null;
  }

  // ---------- rendering ----------

  function setStatus(msg, isError) {
    if (!formEl) return;
    const status = formEl.querySelector(".form-status");
    if (!status) return;
    status.textContent = msg || "";
    status.classList.toggle("error", !!isError);
  }

  function render() {
    if (!contentEl) return;
    resetTurnstile();
    contentEl.innerHTML = "";
    const tr = t();

    const wrap = el("div", { class: "contact" });
    wrap.appendChild(el("p", { class: "contact-intro" }, tr.intro));

    const form = el("form", { class: "contact-form", novalidate: "" });

    // Honeypot — bots fill it, humans never see it (hidden via .hp in CSS).
    form.appendChild(el("input", {
      type: "text", name: "website", class: "hp", tabindex: "-1",
      autocomplete: "off", "aria-hidden": "true",
    }));

    const nameInput = el("input", { name: "name", required: "", maxlength: "60", autocomplete: "name" });
    form.appendChild(field(tr.name, nameInput));

    const emailInput = el("input", { name: "email", type: "email", maxlength: "254", autocomplete: "email" });
    form.appendChild(field(tr.email, emailInput));

    const phoneInput = el("input", { name: "phone", type: "tel", maxlength: "40", autocomplete: "tel" });
    form.appendChild(field(tr.phone, phoneInput));

    const messageTa = el("textarea", { name: "message", required: "", maxlength: "2000", rows: "5" });
    form.appendChild(field(tr.message, messageTa));

    form.appendChild(el("div", { class: "form-turnstile-mount" }));

    const row = el("div", { class: "form-row" });
    row.appendChild(el("button", { type: "submit" }, tr.submit));
    form.appendChild(row);

    form.appendChild(el("small", { class: "form-status", "aria-live": "polite" }));

    const footer = el("small", { class: "form-footer" });
    footer.appendChild(el("a", { href: `privacy-${lang2()}.html`, target: "_blank", rel: "noopener" }, tr.privacy));
    form.appendChild(footer);

    form.addEventListener("submit", handleSubmit);
    // Lazy-load Turnstile only once the user actually engages with the form.
    messageTa.addEventListener("focus", ensureTurnstile, { once: true });

    wrap.appendChild(form);
    contentEl.appendChild(wrap);
    formEl = form;
  }

  // ---------- submit ----------

  async function handleSubmit(ev) {
    ev.preventDefault();
    const form = ev.target;
    const fd = new FormData(form);
    const tr = t();

    const name = (fd.get("name") || "").toString().trim();
    const email = (fd.get("email") || "").toString().trim();
    const phone = (fd.get("phone") || "").toString().trim();
    const message = (fd.get("message") || "").toString().trim();
    const honeypot = (fd.get("website") || "").toString();

    if (!name) { setStatus(tr.errName, true); return; }
    if (!message) { setStatus(tr.errMessage, true); return; }
    if (email && !EMAIL_RE.test(email)) { setStatus(tr.errEmail, true); return; }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.dataset.origLabel = submitBtn.textContent;
    submitBtn.textContent = tr.sending;
    setStatus("");

    const payload = {
      name,
      email: email || undefined,
      phone: phone || undefined,
      message,
      lang: lang2(),
      website: honeypot,
      turnstileToken: captchaToken || undefined,
    };

    try {
      const r = await fetch(ENDPOINT, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.origLabel;

      if (r.status >= 400) {
        setStatus(tr[ERROR_KEY[data.error]] || tr.errGeneric, true);
        resetTurnstile();
        return;
      }
      // Success — clear the form so a second message starts fresh.
      form.reset();
      setStatus(tr.success);
      resetTurnstile();
    } catch (e) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.origLabel;
      setStatus(tr.errGeneric, true);
    }
  }

  // --- public API (mirrors window.SupportUI / window.CommentsUI) ---
  const ContactUI = {
    init(opts) {
      opts = opts || {};
      contentEl = opts.contentEl || (opts.drawerEl && opts.drawerEl.querySelector(".drawer-content")) || null;
      getLang = opts.getCurrentLang || getLang;
      currentLang = getLang();
    },
    open() {
      currentLang = getLang();
      render();
    },
    setLang(lang) {
      currentLang = lang;
      render();
    },
  };

  window.ContactUI = ContactUI;
})();
