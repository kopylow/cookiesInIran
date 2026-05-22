import { json } from "./_lib/http.js";
import { lookupSession } from "./_lib/session.js";

export async function onRequestGet({ request, env }) {
  const identityId = await lookupSession(env, request);
  if (!identityId) return json({ ok: true, verified: false });
  const ident = await env.DB.prepare(
    `SELECT id, name, lang FROM identities WHERE id = ?`
  ).bind(identityId).first();
  if (!ident) return json({ ok: true, verified: false });
  return json({ ok: true, verified: true, name: ident.name, lang: ident.lang });
}
