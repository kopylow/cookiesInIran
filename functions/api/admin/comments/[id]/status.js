import { json, jsonError, readJson } from "../../../_lib/http.js";
import { requireAccessUser, logAdminAction } from "../../../_lib/admin.js";

const ALLOWED = new Set(["visible", "hidden", "deleted"]);

export async function onRequestPost({ request, env, params }) {
  const access = await requireAccessUser(request, env);
  if (!access.ok) return jsonError("forbidden", access.status, access.reason);

  const id = params.id;
  const payload = (await readJson(request)) || {};
  const status = payload.status;
  if (!ALLOWED.has(status)) return jsonError("invalid_status", 400, "invalid_status");

  const res = await env.DB.prepare(`UPDATE comments SET status = ? WHERE id = ?`).bind(status, id).run();
  if (!res.meta.changes) return jsonError("not_found", 404, "not_found");

  await logAdminAction(env, { actor: access.email, action: `comment.${status}`, targetId: id });
  return json({ ok: true });
}
