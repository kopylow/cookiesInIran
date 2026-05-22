import { json, jsonError, getClientIp, readJson } from "../_lib/http.js";
import {
  parseThreadId, validateName, validateBody, validateEmail, isHoneypotTriggered,
} from "../_lib/validation.js";
import { hashIp, hashEmail, sha256Hex, randomNumericCode } from "../_lib/hash.js";
import { verifyTurnstile } from "../_lib/turnstile.js";
import { rateLimit, rateLimitAll, isBypassed } from "../_lib/ratelimit.js";
import { lookupSession } from "../_lib/session.js";
import {
  sendVerificationCode, sendReplyNotification, encryptEmail, decryptEmail,
} from "../_lib/email.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const thread = parseThreadId(env, url.searchParams.get("thread"));
  if (!thread) return jsonError("invalid thread", 400, "invalid_thread");

  const { results = [] } = await env.DB.prepare(
    `SELECT c.id, c.parent_id, c.display_name, c.body, c.created_at, c.identity_id, i.email_hash
     FROM comments c
     LEFT JOIN identities i ON i.id = c.identity_id
     WHERE c.thread_id = ? AND c.status = 'visible'
     ORDER BY c.created_at ASC
     LIMIT 1000`
  ).bind(thread.id).all();

  const comments = results.map(c => ({
    id: c.id,
    parent_id: c.parent_id,
    display_name: c.display_name,
    body: c.body,
    created_at: c.created_at,
    verified: !!c.identity_id,
    email_hash: c.email_hash || null,
  }));

  return json({ ok: true, thread: thread.id, comments });
}

