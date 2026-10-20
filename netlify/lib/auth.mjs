// Shared helpers for the admin API: password check, signed session tokens, JSON responses.
import { createHmac, timingSafeEqual } from "node:crypto";

export const env = (k) => (globalThis.Netlify?.env?.get(k)) ?? process.env[k];

function secret() {
  const pw = env("ADMIN_PASSWORD");
  if (!pw) return null;
  // Changing ADMIN_PASSWORD (or SESSION_SECRET) signs everyone out.
  return `${env("SESSION_SECRET") || "addvision"}::${pw}`;
}

export function passwordConfigured() { return Boolean(env("ADMIN_PASSWORD")); }

export function checkPassword(attempt) {
  const pw = env("ADMIN_PASSWORD");
  if (!pw || typeof attempt !== "string") return false;
  const a = createHmac("sha256", "cmp").update(attempt).digest();
  const b = createHmac("sha256", "cmp").update(pw).digest();
  return timingSafeEqual(a, b);
}

export function issueToken(hours = 12) {
  const body = Buffer.from(JSON.stringify({ exp: Date.now() + hours * 3600e3 })).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function isAdmin(req) {
  const s = secret();
  if (!s) return false;
  const h = req.headers.get("authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [body, mac] = token.split(".");
  if (!body || !mac) return false;
  const expected = createHmac("sha256", s).update(body).digest("base64url");
  const a = Buffer.from(mac), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try { return JSON.parse(Buffer.from(body, "base64url").toString()).exp > Date.now(); }
  catch { return false; }
}

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const unauthorised = () => json({ error: "Your session has expired. Sign in again." }, 401);
