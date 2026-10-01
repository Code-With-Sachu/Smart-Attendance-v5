import "server-only";
import { ApiError } from "./api";

/**
 * Simple fixed-window limiter. It is per server instance — on multi-instance
 * or serverless deployments swap this for a shared store (e.g. Upstash Redis).
 */
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    }
    return;
  }
  b.count++;
  if (b.count > limit) {
    const secs = Math.ceil((b.reset - now) / 1000);
    throw new ApiError(429, `Too many attempts. Please wait ${secs}s and try again.`, "rate_limited");
  }
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