export async function onRequestPost({ request, env }) {
  const payload = await readJson(request);
  if (!payload) return jsonError("invalid_payload", 400);

  // Honeypot — return success but drop silently so bots get no signal.
  if (isHoneypotTriggered(payload)) return json({ ok: true, status: "posted", dropped: true });

  const url = new URL(request.url);
  const thread = parseThreadId(env, url.searchParams.get("thread") || payload.thread);
  if (!thread) return jsonError("invalid_thread", 400, "invalid_thread");

  const name = validateName(payload.name);
  if (!name) return jsonError("invalid_name", 400, "invalid_name");
  const text = validateBody(payload.body);
  if (!text) return jsonError("invalid_body", 400, "invalid_body");

  const emailRaw = payload.email;
  const email = emailRaw ? validateEmail(emailRaw) : null;
  if (emailRaw && !email) return jsonError("invalid_email", 400, "invalid_email");

  let parentId = null;
  if (payload.parent_id) {
    const parent = await env.DB.prepare(
      `SELECT id, thread_id, status FROM comments WHERE id = ?`
    ).bind(payload.parent_id).first();
    if (!parent || parent.thread_id !== thread.id || parent.status !== "visible") {
      return jsonError("invalid_parent", 400, "invalid_parent");
    }
    parentId = parent.id;
  }

  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env);

  // Ban check.
  const ban = await env.DB.prepare(
    `SELECT id FROM bans WHERE ip_hash = ? AND (until IS NULL OR until > ?) LIMIT 1`
  ).bind(ipHash, Math.floor(Date.now() / 1000)).first();
  if (ban) return jsonError("banned", 403, "banned");

  // Per-IP post rate limit.
  if (!isBypassed(env, ip)) {
    const rl = await rateLimit(env.KV_RATELIMIT, `post:ip:${ipHash}`, 5, 600);
    if (!rl.allowed) {
      return jsonError("rate_limited", 429, "rate_limited", { "retry-after": String(rl.retryAfterSec) });
    }
  }

  // Turnstile (skipped if no TURNSTILE_SECRET configured).
  const ts = await verifyTurnstile(env, payload.turnstileToken, ip);
  if (!ts.ok) return jsonError("captcha_failed", 400, "captcha_failed");

  // Cookie session lookup — does it match the (name, lang) being posted?
  const sessionIdentityId = await lookupSession(env, request);
  let verifiedIdentityId = null;
  let sessionEmailHash = null;
  if (sessionIdentityId) {
    const ident = await env.DB.prepare(
      `SELECT id, name, lang, email_hash FROM identities WHERE id = ?`
    ).bind(sessionIdentityId).first();
    if (ident && ident.lang === thread.lang && ident.name === name) {
      verifiedIdentityId = ident.id;
      sessionEmailHash = ident.email_hash;
    }
  }

  const notifyEmail = (email && payload.notifyOnReply === true) ? email : null;

  // Already verified by cookie → post immediately.
  if (verifiedIdentityId) {
    return await postImmediate(env, { thread, name, text, parentId, ipHash, identityId: verifiedIdentityId, notifyEmail, request, emailHash: sessionEmailHash });
  }

  // Check if name is already claimed by an identity
  const existing = await env.DB.prepare(
    `SELECT id, email_hash FROM identities WHERE name = ? AND lang = ? LIMIT 1`
  ).bind(name, thread.lang).first();

  let emailHash = null;
  if (email) {
    emailHash = await hashEmail(email, env);
  }

  if (existing) {
    // Name is claimed.
    if (!email || existing.email_hash !== emailHash) {
      return jsonError("name_protected", 409, "name_protected");
    }
    // Name+email matches existing identity → require 6-digit verification.
  } else {
    // Name is available.
    if (!email) {
      // No email → anonymous immediate post.
      return await postImmediate(env, { thread, name, text, parentId, ipHash, identityId: null, notifyEmail: null, request, emailHash: null });
    } else {
      // First post with this name+email: register identity (unverified), post immediately.
      const emailEnc = await encryptEmail(env, email);
      const newId = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare(
        `INSERT OR IGNORE INTO identities (id, name, lang, email_hash, email_enc, verified_at, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)`
      ).bind(newId, name, thread.lang, emailHash, emailEnc, now).run();
      return await postImmediate(env, { thread, name, text, parentId, ipHash, identityId: newId, notifyEmail, request, emailHash });
    }
  }

  // Code-request rate limits.
  if (!isBypassed(env, ip)) {
    const codeRl = await rateLimitAll(env.KV_RATELIMIT, `code:${emailHash}`, [
      { label: "h", limit: 3, windowSec: 3600 },
      { label: "d", limit: 10, windowSec: 86400 },
    ]);
    if (!codeRl.allowed) {
      return jsonError("rate_limited", 429, "rate_limited", { "retry-after": String(codeRl.retryAfterSec) });
    }
    const codeIpRl = await rateLimit(env.KV_RATELIMIT, `code:ip:${ipHash}`, 10, 3600);
    if (!codeIpRl.allowed) {
      return jsonError("rate_limited", 429, "rate_limited", { "retry-after": String(codeIpRl.retryAfterSec) });
    }
  }

  // Generate + store + send code.
  const code = randomNumericCode(6);
  const codeHash = await sha256Hex(code);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 15 * 60;
  const heldComment = {
    thread_id: thread.id,
    lang: thread.lang,
    parent_id: parentId,
    display_name: name,
    body: text,
    notify_email: notifyEmail,
    ip_hash: ipHash,
  };

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM pending_verifications WHERE email_hash = ? AND name = ? AND lang = ?`)
      .bind(emailHash, name, thread.lang),
    env.DB.prepare(
      `INSERT INTO pending_verifications (code_hash, email, email_hash, name, lang, comment_json, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(codeHash, email, emailHash, name, thread.lang, JSON.stringify(heldComment), expiresAt, now),
  ]);

  try {
    await sendVerificationCode(env, { to: email, code, lang: thread.lang });
  } catch (e) {
    console.error("verification email send failed:", e);
    return jsonError("email_send_failed", 502, "email_send_failed");
  }

  return json({ ok: true, status: "needs_verification", expiresAt });
}

async function postImmediate(env, { thread, name, text, parentId, ipHash, identityId, notifyEmail, request, emailHash }) {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const notifyEnc = notifyEmail ? await encryptEmail(env, notifyEmail) : null;

  await env.DB.prepare(
    `INSERT INTO comments (id, thread_id, lang, parent_id, identity_id, display_name, body, notify_email_enc, ip_hash, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'visible', ?)`
  ).bind(id, thread.id, thread.lang, parentId, identityId, name, text, notifyEnc, ipHash, now).run();

  // Fire-and-forget reply notification to the parent's notify_email_enc.
  if (parentId) {
    try {
      const parent = await env.DB.prepare(
        `SELECT notify_email_enc, display_name FROM comments WHERE id = ?`
      ).bind(parentId).first();
      if (parent?.notify_email_enc) {
        const to = await decryptEmail(env, parent.notify_email_enc);
        if (to) {
          const origin = request ? new URL(request.url).origin : "";
          await sendReplyNotification(env, {
            to,
            parentName: parent.display_name,
            replyName: name,
            replyBody: text,
            lang: thread.lang,
            url: `${origin}/#${thread.id}`,
          });
        }
      }
    } catch (e) {
      console.error("reply notification failed:", e);
    }
  }

  return json({
    ok: true,
    status: "posted",
    comment: {
      id,
      parent_id: parentId,
      display_name: name,
      body: text,
      created_at: now,
      verified: !!identityId,
      email_hash: emailHash || null,
    },
  });
}
