// Edge-compatible session helpers. Runs in middleware and route handlers, so
// everything here uses Web Crypto rather than node:crypto.

export const SESSION_COOKIE = "dus2pori_session";
const SESSION_DAYS = 30;

function credentials() {
  return {
    username: process.env.SHOP_USERNAME || "dus2pori",
    password: process.env.SHOP_PASSWORD || "Dus2Pori@2026",
    secret:
      process.env.AUTH_SECRET ||
      // Derived fallback so a missing AUTH_SECRET still yields a stable key
      // that changes the moment the password changes.
      `dus2pori::${process.env.SHOP_PASSWORD || "Dus2Pori@2026"}`,
  };
}

/** True when the shop is still running the built-in credentials. */
export function usingDefaultCredentials() {
  return !process.env.SHOP_USERNAME || !process.env.SHOP_PASSWORD;
}

function timingSafeEqual(a: string, b: string) {
  // Compare every character so the loop cost doesn't reveal the match length.
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function checkCredentials(username: string, password: string) {
  const c = credentials();
  // Evaluate both so a wrong username costs the same as a wrong password.
  const userOk = timingSafeEqual(username.trim().toLowerCase(), c.username.toLowerCase());
  const passOk = timingSafeEqual(password, c.password);
  return userOk && passOk;
}

function base64url(bytes: ArrayBuffer) {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(credentials().secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
  );
}

export async function createSessionToken() {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  return `${expires}.${await sign(String(expires))}`;
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature) return false;
  if (!/^\d+$/.test(expires) || Number(expires) < Date.now()) return false;
  return timingSafeEqual(signature, await sign(expires));
}

export const SESSION_MAX_AGE = SESSION_DAYS * 86_400;
