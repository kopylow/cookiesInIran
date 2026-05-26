// Fixed-window rate limiter backed by KV. Eventually consistent — sufficient
// for low-traffic abuse mitigation. Returns { allowed, retryAfterSec, remaining }.

export function isBypassed(env, ip) {
  // Allow local development.
  if (ip === "127.0.0.1" || ip === "::1") return true;
  // BYPASS_IP is a comma-separated list of *prefixes* matched via startsWith.
  // Use full addresses for static IPs (e.g. "203.0.113.42"), or trailing-colon
  // prefixes for IPv6 /64s on residential connections (e.g. "2a11:fb80:38c:b3f8:")
  // — the trailing colon anchors the match at a segment boundary so it can't
  // bleed into adjacent prefixes.
  if (!env.BYPASS_IP) return false;
  return env.BYPASS_IP.split(",").some((p) => {
    const prefix = p.trim();
    return prefix && ip.startsWith(prefix);
  });
}

export async function rateLimit(kv, key, limit, windowSec) {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSec);
  const k = `rl:${key}:${bucket}`;
  const raw = await kv.get(k);
  const count = raw ? parseInt(raw, 10) : 0;
  if (count >= limit) {
    const reset = (bucket + 1) * windowSec;
    return { allowed: false, retryAfterSec: Math.max(reset - now, 1), remaining: 0 };
  }
  await kv.put(k, String(count + 1), { expirationTtl: windowSec + 10 });
  return { allowed: true, retryAfterSec: 0, remaining: limit - count - 1 };
}

// Multiple windows in parallel — convenience for "3 per hour AND 10 per day".
export async function rateLimitAll(kv, baseKey, rules) {
  for (const r of rules) {
    const res = await rateLimit(kv, `${baseKey}:${r.label}`, r.limit, r.windowSec);
    if (!res.allowed) return { ...res, label: r.label };
  }
  return { allowed: true, retryAfterSec: 0 };
}
