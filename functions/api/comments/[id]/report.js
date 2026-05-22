import { json, jsonError, getClientIp, readJson } from "../../_lib/http.js";
import { hashIp } from "../../_lib/hash.js";
import { rateLimit, isBypassed } from "../../_lib/ratelimit.js";
import { validateReason } from "../../_lib/validation.js";

export async function onRequestPost({ request, env, params }) {
  const commentId = params.id;
  if (!commentId || typeof commentId !== "string") return jsonError("invalid_id", 400);

  const payload = (await readJson(request)) || {};
  const reason = validateReason(payload.reason);

  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env);

  if (!isBypassed(env, ip)) {
    const rl = await rateLimit(env.KV_RATELIMIT, `report:ip:${ipHash}`, 10, 3600);
    if (!rl.allowed) {
      return jsonError("rate_limited", 429, "rate_limited", { "retry-after": String(rl.retryAfterSec) });
    }
  }

  const comment = await env.DB.prepare(`SELECT id FROM comments WHERE id = ?`).bind(commentId).first();
  if (!comment) return jsonError("not_found", 404, "not_found");

  // Dedupe per (comment, ip).
  const existing = await env.DB.prepare(
    `SELECT id FROM reports WHERE comment_id = ? AND ip_hash = ? AND resolved_at IS NULL LIMIT 1`
  ).bind(commentId, ipHash).first();
  if (existing) return json({ ok: true, status: "already_reported" });

  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT INTO reports (id, comment_id, reason, ip_hash, created_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(id, commentId, reason, ipHash, now).run();

  return json({ ok: true, status: "reported" });
}
