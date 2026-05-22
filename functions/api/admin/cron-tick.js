import { json, jsonError } from "../_lib/http.js";

// External cron caller (separate Worker with cron, or GitHub Actions schedule)
// POSTs here with `Authorization: Bearer ${CRON_SECRET}`. Pages Functions have
// no native cron, so this endpoint is the seam between an external trigger and
// the project's housekeeping logic.

const REPORT_RETENTION_SECONDS = 90 * 24 * 60 * 60;

export async function onRequestPost({ request, env }) {
  const auth = request.headers.get("authorization") || "";
  const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
  if (!expected || !timingSafeEq(auth, expected)) {
    return jsonError("forbidden", 401, "bad_cron_secret");
  }

  const now = Math.floor(Date.now() / 1000);
  const reportCutoff = now - REPORT_RETENTION_SECONDS;

  const pendingPurge = await env.DB.prepare(
    `DELETE FROM pending_verifications WHERE expires_at < ?`
  ).bind(now).run();

  const reportPurge = await env.DB.prepare(
    `DELETE FROM reports WHERE resolved_at IS NOT NULL AND resolved_at < ?`
  ).bind(reportCutoff).run();

  const banExpiry = await env.DB.prepare(
    `DELETE FROM bans WHERE until IS NOT NULL AND until < ?`
  ).bind(now).run();

  return json({
    ok: true,
    ranAt: now,
    pendingPurged: pendingPurge.meta?.changes ?? 0,
    reportsPurged: reportPurge.meta?.changes ?? 0,
    bansExpired: banExpiry.meta?.changes ?? 0,
  });
}

function timingSafeEq(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
