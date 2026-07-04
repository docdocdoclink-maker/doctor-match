// In-memory rate limiting, keyed by whatever string the caller provides
// (usually IP + email). Good enough for a single-process deployment like
// this one — resets on restart, doesn't survive multiple instances. If this
// ever runs behind multiple replicas, move this to a shared store (Redis).
const attempts = new Map();

function cleanup(now) {
  if (attempts.size < 5000) return;
  for (const [key, entry] of attempts) {
    if (now > entry.resetAt) attempts.delete(key);
  }
}

export function checkRateLimit(key, { max = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const now = Date.now();
  cleanup(now);
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (entry.count >= max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { allowed: true };
}

export function getClientIp(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}
