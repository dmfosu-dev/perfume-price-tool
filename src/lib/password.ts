import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// scrypt is used rather than bcrypt/argon2 to avoid a second native dependency.
// It is a purpose-built password KDF (RFC 7914) and an accepted OWASP choice.
// Stored format: scrypt$N$r$p$<salt b64>$<key b64> — the parameters travel with
// the hash, so they can be raised later without invalidating existing passwords.

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
// Node's default maxmem (32MB) is too small for N=16384, r=8.
const MAXMEM = 128 * N * R * 2;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEYLEN, {
    N,
    r: R,
    p: P,
    maxmem: MAXMEM,
  });
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64");
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const key = await scrypt(password.normalize("NFKC"), salt, expected.length, {
    N: n,
    r,
    p,
    maxmem: Math.max(MAXMEM, 128 * n * r * 2),
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Compared against when the email is unknown, so a failed login costs the same
// work whether or not the account exists. Without this, response time leaks
// which emails are registered.
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(32).toString("base64"));
  return dummyHash;
}
