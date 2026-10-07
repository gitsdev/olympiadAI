// Bearer-token check for machine endpoints (publish API, cron). Server-only use.

import { createHash, timingSafeEqual } from "node:crypto";

const MIN_SECRET_LENGTH = 16;

/**
 * True only if `authorization` is exactly "Bearer <secret>". Compares
 * SHA-256 digests in constant time, and fails closed when the secret is
 * missing or too short to be safe.
 */
export function verifyBearer(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < MIN_SECRET_LENGTH || !authorization) return false;
  const m = /^Bearer (.+)$/.exec(authorization);
  if (!m) return false;
  const a = createHash("sha256").update(m[1]).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
