import { json, jsonError, readJson } from "../../../_lib/http.js";
import { requireAccessUser, logAdminAction } from "../../../_lib/admin.js";

export async function onRequestPost({ request, env, params }) {
  const access = await requireAccessUser(request, env);
  if (!access.ok) return jsonError("forbidden", access.status, access.reason);

  const identityId = params.id;
  const payload = (await readJson(request)) || {};
  const reason = typeof payload.reason === "string" ? payload.reason.slice(0, 500) : null;
  const untilSec = Number.isFinite(payload.untilSec) ? Math.floor(payload.untilSec) : null;

  const ident = await env.DB.prepare(`SELECT id FROM identities WHERE id = ?`).bind(identityId).first();
  if (!ident) return jsonError("not_found", 404, "not_found");

  // Pull representative ip_hash from this identity's most recent comment for IP-level ban too.
  const recent = await env.DB.prepare(
    `SELECT ip_hash FROM comments WHERE identity_id = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(identityId).first();

  const banId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT INTO bans (id, ip_hash, identity_id, reason, until, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(banId, recent?.ip_hash || null, identityId, reason, untilSec, now).run();

  // Hide all visible comments by this identity going forward.
  await env.DB.prepare(`UPDATE comments SET status = 'hidden' WHERE identity_id = ? AND status = 'visible'`).bind(identityId).run();

  await logAdminAction(env, { actor: access.email, action: "identity.ban", targetId: identityId, details: { reason, untilSec } });
  return json({ ok: true });
}
