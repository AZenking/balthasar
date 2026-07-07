const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

const store = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(keyPrefix: string): {
  allowed: boolean;
  retryAfter: number;
} {
  const now = Date.now();
  const entry = store.get(keyPrefix);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(keyPrefix, { count: 1, windowStart: now });
    return { allowed: true, retryAfter: 0 };
  }

  entry.count++;

  if (entry.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }

  return { allowed: true, retryAfter: 0 };
}
