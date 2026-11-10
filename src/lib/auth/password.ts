import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt with N=2^15, r=8, p=3 — one of the OWASP-recommended parameter sets.
// Uses ~32 MB per hash, so it stays safe on small instances.
const PARAMS = { N: 1 << 15, r: 8, p: 3 } as const;
const KEY_LENGTH = 32;
const MAX_MEM = 96 * 1024 * 1024;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;

function derive(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** Returns a self-describing hash string: scrypt$N$r$p$salt$key */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, { ...PARAMS, maxmem: MAX_MEM });
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !saltB64 || !keyB64) return false;
  const N = Number(n);
  const rr = Number(r);
  const pp = Number(p);
  if (![N, rr, pp].every((v) => Number.isInteger(v) && v > 0) || N > 1 << 20) return false;
  try {
    const expected = Buffer.from(keyB64, "base64url");
    const actual = await derive(password, Buffer.from(saltB64, "base64url"), expected.length, {
      N,
      r: rr,
      p: pp,
      maxmem: MAX_MEM * 2,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
