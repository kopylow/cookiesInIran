// Cloudflare Access verifies the JWT and forwards it as `Cf-Access-Jwt-Assertion`
// plus `Cf-Access-Authenticated-User-Email`. For Pages Projects we trust the
// presence of the email header when the path is gated by an Access policy.
// In production: configure an Access application for /admin* with the
// allowed email list. The CF_ACCESS_AUD env var is checked against the JWT
// `aud` claim to defend against misrouted requests.

export function getAccessUser(request) {
  const email = request.headers.get("cf-access-authenticated-user-email");
  return email || null;
}

export async function requireAccessUser(request, env) {
  const email = getAccessUser(request);
  // Local-dev bypass: only honored when CF Access is NOT configured for prod.
  if (!email && env.ADMIN_DEV_BYPASS === "1" && !env.CF_ACCESS_AUD && !env.ADMIN_PASSWORD) {
    return { ok: true, email: "dev@local" };
  }
  // Password fallback: used when CF Access is not configured.
  if (!email && env.ADMIN_PASSWORD && !env.CF_ACCESS_AUD) {
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token || token !== env.ADMIN_PASSWORD) {
      return { ok: false, status: 401, reason: "bad-password" };
    }
    return { ok: true, email: "password-auth" };
  }
  if (!email) return { ok: false, status: 401, reason: "no-access-header" };
  // Optional JWT aud check — only enforce if CF_ACCESS_AUD is configured.
  if (env.CF_ACCESS_AUD) {
    const jwt = request.headers.get("cf-access-jwt-assertion");
    if (!jwt) return { ok: false, status: 401, reason: "no-jwt" };
    const payload = decodeJwtPayload(jwt);
    if (!payload || !payload.aud || (Array.isArray(payload.aud) ? !payload.aud.includes(env.CF_ACCESS_AUD) : payload.aud !== env.CF_ACCESS_AUD)) {
      return { ok: false, status: 401, reason: "bad-aud" };
    }
  }
  return { ok: true, email };
}

export async function logAdminAction(env, { actor, action, targetId, details }) {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT INTO audit_log (id, actor, action, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, actor, action, targetId || null, details ? JSON.stringify(details) : null, now).run();
}

function decodeJwtPayload(jwt) {
  try {
    const part = jwt.split(".")[1];
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    return JSON.parse(atob(b64 + pad));
  } catch {
    return null;
  }
}
