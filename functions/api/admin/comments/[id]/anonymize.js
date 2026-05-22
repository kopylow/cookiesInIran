import { json, jsonError } from "../../../_lib/http.js";
import { requireAccessUser, logAdminAction } from "../../../_lib/admin.js";

// DSGVO right-to-delete: scrub PII but keep the comment row so threading
// stays intact. Replies still resolve to a parent; the parent just reads
// "[gelöscht]".
export async function onRequestPost({ request, env, params }) {
  const access = await requireAccessUser(request, env);
  if (!access.ok) return jsonError("forbidden", access.status, access.reason);

  const id = params.id;
  const res = await env.DB.prepare(
    `UPDATE comments
     SET display_name = '[gelöscht]', body = '[gelöscht]', identity_id = NULL,
         notify_email_enc = NULL, status = 'hidden'
     WHERE id = ?`
  ).bind(id).run();
  if (!res.meta.changes) return jsonError("not_found", 404, "not_found");

  await logAdminAction(env, { actor: access.email, action: "comment.anonymize", targetId: id });
  return json({ ok: true });
}
