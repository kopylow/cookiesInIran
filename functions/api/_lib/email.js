// Resend transactional email. Account must be set to EU region in Resend
// dashboard for DSGVO compliance; the API endpoint stays the same.

const RESEND_URL = "https://api.resend.com/emails";

const templates = {
  de: (code, name) => ({
    subject: "Dein Bestätigungscode für die Kommentare",
    text: `Hallo ${name},\n\ndein Bestätigungscode lautet:\n\n  ${code}\n\nGib ihn im Kommentar-Formular ein, um deinen Kommentar zu veröffentlichen. Der Code ist 15 Minuten gültig.\n\nFalls du das nicht warst, kannst du diese E-Mail ignorieren.\n\n— Kekse im Iran\n`,
  }),
  en: (code, name) => ({
    subject: "Your confirmation code for comments",
    text: `Hi ${name},\n\nyour confirmation code is:\n\n  ${code}\n\nEnter it in the comment form to publish your comment. The code is valid for 15 minutes.\n\nIf this wasn't you, you can ignore this email.\n\n— Cookies in Iran\n`,
  }),
  ru: (code, name) => ({
    subject: "Ваш код подтверждения для комментариев",
    text: `Здравствуйте, ${name},\n\nваш код подтверждения:\n\n  ${code}\n\nВведите его в форме комментария, чтобы опубликовать комментарий. Код действителен 15 минут.\n\nЕсли это были не вы, просто проигнорируйте это письмо.\n\n— Cookies in Iran\n`,
  }),
  fa: (code, name) => ({
    subject: "کد تأیید شما برای نظرات",
    text: `سلام ${name}،\n\nکد تأیید شما:\n\n  ${code}\n\nآن را در فرم نظر وارد کنید تا نظرتان منتشر شود. این کد ۱۵ دقیقه اعتبار دارد.\n\nاگر شما این درخواست را نفرستاده‌اید، می‌توانید این پیام را نادیده بگیرید.\n\n— Cookies in Iran\n`,
  }),
};

const replyTemplates = {
  de: ({ parentName, replyName, snippet, url }) => ({
    subject: `${replyName} hat auf deinen Kommentar geantwortet`,
    text: `Hallo ${parentName},\n\n${replyName} hat auf deinen Kommentar geantwortet:\n\n  „${snippet}"\n\nLies die ganze Antwort hier: ${url}\n\nFalls du keine weiteren Benachrichtigungen mehr möchtest, ignoriere diese E-Mail einfach — bei zukünftigen Kommentaren kannst du die Checkbox weglassen.\n\n— Kekse im Iran\n`,
  }),
  en: ({ parentName, replyName, snippet, url }) => ({
    subject: `${replyName} replied to your comment`,
    text: `Hi ${parentName},\n\n${replyName} replied to your comment:\n\n  "${snippet}"\n\nRead the full reply here: ${url}\n\nIf you don't want further notifications, simply ignore this email — for future comments, leave the checkbox unchecked.\n\n— Cookies in Iran\n`,
  }),
  ru: ({ parentName, replyName, snippet, url }) => ({
    subject: `${replyName} ответил(а) на ваш комментарий`,
    text: `Здравствуйте, ${parentName},\n\n${replyName} ответил(а) на ваш комментарий:\n\n  «${snippet}»\n\nПрочитать полный ответ: ${url}\n\nЕсли вы больше не хотите получать такие уведомления, просто проигнорируйте это письмо — в будущих комментариях не устанавливайте флажок.\n\n— Cookies in Iran\n`,
  }),
  fa: ({ parentName, replyName, snippet, url }) => ({
    subject: `${replyName} به نظر شما پاسخ داد`,
    text: `سلام ${parentName}،\n\n${replyName} به نظر شما پاسخ داد:\n\n  «${snippet}»\n\nپاسخ کامل را اینجا بخوانید: ${url}\n\nاگر دیگر این اعلان‌ها را نمی‌خواهید، این پیام را نادیده بگیرید — برای نظرات بعدی، تیک مربوطه را نزنید.\n\n— Cookies in Iran\n`,
  }),
};

export async function sendReplyNotification(env, { to, parentName, replyName, replyBody, lang, url }) {
  if (!env.RESEND_API_KEY) {
    console.log(`[email-dev] reply-notify to=${to} lang=${lang} from=${replyName}`);
    return { dev: true };
  }
  const snippet = replyBody.slice(0, 240) + (replyBody.length > 240 ? "…" : "");
  const tpl = (replyTemplates[lang] || replyTemplates.en)({ parentName, replyName, snippet, url });
  const r = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to,
      subject: tpl.subject,
      text: tpl.text,
      ...(env.RESEND_REPLY_TO ? { reply_to: env.RESEND_REPLY_TO } : {}),
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Resend (reply) ${r.status}: ${body}`);
  }
  return r.json();
}

export async function sendVerificationCode(env, { to, code, lang, name }) {
  if (!env.RESEND_API_KEY) {
    // Dev mode — log only.
    console.log(`[email-dev] to=${to} lang=${lang} code=${code}`);
    return { dev: true };
  }
  const tpl = (templates[lang] || templates.en)(code, name);
  const r = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to,
      subject: tpl.subject,
      text: tpl.text,
      ...(env.RESEND_REPLY_TO ? { reply_to: env.RESEND_REPLY_TO } : {}),
    }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Resend ${r.status}: ${body}`);
  }
  return r.json();
}

// --- AES-GCM email encryption (for notify_email_enc & identities.email_enc) ---

async function importKey(env) {
  if (!env.EMAIL_ENC_KEY) throw new Error("EMAIL_ENC_KEY not configured");
  const raw = Uint8Array.from(atob(env.EMAIL_ENC_KEY), c => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptEmail(env, email) {
  const key = await importKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(email));
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.length);
  return btoa(String.fromCharCode(...out));
}

export async function decryptEmail(env, blob) {
  if (!blob) return null;
  const bin = Uint8Array.from(atob(blob), c => c.charCodeAt(0));
  const iv = bin.slice(0, 12);
  const ct = bin.slice(12);
  const key = await importKey(env);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}
