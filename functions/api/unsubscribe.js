import { generateUnsubscribeToken } from "./_lib/email.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const commentId = url.searchParams.get("id");
  const token = url.searchParams.get("token");

  if (!commentId || !token) return htmlResponse(400, "Missing parameters.");

  const expected = await generateUnsubscribeToken(env, commentId);
  if (token !== expected) return htmlResponse(403, "Invalid unsubscribe link.");

  const res = await env.DB.prepare(
    `UPDATE comments SET notify_email_enc = NULL WHERE id = ? AND notify_email_enc IS NOT NULL`
  ).bind(commentId).run();

  if (!res.meta.changes) {
    // Already unsubscribed or comment not found — treat as success to avoid leaking info.
    return htmlResponse(200, "You have been unsubscribed (or were already unsubscribed).");
  }
  return htmlResponse(200, "You have been unsubscribed from reply notifications for this comment.");
}

function htmlResponse(status, message) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Unsubscribe</title>` +
    `<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:4rem auto;padding:0 1rem;line-height:1.5}</style></head>` +
    `<body><p>${message}</p><p><a href="/">← Back to Cookies in Iran</a></p></body></html>`,
    { status, headers: { "content-type": "text/html;charset=utf-8" } }
  );
}
