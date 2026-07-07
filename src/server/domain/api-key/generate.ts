import crypto from "node:crypto";

export interface GeneratedApiKey {
  plainKey: string;
  keyHash: string;
  keyPrefix: string;
}

export function generateApiKey(): GeneratedApiKey {
  const random = crypto.randomBytes(24).toString("base64url").slice(0, 32);
  const plainKey = `bk_${random}`;
  const keyHash = crypto.createHash("sha256").update(plainKey).digest("hex");
  const keyPrefix = plainKey.slice(0, 11);
  return { plainKey, keyHash, keyPrefix };
}

export function hashApiKey(plainKey: string): string {
  return crypto.createHash("sha256").update(plainKey).digest("hex");
}
