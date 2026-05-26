// Comments UI module — exposed as window.CommentsUI.
// Loaded as a plain script (no ES modules) to match main.js conventions.
(function () {
  "use strict";

  const STORAGE_KEY = "cii_comment_identity";
  const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js";

  const I18N = {
    de: {
      mainThread: "Hauptthread",
      chapterSelect: "Kapitel",
      chooseChapter: "— Kapitel wählen —",
      mainOption: "Hauptthread (alle Kapitel)",
      loading: "Lade Kommentare …",
      empty: "Noch keine Kommentare. Schreib den ersten.",
      identityVerifiedAs: "Du schreibst als",
      verifiedBadge: "verifiziert",
      formName: "Name",
      formEmail: "E-Mail (optional)",
      formEmailHint: "Reserviert deinen Namen exklusiv für dich und benachrichtigt dich optional bei Antworten.",
      formBody: "Kommentar",
      formNotify: "Benachrichtige mich bei Antworten",
      formSubmit: "Absenden",
      formSubmitting: "Wird gesendet …",
      formCancelReply: "Antwort abbrechen",
      replyingTo: "Antwort an",
      privacyLink: "Datenschutz",
      privacyHref: "privacy-de.html",
      verifyPrompt: "Wir haben dir einen 6-stelligen Code geschickt. Bitte gib ihn hier ein.",
      verifyCode: "Code",
      verifySubmit: "Bestätigen",
      verifyCancel: "Abbrechen",
      verifyResend: "Code erneut anfordern",
      btnReply: "Antworten",
      btnReport: "Melden",
      reportConfirm: "Diesen Kommentar als unangemessen melden?",
      reportPrompt: "Grund (optional):",
      reportThanks: "Danke, wir schauen es uns an.",
      reportAlready: "Dieser Kommentar wurde bereits gemeldet.",
      justNow: "gerade eben",
      minAgo: (n) => `vor ${n} Min.`,
      hourAgo: (n) => `vor ${n} Std.`,
      dayAgo: (n) => `vor ${n} T.`,
      errorGeneric: "Etwas ist schiefgelaufen. Bitte später erneut versuchen.",
      errorNameRequired: "Bitte gib einen Namen an.",
      errorBodyRequired: "Bitte schreib etwas in dein Kommentar.",
      errorEmailFormat: "Diese E-Mail-Adresse sieht ungültig aus.",
      errorCodeFormat: "Bitte 6 Ziffern eingeben.",
      errorRateLimited: "Zu viele Anfragen. Bitte einen Moment warten.",
      errorBanned: "Du kannst aktuell keine Kommentare schreiben.",
      errorCaptcha: "Captcha-Prüfung fehlgeschlagen.",
      errorNameProtected: "Dieser Name ist von jemand anderem verifiziert. Wähl einen anderen Namen oder verifiziere dich mit der hinterlegten E-Mail.",
      errorCodeInvalid: "Der Code stimmt nicht.",
      errorCodeExpired: "Der Code ist abgelaufen. Bitte einen neuen anfordern.",
      statusNeedsVerify: "Wir haben dir einen Code per E-Mail geschickt.",
      statusPosted: "Veröffentlicht.",
      loadMore: (n) => `Weitere laden (noch ${n})`,
    },
    en: {
      mainThread: "Main thread",
      chapterSelect: "Chapter",
      chooseChapter: "— choose chapter —",
      mainOption: "Main thread (all chapters)",
      loading: "Loading comments …",
      empty: "No comments yet. Be the first.",
      identityVerifiedAs: "You're posting as",
      verifiedBadge: "verified",
      formName: "Name",
      formEmail: "Email (optional)",
      formEmailHint: "Reserves your name exclusively for you and optionally notifies you of replies.",
      formBody: "Comment",
      formNotify: "Notify me of replies",
      formSubmit: "Post",
      formSubmitting: "Sending …",
      formCancelReply: "Cancel reply",
      replyingTo: "Replying to",
      privacyLink: "Privacy",
      privacyHref: "privacy-en.html",
      verifyPrompt: "We sent a 6-digit code to your email. Please enter it here.",
      verifyCode: "Code",
      verifySubmit: "Verify",
      verifyCancel: "Cancel",
      verifyResend: "Resend code",
      btnReply: "Reply",
      btnReport: "Report",
      reportConfirm: "Report this comment as inappropriate?",
      reportPrompt: "Reason (optional):",
      reportThanks: "Thanks, we'll take a look.",
      reportAlready: "This comment was already reported.",
      justNow: "just now",
      minAgo: (n) => `${n} min ago`,
      hourAgo: (n) => `${n} h ago`,
      dayAgo: (n) => `${n} d ago`,
      errorGeneric: "Something went wrong. Please try again later.",
      errorNameRequired: "Please enter a name.",
      errorBodyRequired: "Please write your comment.",
      errorEmailFormat: "That email looks invalid.",
      errorCodeFormat: "Please enter 6 digits.",
      errorRateLimited: "Too many requests. Please wait a moment.",
      errorBanned: "You can't post comments right now.",
      errorCaptcha: "Captcha check failed.",
      errorNameProtected: "This name is verified by someone else. Choose another or verify with the registered email.",
      errorCodeInvalid: "That code isn't right.",
      errorCodeExpired: "The code has expired. Please request a new one.",
      statusNeedsVerify: "We sent a code to your email.",
      statusPosted: "Posted.",
      loadMore: (n) => `Load more (${n} remaining)`,
    },
    ru: {
      mainThread: "Главная тема",
      chapterSelect: "Глава",
      chooseChapter: "— выберите главу —",
      mainOption: "Главная тема (все главы)",
      loading: "Загрузка комментариев …",
      empty: "Пока нет комментариев. Будьте первым.",
      identityVerifiedAs: "Вы пишете как",
      verifiedBadge: "подтверждено",
      formName: "Имя",
      formEmail: "E-mail (необязательно)",
      formEmailHint: "Сохраняет ваше имя исключительно за вами и при желании уведомляет об ответах.",
      formBody: "Комментарий",
      formNotify: "Уведомлять меня об ответах",
      formSubmit: "Отправить",
      formSubmitting: "Отправка …",
      formCancelReply: "Отменить ответ",
      replyingTo: "Ответ для",
      privacyLink: "Конфиденциальность",
      privacyHref: "privacy-ru.html",
      verifyPrompt: "Мы отправили 6-значный код на вашу почту. Введите его здесь.",
      verifyCode: "Код",
      verifySubmit: "Подтвердить",
      verifyCancel: "Отмена",
      verifyResend: "Отправить код снова",
      btnReply: "Ответить",
      btnReport: "Пожаловаться",
      reportConfirm: "Пожаловаться на этот комментарий?",
      reportPrompt: "Причина (необязательно):",
      reportThanks: "Спасибо, мы разберёмся.",
      reportAlready: "Этот комментарий уже был отмечен.",
      justNow: "только что",
      minAgo: (n) => `${n} мин назад`,
      hourAgo: (n) => `${n} ч назад`,
      dayAgo: (n) => `${n} дн. назад`,
      errorGeneric: "Что-то пошло не так. Попробуйте позже.",
      errorNameRequired: "Пожалуйста, укажите имя.",
      errorBodyRequired: "Пожалуйста, напишите комментарий.",
      errorEmailFormat: "Этот e-mail выглядит некорректным.",
      errorCodeFormat: "Введите 6 цифр.",
      errorRateLimited: "Слишком много запросов. Подождите немного.",
      errorBanned: "Сейчас вы не можете писать комментарии.",
      errorCaptcha: "Проверка captcha не пройдена.",
      errorNameProtected: "Это имя подтверждено другим пользователем. Выберите другое или подтвердите зарегистрированной почтой.",
      errorCodeInvalid: "Код неверный.",
      errorCodeExpired: "Срок действия кода истёк. Запросите новый.",
      statusNeedsVerify: "Мы отправили код на вашу почту.",
      statusPosted: "Опубликовано.",
      loadMore: (n) => `Загрузить ещё (осталось ${n})`,
    },
  };

  const ERROR_KEY_MAP = {
    rate_limited: "errorRateLimited",
    banned: "errorBanned",
    captcha_failed: "errorCaptcha",
    name_protected: "errorNameProtected",
    code_invalid: "errorCodeInvalid",
    code_expired: "errorCodeExpired",
    invalid_email: "errorEmailFormat",
    invalid_code: "errorCodeFormat",
    invalid_name: "errorNameRequired",
    invalid_body: "errorBodyRequired",
  };

  let pendingReportId = null;
  let countdownInterval = null;

  let state = {
    drawerEl: null,
    rootEl: null,
    currentLang: "de",
    currentThread: { kind: "main" }, // or { kind: "ch", index: N }
    identity: { verified: false, name: null, lang: null },
    pendingVerify: null, // { email, expiresAt, name, body, parentId, notifyOnReply, threadId }
    chapters: [],         // [{ index, title }]
    turnstileLoaded: false,
    turnstileWidgetId: null,
    captchaToken: null,
    // Track IDs we've already rendered for the current thread, so the fade-in
    // animation only fires on first appearance (initial load + new posts), not
    // on every re-fetch of the same thread.
    seenIds: new Set(),
    lastThreadKey: null,
  };

  function t(key) {
    const table = I18N[state.currentLang] || I18N.de;
    const val = table[key];
    if (typeof val === "function") return val;
    return val ?? key;
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function avatarHueFromName(name) {
    const s = String(name ?? "");
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    }
    return Math.abs(h) % 360;
  }

  function avatarInitial(name) {
    const trimmed = String(name ?? "").trim();
    if (!trimmed) return "?";
    const words = trimmed.split(/\s+/);
    if (words.length >= 2) {
      return (Array.from(words[0])[0] + Array.from(words[words.length - 1])[0]).toUpperCase();
    }
    return Array.from(trimmed)[0].toUpperCase();
  }

  function autolink(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
      const safe = url.replace(/[<>"]/g, "");
      return `<a href="${safe}" rel="nofollow ugc noopener" target="_blank">${safe}</a>`;
    });
  }

  function relativeTime(unixSec) {
    const now = Math.floor(Date.now() / 1000);
    const diff = Math.max(0, now - unixSec);
    if (diff < 60) return t("justNow");
    if (diff < 3600) return t("minAgo")(Math.floor(diff / 60));
    if (diff < 86400) return t("hourAgo")(Math.floor(diff / 3600));
    if (diff < 86400 * 14) return t("dayAgo")(Math.floor(diff / 86400));
    return new Date(unixSec * 1000).toLocaleDateString(state.currentLang);
  }

  function threadIdFor(thread, lang) {
    return thread.kind === "main" ? `main:${lang}` : `ch:${thread.index}:${lang}`;
  }

  function loadStoredIdentity() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { name: "", email: "" };
      const parsed = JSON.parse(raw);
      return { name: parsed.name || "", email: parsed.email || "" };
    } catch { return { name: "", email: "" }; }
  }

  function saveStoredIdentity({ name, email }) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: name || "", email: email || "" }));
    } catch { /* ignore */ }
  }

  // ---------- Turnstile ----------

  function turnstileSiteKey() {
    const meta = document.querySelector('meta[name="turnstile-site-key"]');
    return (meta && meta.content) ? meta.content.trim() : "";
  }

  function ensureTurnstile() {
    const key = turnstileSiteKey();
    if (!key || state.turnstileWidgetId !== null) return;
    if (!state.turnstileLoaded) {
      state.turnstileLoaded = true;
      const s = document.createElement("script");
      s.src = TURNSTILE_SCRIPT;
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
    const mount = state.rootEl?.querySelector(".form-turnstile-mount");
    if (!mount) return;
    const renderWhenReady = () => {
      if (window.turnstile && mount.isConnected) {
        state.turnstileWidgetId = window.turnstile.render(mount, {
          sitekey: key,
          callback: (token) => { state.captchaToken = token; },
          "error-callback": () => { state.captchaToken = null; },
          "expired-callback": () => { state.captchaToken = null; },
        });
      } else {
        setTimeout(renderWhenReady, 200);
      }
    };
    renderWhenReady();
  }

  function resetTurnstile() {
    if (window.turnstile && state.turnstileWidgetId !== null) {
      try { window.turnstile.reset(state.turnstileWidgetId); } catch {}
    }
    state.captchaToken = null;
  }

  // ---------- API ----------

  async function apiGet(path) {
    const r = await fetch(path, { credentials: "same-origin" });
    return r.json();
  }
  async function apiPost(path, body) {
    const r = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  }

  async function fetchWhoami() {
    try {
      const data = await apiGet("/api/whoami");
      if (data.verified) {
        state.identity = { verified: true, name: data.name, lang: data.lang };
        const nameInput = state.rootEl?.querySelector('input[name="name"]');
        if (nameInput) nameInput.value = data.name;
      } else {
        state.identity = { verified: false, name: null, lang: null };
      }
    } catch { /* offline / not deployed yet */ }
    updateIdentityBanner();
  }

  const PAGE_SIZE = 50;

  async function fetchThread(offset = 0) {
    const threadId = threadIdFor(state.currentThread, state.currentLang);
    if (state.lastThreadKey !== threadId) {
      state.seenIds = new Set();
      state.lastThreadKey = threadId;
    }
    const list = state.rootEl.querySelector(".comments-list");
    if (offset === 0) {
      const loadingLabel = escapeHtml(t("loading"));
      list.innerHTML = `
        <div class="comment-skeleton" role="status" aria-label="${loadingLabel}">
          <div class="comment-skeleton-avatar"></div>
          <div class="comment-skeleton-line short"></div>
          <div class="comment-skeleton-line long"></div>
        </div>
        <div class="comment-skeleton" aria-hidden="true">
          <div class="comment-skeleton-avatar"></div>
          <div class="comment-skeleton-line short"></div>
          <div class="comment-skeleton-line long"></div>
        </div>`;
    }
    try {
      const data = await apiGet(
        `/api/comments?thread=${encodeURIComponent(threadId)}&limit=${PAGE_SIZE}&offset=${offset}`
      );
      const comments = data.comments || [];
      if (offset === 0) {
        renderList(comments, data.hasMore, data.total);
      } else {
        appendComments(comments, data.hasMore, data.total, offset);
      }
    } catch {
      if (offset === 0) {
        list.innerHTML = `<div class="comments-error">${escapeHtml(t("errorGeneric"))}</div>`;
      }
    }
  }

  // ---------- Render ----------

  function renderList(comments, hasMore = false, total = 0) {
    const list = state.rootEl.querySelector(".comments-list");
    if (!comments.length) {
      list.innerHTML = `<div class="comments-empty"><svg class="comments-empty-icon" aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>${escapeHtml(t("empty"))}</div>`;
      return;
    }
    const byId = new Map(comments.map(c => [c.id, c]));
    const topLevel = comments.filter(c => !c.parent_id || !byId.has(c.parent_id));
    list.innerHTML = "";
    for (const top of topLevel) {
      const group = document.createElement("div");
      group.className = "comment-group";
      group.appendChild(renderComment(top, byId, 0));
      const descendants = collectDescendants(top.id, comments);
      for (const d of descendants) {
        group.appendChild(renderComment(d, byId, 1));
      }
      list.appendChild(group);
    }
    if (hasMore) {
      list.appendChild(buildLoadMoreBtn(comments.length, total));
    }
  }

  function appendComments(comments, hasMore, total, offset) {
    const list = state.rootEl.querySelector(".comments-list");
    const oldBtn = list.querySelector(".comments-load-more");
    if (oldBtn) oldBtn.remove();
    const byId = new Map([...list.querySelectorAll("[data-id]")].map(el => [el.dataset.id, {}]).concat(comments.map(c => [c.id, c])));
    const newTopLevel = comments.filter(c => !c.parent_id || !byId.has(c.parent_id));
    for (const top of newTopLevel) {
      const group = document.createElement("div");
      group.className = "comment-group";
      group.appendChild(renderComment(top, new Map(comments.map(c => [c.id, c])), 0));
      const descendants = collectDescendants(top.id, comments);
      for (const d of descendants) {
        group.appendChild(renderComment(d, new Map(comments.map(c => [c.id, c])), 1));
      }
      list.appendChild(group);
    }
    if (hasMore) {
      list.appendChild(buildLoadMoreBtn(offset + comments.length, total));
    }
  }

  function buildLoadMoreBtn(loaded, total) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "comments-load-more";
    const labelFn = t("loadMore");
    btn.textContent = typeof labelFn === "function" ? labelFn(total - loaded) : `Load more (${total - loaded} remaining)`;
    btn.addEventListener("click", () => {
      btn.disabled = true;
      fetchThread(loaded);
    });
    return btn;
  }

  function collectDescendants(rootId, comments) {
    const out = [];
    const queue = [rootId];
    while (queue.length) {
      const parent = queue.shift();
      const replies = comments
        .filter(c => c.parent_id === parent)
        .sort((a, b) => a.created_at - b.created_at);
      for (const r of replies) {
        out.push(r);
        queue.push(r.id);
      }
    }
    return out;
  }

  function renderComment(c, byId, depth) {
    const el = document.createElement("article");
    const isNew = !state.seenIds.has(c.id);
    if (isNew) state.seenIds.add(c.id);
    el.className = "comment"
      + (depth > 0 ? " comment-reply" : "")
      + (isNew ? " is-new" : "");
    el.dataset.id = c.id;

    const hue = c.email_hash ? avatarHueFromName(c.email_hash) : null;
    const initial = avatarInitial(c.display_name);

    el.innerHTML = `
      <span class="comment-avatar" data-verified="${c.verified ? "true" : "false"}" ${hue !== null ? `style="--avatar-hue: ${hue};"` : 'data-color="none"'} aria-hidden="true">${escapeHtml(initial)}</span>
      <header class="comment-head">
        <span class="comment-author">${escapeHtml(c.display_name)}</span>
        ${c.verified ? `<span class="comment-verified" aria-label="${escapeHtml(t("verifiedBadge"))}" title="${escapeHtml(t("verifiedBadge"))}"><svg aria-hidden="true" width="0.9em" height="0.9em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>` : ""}
        <time class="comment-time" datetime="${new Date(c.created_at * 1000).toISOString()}">${escapeHtml(relativeTime(c.created_at))}</time>
      </header>
      <div class="comment-body">${autolink(c.body)}</div>
      <footer class="comment-actions">
        ${depth === 0 ? `<button class="comment-reply-btn" data-id="${escapeHtml(c.id)}" data-name="${escapeHtml(c.display_name)}"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg> ${escapeHtml(t("btnReply"))}</button>` : ""}
        <button class="comment-report-btn" data-id="${escapeHtml(c.id)}"><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg> ${escapeHtml(t("btnReport"))}</button>
      </footer>
    `;
    return el;
  }

  // ---------- Identity banner ----------

  function updateIdentityBanner() {
    const banner = state.rootEl.querySelector(".comments-identity");
    if (!banner) return;
    const nameInput = state.rootEl.querySelector('input[name="name"]');
    const verifiedHere = state.identity.verified && state.identity.lang === state.currentLang;
    // Banner only appears while the typed name still matches the verified name —
    // the server only attaches the badge when those agree (functions/api/comments/index.js:112),
    // so a divergent input would post anonymously and the banner would lie.
    const typed = (nameInput?.value || "").trim();
    if (verifiedHere && typed === state.identity.name) {
      banner.hidden = false;
      banner.querySelector(".identity-name").textContent = state.identity.name;
    } else {
      banner.hidden = true;
    }
  }

  // ---------- Form ----------

  function setFormStatus(text, isError = false) {
    const el = state.rootEl.querySelector(".form-status");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("error", !!isError);
  }

  function setReplyTarget(commentId, displayName) {
    const form = state.rootEl.querySelector(".comment-form");
    const indicator = form.querySelector(".form-reply-indicator");
    const cancelBtn = form.querySelector(".form-cancel-reply");
    if (commentId) {
      form.dataset.parentId = commentId;
      indicator.hidden = false;
      indicator.querySelector(".reply-target-name").textContent = displayName;
      cancelBtn.hidden = false;
      form.querySelector('textarea[name="body"]').focus();
      form.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      delete form.dataset.parentId;
      indicator.hidden = true;
      cancelBtn.hidden = true;
    }
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const form = ev.target;
    const fd = new FormData(form);

    const name = (fd.get("name") || "").toString().trim();
    const body = (fd.get("body") || "").toString().trim();
    const email = (fd.get("email") || "").toString().trim();
    const notifyOnReply = fd.get("notifyOnReply") === "on";
    const honeypot = (fd.get("website") || "").toString();
    const parentId = form.dataset.parentId || null;

    if (!name) { setFormStatus(t("errorNameRequired"), true); return; }
    if (!body) { setFormStatus(t("errorBodyRequired"), true); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormStatus(t("errorEmailFormat"), true); return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.dataset.origLabel = submitBtn.textContent;
    submitBtn.textContent = t("formSubmitting");
    setFormStatus("");

    const threadId = threadIdFor(state.currentThread, state.currentLang);
    const payload = {
      name, body, parent_id: parentId,
      email: email || undefined,
      notifyOnReply: !!(email && notifyOnReply),
      turnstileToken: state.captchaToken || undefined,
      website: honeypot,
    };

    try {
      const res = await apiPost(`/api/comments?thread=${encodeURIComponent(threadId)}`, payload);
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.origLabel;
      if (res.status >= 400) {
        const key = ERROR_KEY_MAP[res.data.error] || "errorGeneric";
        setFormStatus(t(key), true);
        resetTurnstile();
        return;
      }
      if (res.data.status === "needs_verification") {
        state.pendingVerify = {
          email, expiresAt: res.data.expiresAt,
          name, body, parentId, notifyOnReply,
          threadId: threadIdFor(state.currentThread, state.currentLang),
        };
        showVerifyModal();
        setFormStatus(t("statusNeedsVerify"));
        resetTurnstile();
        return;
      }
      // Posted!
      saveStoredIdentity({ name, email });
      form.querySelector('textarea[name="body"]').value = "";
      setReplyTarget(null);
      setFormStatus(t("statusPosted"));
      resetTurnstile();
      await fetchThread();
    } catch (e) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.origLabel;
      setFormStatus(t("errorGeneric"), true);
    }
  }

  // ---------- Verify modal ----------

  function showVerifyModal() {
    const modal = state.rootEl.querySelector(".comments-verify-modal");
    modal.hidden = false;
    const input = modal.querySelector(".verify-code-input");
    input.value = "";
    input.focus();
    setVerifyStatus("");
    startCountdown();
  }
  function hideVerifyModal() {
    const modal = state.rootEl.querySelector(".comments-verify-modal");
    modal.hidden = true;
    state.pendingVerify = null;
    stopCountdown();
  }
  function setVerifyStatus(text, isError = false) {
    const el = state.rootEl.querySelector(".verify-status");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("error", !!isError);
  }

  function startCountdown() {
    stopCountdown();
    const el = state.rootEl.querySelector(".verify-countdown");
    if (!el) return;
    function tick() {
      if (!state.pendingVerify) { stopCountdown(); return; }
      const remaining = state.pendingVerify.expiresAt - Math.floor(Date.now() / 1000);
      if (remaining <= 0) {
        el.textContent = t("errorCodeExpired");
        stopCountdown();
        return;
      }
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      el.textContent = `${m}:${s.toString().padStart(2, "0")}`;
    }
    tick();
    countdownInterval = setInterval(tick, 1000);
  }
  function stopCountdown() {
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    const el = state.rootEl?.querySelector(".verify-countdown");
    if (el) el.textContent = "";
  }

  async function handleResend() {
    if (!state.pendingVerify) return;
    const resendBtn = state.rootEl.querySelector(".verify-resend");
    if (resendBtn) resendBtn.disabled = true;
    setVerifyStatus("");
    const { email, name, body, parentId, notifyOnReply, threadId } = state.pendingVerify;
    const payload = {
      name, body, parent_id: parentId,
      email,
      notifyOnReply: !!(email && notifyOnReply),
      turnstileToken: state.captchaToken || undefined,
    };
    try {
      const res = await apiPost(`/api/comments?thread=${encodeURIComponent(threadId)}`, payload);
      if (resendBtn) resendBtn.disabled = false;
      if (res.status >= 400) {
        const key = ERROR_KEY_MAP[res.data.error] || "errorGeneric";
        setVerifyStatus(t(key), true);
        resetTurnstile();
        return;
      }
      if (res.data.status === "needs_verification") {
        state.pendingVerify.expiresAt = res.data.expiresAt;
        startCountdown();
        setVerifyStatus(t("statusNeedsVerify"));
        resetTurnstile();
      }
    } catch {
      if (resendBtn) resendBtn.disabled = false;
      setVerifyStatus(t("errorGeneric"), true);
    }
  }

  async function handleVerifySubmit() {
    if (!state.pendingVerify) return;
    const code = state.rootEl.querySelector(".verify-code-input").value.trim();
    if (!/^\d{6}$/.test(code)) { setVerifyStatus(t("errorCodeFormat"), true); return; }

    const submit = state.rootEl.querySelector(".verify-submit");
    submit.disabled = true;
    try {
      const res = await apiPost("/api/verify", { code, email: state.pendingVerify.email });
      submit.disabled = false;
      if (res.status >= 400) {
        const key = ERROR_KEY_MAP[res.data.error] || "errorGeneric";
        setVerifyStatus(t(key), true);
        return;
      }
      // Verified! Hide modal, refresh whoami + thread.
      hideVerifyModal();
      const nameInput = state.rootEl.querySelector('input[name="name"]');
      const emailInput = state.rootEl.querySelector('input[name="email"]');
      saveStoredIdentity({ name: nameInput.value, email: emailInput.value });
      nameInput.value = nameInput.value; // keep
      const bodyEl = state.rootEl.querySelector('textarea[name="body"]');
      if (bodyEl) bodyEl.value = "";
      setReplyTarget(null);
      setFormStatus(t("statusPosted"));
      await fetchWhoami();
      await fetchThread();
    } catch {
      submit.disabled = false;
      setVerifyStatus(t("errorGeneric"), true);
    }
  }

  // ---------- Report ----------

  function showReportModal(commentId) {
    pendingReportId = commentId;
    const modal = state.rootEl.querySelector(".comments-report-modal");
    modal.hidden = false;
    modal.querySelector(".report-reason-input").value = "";
    setReportStatus("");
    modal.querySelector(".report-submit").focus();
  }
  function hideReportModal() {
    const modal = state.rootEl.querySelector(".comments-report-modal");
    modal.hidden = true;
    pendingReportId = null;
  }
  function setReportStatus(text, isError = false) {
    const el = state.rootEl.querySelector(".report-status");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("error", !!isError);
  }
  async function handleReportSubmit() {
    if (!pendingReportId) return;
    const modal = state.rootEl.querySelector(".comments-report-modal");
    const reason = modal.querySelector(".report-reason-input").value.trim() || null;
    const submitBtn = modal.querySelector(".report-submit");
    submitBtn.disabled = true;
    try {
      const res = await apiPost(`/api/comments/${encodeURIComponent(pendingReportId)}/report`, { reason });
      submitBtn.disabled = false;
      if (res.status >= 400) { setReportStatus(t("errorGeneric"), true); return; }
      if (res.data.status === "already_reported") {
        setReportStatus(t("reportAlready"), true);
      } else {
        setReportStatus(t("reportThanks"));
        setTimeout(hideReportModal, 1500);
      }
    } catch {
      submitBtn.disabled = false;
      setReportStatus(t("errorGeneric"), true);
    }
  }

  function handleReport(commentId) {
    showReportModal(commentId);
  }

  // ---------- Thread switcher ----------

  function populateChapterSelect() {
    const select = state.rootEl.querySelector(".chapter-select");
    if (!select) return;
    const current = select.value;
    select.innerHTML = "";

    const mainOpt = document.createElement("option");
    mainOpt.value = "main";
    mainOpt.textContent = t("mainOption");
    select.appendChild(mainOpt);

    const chapters = Array.from(document.querySelectorAll("#manuscript-container .chapter h1"));
    state.chapters = chapters.map((h, idx) => ({ index: idx, title: h.textContent.trim() }));
    for (const ch of state.chapters) {
      const opt = document.createElement("option");
      opt.value = String(ch.index);
      opt.textContent = `${ch.index + 1}. ${ch.title}`;
      select.appendChild(opt);
    }

    // Restore selection.
    if (state.currentThread.kind === "main") {
      select.value = "main";
    } else {
      select.value = String(state.currentThread.index);
    }
  }

  function setThread(thread) {
    state.currentThread = thread;
    const select = state.rootEl.querySelector(".chapter-select");
    if (select) select.value = thread.kind === "main" ? "main" : String(thread.index);
    fetchThread();
  }

  // ---------- Label refresh ----------

  function refreshLabels() {
    const root = state.rootEl;
    if (!root) return;
    root.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.dataset.i18n;
      const val = t(key);
      if (typeof val === "string") el.textContent = val;
    });
    root.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      const val = t(key);
      if (typeof val === "string") el.placeholder = val;
    });
    root.querySelectorAll("[data-i18n-href]").forEach(el => {
      const key = el.dataset.i18nHref;
      const val = t(key);
      if (typeof val === "string") el.href = val;
    });
    // Specific updates.
    populateChapterSelect();
    updateIdentityBanner();
  }

  // ---------- Build DOM ----------

  function buildDom(drawerContent) {
    drawerContent.innerHTML = `
      <div class="comments-root">
        <div class="comments-main">
          <div class="comments-identity" hidden>
            <span data-i18n="identityVerifiedAs">Du schreibst als</span>
            <strong class="identity-name"></strong>
          </div>

          <div class="comments-list" aria-live="polite"></div>
        </div>

        <div class="comments-compose">
          <div class="comments-switcher">
            <label class="chapter-select-label" data-i18n="chapterSelect">Kapitel</label>
            <select class="chapter-select" aria-label="Thread"></select>
          </div>

          <form class="comment-form" novalidate>
            <div class="form-reply-indicator" hidden>
              <span data-i18n="replyingTo">Antwort an</span>
              <strong class="reply-target-name"></strong>
              <button type="button" class="form-cancel-reply" data-i18n="formCancelReply">Antwort abbrechen</button>
            </div>
            <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
            <label class="form-field">
              <span data-i18n="formName">Name</span>
              <input name="name" required maxlength="60" autocomplete="nickname">
            </label>
            <label class="form-field">
              <span data-i18n="formEmail">E-Mail (optional)</span>
              <input name="email" type="email" autocomplete="email" maxlength="254">
            </label>
            <small class="form-hint" data-i18n="formEmailHint"></small>
            <label class="form-field form-field-checkbox">
              <input type="checkbox" name="notifyOnReply">
              <span data-i18n="formNotify">Benachrichtige mich bei Antworten</span>
            </label>
            <label class="form-field">
              <span data-i18n="formBody">Kommentar</span>
              <textarea name="body" required maxlength="2000" rows="4"></textarea>
            </label>
            <div class="form-turnstile-mount"></div>
            <div class="form-row">
              <button type="submit" data-i18n="formSubmit">Absenden</button>
            </div>
            <small class="form-status" aria-live="polite"></small>
            <small class="form-footer">
              <a href="privacy-de.html" data-i18n="privacyLink" data-i18n-href="privacyHref" target="_blank" rel="noopener">Datenschutz</a>
            </small>
          </form>
        </div>

        <div class="comments-verify-modal" hidden role="dialog" aria-modal="true">
          <div class="comments-verify-box">
            <p data-i18n="verifyPrompt">Wir haben dir einen 6-stelligen Code geschickt.</p>
            <input class="verify-code-input" inputmode="numeric" pattern="\\d{6}" maxlength="6" autocomplete="one-time-code" aria-label="Code">
            <div class="form-row">
              <button type="button" class="verify-submit" data-i18n="verifySubmit">Bestätigen</button>
              <button type="button" class="verify-cancel" data-i18n="verifyCancel">Abbrechen</button>
            </div>
            <div class="verify-footer">
              <small class="verify-countdown" aria-live="polite"></small>
              <button type="button" class="verify-resend" data-i18n="verifyResend">Code erneut anfordern</button>
            </div>
            <small class="verify-status" aria-live="polite"></small>
          </div>
        </div>

        <div class="comments-report-modal" hidden role="dialog" aria-modal="true">
          <div class="comments-report-box">
            <p data-i18n="reportConfirm">Diesen Kommentar melden?</p>
            <label class="form-field">
              <span data-i18n="reportPrompt">Grund (optional):</span>
              <textarea class="report-reason-input" maxlength="500" rows="3"></textarea>
            </label>
            <div class="form-row">
              <button type="button" class="report-submit" data-i18n="btnReport">Melden</button>
              <button type="button" class="report-cancel" data-i18n="verifyCancel">Abbrechen</button>
            </div>
            <small class="report-status" aria-live="polite"></small>
          </div>
        </div>
      </div>
    `;
  }

  // ---------- Wiring ----------

  function wireEvents() {
    const root = state.rootEl;

    root.querySelector(".chapter-select").addEventListener("change", (ev) => {
      const v = ev.target.value;
      if (v === "main") setThread({ kind: "main" });
      else setThread({ kind: "ch", index: parseInt(v, 10) });
    });

    const form = root.querySelector(".comment-form");
    form.addEventListener("submit", handleSubmit);

    // Re-evaluate the verified banner whenever the name field changes —
    // keeps the "posting as ✓" cue honest if the user edits away from their verified name.
    const nameInput = form.querySelector('input[name="name"]');
    nameInput.addEventListener("input", updateIdentityBanner);

    // Lazy-load Turnstile when the user starts engaging with the form.
    const bodyTa = form.querySelector('textarea[name="body"]');
    bodyTa.addEventListener("focus", ensureTurnstile, { once: true });

    root.querySelector(".form-cancel-reply").addEventListener("click", () => setReplyTarget(null));

    root.querySelector(".comments-list").addEventListener("click", (ev) => {
      const reply = ev.target.closest(".comment-reply-btn");
      if (reply) {
        setReplyTarget(reply.dataset.id, reply.dataset.name);
        return;
      }
      const report = ev.target.closest(".comment-report-btn");
      if (report) {
        handleReport(report.dataset.id);
      }
    });

    root.querySelector(".verify-submit").addEventListener("click", handleVerifySubmit);
    root.querySelector(".verify-cancel").addEventListener("click", hideVerifyModal);
    root.querySelector(".verify-resend").addEventListener("click", handleResend);
    root.querySelector(".verify-code-input").addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); handleVerifySubmit(); }
    });

    root.querySelector(".report-submit").addEventListener("click", handleReportSubmit);
    root.querySelector(".report-cancel").addEventListener("click", hideReportModal);
  }

  // ---------- Public API ----------

  const CommentsUI = {
    init({ drawerEl, getCurrentLang }) {
      state.drawerEl = drawerEl;
      state.currentLang = getCurrentLang() || "de";
      const drawerContent = drawerEl.querySelector(".drawer-content");
      buildDom(drawerContent);
      state.rootEl = drawerContent.querySelector(".comments-root");
      // Restore name/email from localStorage.
      const stored = loadStoredIdentity();
      const nameInput = state.rootEl.querySelector('input[name="name"]');
      const emailInput = state.rootEl.querySelector('input[name="email"]');
      if (nameInput) nameInput.value = stored.name;
      if (emailInput) emailInput.value = stored.email;
      refreshLabels();
      wireEvents();
      fetchWhoami();
    },

    open(chapterIndex) {
      if (typeof chapterIndex === "number" && Number.isFinite(chapterIndex)) {
        state.currentThread = { kind: "ch", index: chapterIndex };
      } else if (state.currentThread.kind === "ch") {
        // Keep last chosen thread.
      } else {
        state.currentThread = { kind: "main" };
      }
      populateChapterSelect();
      const select = state.rootEl.querySelector(".chapter-select");
      if (state.currentThread.kind === "main") select.value = "main";
      else select.value = String(state.currentThread.index);
      fetchThread();
    },

    setLang(lang) {
      state.currentLang = lang;
      refreshLabels();
      fetchWhoami();
      fetchThread();
    },

    refreshChapters() {
      populateChapterSelect();
    },
  };

  window.CommentsUI = CommentsUI;
})();
