import { checkPassword, issueToken, json, passwordConfigured } from "../lib/auth.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!passwordConfigured())
    return json({ error: "No admin password is set. In Netlify, add an environment variable called ADMIN_PASSWORD, then redeploy." }, 503);
  let body = {};
  try { body = await req.json(); } catch {}
  if (!checkPassword(body.password)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return json({ error: "That password isn't right." }, 401);
  }
  return json({ token: issueToken(12) });
};

export const config = { path: "/api/login" };
