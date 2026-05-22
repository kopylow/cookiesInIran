import { json, jsonError, getClientIp, readJson, isHttps } from "./_lib/http.js";
import { hashIp, hashEmail, sha256Hex } from "./_lib/hash.js";
import { validateCode, validateEmail } from "./_lib/validation.js";
import { rateLimit, isBypassed } from "./_lib/ratelimit.js";
import { createSession, buildSessionCookie } from "./_lib/session.js";
import { encryptEmail, decryptEmail, sendReplyNotification } from "./_lib/email.js";

export async function onRequestPost({ request, env }) {
  const payload = await readJson(request);
  if (!payload) return jsonError("invalid_payload", 400);

  const code = validateCode(payload.code);
  if (!code) return jsonError("invalid_code", 400, "invalid_code");
  const email = payload.email ? validateEmail(payload.email) : null;
  if (!email) return jsonError("invalid_email", 400, "invalid_email");

  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env);
  if (!isBypassed(env, ip)) {
    const rl = await rateLimit(env.KV_RATELIMIT, `verify:ip:${ipHash}`, 20, 600);
    if (!rl.allowed) {
      return jsonError("rate_limited", 429, "rate_limited", { "retry-after": String(rl.retryAfterSec) });
    }
  }

  const codeHash = await sha256Hex(code);
  const emailHash = await hashEmail(email, env);
  const now = Math.floor(Date.now() / 1000);

  const pending = await env.DB.prepare(
    `SELECT code_hash, email, email_hash, name, lang, comment_json, attempts, expires_at
     FROM pending_verifications
     WHERE code_hash = ? AND email_hash = ? LIMIT 1`
  ).bind(codeHash, emailHash).first();

  if (!pending) {
    // Wrong code — bump attempts on any in-flight pending for this email so
    // brute-forcing still costs attempts even when code doesn't match.
    await env.DB.prepare(
      `UPDATE pending_verifications SET attempts = attempts + 1
       WHERE email_hash = ? AND expires_at > ?`
    ).bind(emailHash, now).run();
    await env.DB.prepare(
      `DELETE FROM pending_verifications WHERE email_hash = ? AND attempts >= 5`
    ).bind(emailHash).run();
    return jsonError("code_invalid", 400, "code_invalid");
  }

  if (pending.expires_at <= now) {
    await env.DB.prepare(`DELETE FROM pending_verifications WHERE code_hash = ?`).bind(codeHash).run();
    return jsonError("code_expired", 400, "code_expired");
  }
  if (pending.attempts >= 5) {
    await env.DB.prepare(`DELETE FROM pending_verifications WHERE code_hash = ?`).bind(codeHash).run();
    return jsonError("code_invalid", 400, "code_invalid");
  }

  const heldComment = JSON.parse(pending.comment_json);

  // Find or create the identity for (name, lang).
  let identity = await env.DB.prepare(
    `SELECT id FROM identities WHERE name = ? AND lang = ? LIMIT 1`
  ).bind(pending.name, pending.lang).first();

  if (identity) {
    await env.DB.prepare(`UPDATE identities SET verified_at = ? WHERE id = ?`)
      .bind(now, identity.id).run();
  } else {
    const newId = crypto.randomUUID();
    const emailEnc = await encryptEmail(env, email);
    await env.DB.prepare(
      `INSERT INTO identities (id, name, lang, email_hash, email_enc, verified_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(newId, pending.name, pending.lang, emailHash, emailEnc, now, now).run();
    identity = { id: newId };
  }

  // Publish the held comment.
  const commentId = crypto.randomUUID();
  const notifyEnc = heldComment.notify_email ? await encryptEmail(env, heldComment.notify_email) : null;
  await env.DB.prepare(
    `INSERT INTO comments (id, thread_id, lang, parent_id, identity_id, display_name, body, notify_email_enc, ip_hash, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'visible', ?)`
  ).bind(
    commentId, heldComment.thread_id, heldComment.lang, heldComment.parent_id,
    identity.id, heldComment.display_name, heldComment.body, notifyEnc,
    heldComment.ip_hash, now,
  ).run();

  await env.DB.prepare(`DELETE FROM pending_verifications WHERE code_hash = ?`).bind(codeHash).run();

  // Reply notification to parent's opt-in email.
  if (heldComment.parent_id) {
    try {
      const parent = await env.DB.prepare(
        `SELECT notify_email_enc, display_name FROM comments WHERE id = ?`
      ).bind(heldComment.parent_id).first();
      if (parent?.notify_email_enc) {
        const to = await decryptEmail(env, parent.notify_email_enc);
        if (to) {
          const origin = new URL(request.url).origin;
          await sendReplyNotification(env, {
            to,
            parentName: parent.display_name,
            replyName: heldComment.display_name,
            replyBody: heldComment.body,
            lang: heldComment.lang,
            url: `${origin}/#${heldComment.thread_id}`,
          });
        }
      }
    } catch (e) { console.error("reply notif (verify):", e); }
  }

  // Issue session cookie so future posts skip verification.
  const sessionToken = await createSession(env, identity.id);
  return json(
    {
      ok: true,
      status: "posted",
      comment: {
        id: commentId,
        parent_id: heldComment.parent_id,
        display_name: heldComment.display_name,
        body: heldComment.body,
        created_at: now,
        verified: true,
        email_hash: pending.email_hash,
      },
    },
    200,
    { "set-cookie": buildSessionCookie(sessionToken, { secure: isHttps(request) }) },
  );
}
