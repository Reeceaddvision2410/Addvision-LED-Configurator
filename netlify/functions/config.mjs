// GET  /api/config  -> public site settings saved from the admin (or null for built-in defaults)
// PUT  /api/config  -> admin only, saves settings
import { getStore } from "@netlify/blobs";
import { isAdmin, json, unauthorised } from "../lib/auth.mjs";

const store = () => getStore({ name: "settings", consistency: "strong" });

export default async (req) => {
  if (req.method === "GET") {
    const config = await store().get("config", { type: "json" });
    return json({ config: config || null });
  }
  if (req.method === "PUT") {
    if (!isAdmin(req)) return unauthorised();
    const text = await req.text();
    if (text.length > 1_500_000) return json({ error: "Settings are too large. Use a smaller logo file (under 300 KB)." }, 413);
    let cfg;
    try { cfg = JSON.parse(text); } catch { return json({ error: "Settings weren't valid JSON." }, 400); }
    if (!cfg || !Array.isArray(cfg.products) || !Array.isArray(cfg.environments) || !cfg.brand)
      return json({ error: "Settings are missing products, environments or brand." }, 400);
    cfg.updated = new Date().toISOString();
    await store().setJSON("config", cfg);
    return json({ ok: true, updated: cfg.updated });
  }
  if (req.method === "DELETE") {
    if (!isAdmin(req)) return unauthorised();
    await store().delete("config");
    return json({ ok: true });
  }
  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/config" };
