import { json, jsonError } from "../../../_lib/http.js";
import { requireAccessUser, logAdminAction } from "../../../_lib/admin.js";

export async function onRequestPost({ request, env, params }) {
  const access = await requireAccessUser(request, env);
  if (!access.ok) return jsonError("forbidden", access.status, access.reason);

  const id = params.id;
  const now = Math.floor(Date.now() / 1000);
  const res = await env.DB.prepare(
    `UPDATE reports SET resolved_at = ? WHERE id = ? AND resolved_at IS NULL`
  ).bind(now, id).run();
  if (!res.meta.changes) return jsonError("not_found_or_already_resolved", 404, "not_found");

  await logAdminAction(env, { actor: access.email, action: "report.resolve", targetId: id });
  return json({ ok: true });
}
