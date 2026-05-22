import { json, jsonError } from "../_lib/http.js";
import { requireAccessUser } from "../_lib/admin.js";

export async function onRequestGet({ request, env }) {
  const access = await requireAccessUser(request, env);
  if (!access.ok) return jsonError("forbidden", access.status, access.reason);

  const url = new URL(request.url);
  const includeResolved = url.searchParams.get("resolved") === "1";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 500);

  const filter = includeResolved ? "" : "WHERE r.resolved_at IS NULL";
  const { results = [] } = await env.DB.prepare(
    `SELECT r.id AS report_id, r.reason, r.created_at AS reported_at, r.resolved_at,
            c.id AS comment_id, c.thread_id, c.lang, c.display_name, c.body, c.status, c.identity_id, c.created_at AS comment_created_at
     FROM reports r
     LEFT JOIN comments c ON c.id = r.comment_id
     ${filter}
     ORDER BY r.created_at DESC
     LIMIT ?`
  ).bind(limit).all();

  return json({ ok: true, reports: results });
}
