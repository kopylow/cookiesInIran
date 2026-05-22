import { json, jsonError } from "../_lib/http.js";
import { requireAccessUser } from "../_lib/admin.js";

export async function onRequestGet({ request, env }) {
  const access = await requireAccessUser(request, env);
  if (!access.ok) return jsonError("forbidden", access.status, access.reason);

  const url = new URL(request.url);
  const lang = url.searchParams.get("lang") || null;
  const status = url.searchParams.get("status") || null;
  const thread = url.searchParams.get("thread") || null;
  const before = parseInt(url.searchParams.get("before") || "0", 10) || null;
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);

  const conditions = [];
  const binds = [];

  if (lang) { conditions.push("c.lang = ?"); binds.push(lang); }
  if (status) { conditions.push("c.status = ?"); binds.push(status); }
  if (thread) { conditions.push("c.thread_id = ?"); binds.push(thread); }
  if (before) { conditions.push("c.created_at < ?"); binds.push(before); }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  binds.push(limit + 1); // fetch one extra to detect next page

  const { results = [] } = await env.DB.prepare(
    `SELECT c.id, c.thread_id, c.lang, c.display_name, c.body, c.status,
            c.created_at, c.identity_id, c.parent_id
     FROM comments c
     ${where}
     ORDER BY c.created_at DESC
     LIMIT ?`
  ).bind(...binds).all();

  const hasMore = results.length > limit;
  const rows = hasMore ? results.slice(0, limit) : results;
  const nextBefore = hasMore ? rows[rows.length - 1].created_at : null;

  return json({ ok: true, comments: rows, next_before: nextBefore });
}
