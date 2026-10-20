// POST   /api/enquiries                public: save an enquiry with optional site photo + mockup
// GET    /api/enquiries                admin: list enquiries
// PATCH  /api/enquiries/:id            admin: update status / notes
// DELETE /api/enquiries/:id            admin: delete enquiry and its images
// GET    /api/enquiries/:id/:file      admin: fetch "photo" or "mockup" image
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { isAdmin, json, unauthorised } from "../lib/auth.mjs";

const meta = () => getStore({ name: "enquiries", consistency: "strong" });
const files = () => getStore({ name: "enquiry-files", consistency: "strong" });
const FILES = { "site-photo": "photo", "mockup": "mockup" };
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const STATUSES = ["new", "contacted", "quoted", "won", "lost"];
const clip = (v, n = 500) => String(v ?? "").slice(0, n).trim();

export default async (req, context) => {
  const { id, file } = context.params || {};

  if (req.method === "POST" && !id) {
    let form;
    try { form = await req.formData(); } catch { return json({ error: "The enquiry couldn't be read." }, 400); }
    if (clip(form.get("bot-field"))) return json({ ok: true }); // honeypot: pretend success
    const f = (k, n) => clip(form.get(k), n);
    const name = f("name", 120), email = f("email", 160), phone = f("phone", 40);
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.replace(/\D/g, "").length < 10)
      return json({ error: "Please add your name, a valid email and a phone number." }, 400);

    const newId = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
    let summary = {};
    try { summary = JSON.parse(f("summary", 4000) || "{}"); } catch {}
    const record = {
      id: newId, created: new Date().toISOString(), status: "new", adminNotes: "",
      ref: f("reference", 40), name, email, phone,
      company: f("company", 160), postcode: f("postcode", 20), sector: f("sector", 80),
      timeline: f("timeline", 80), budget: f("budget", 80), notes: f("notes", 3000),
      specification: f("specification", 12000), summary, files: []
    };
    for (const [field, key] of Object.entries(FILES)) {
      const blob = form.get(field);
      if (blob && typeof blob === "object" && blob.size > 0) {
        if (!TYPES.includes(blob.type) || blob.size > 3_500_000) continue;
        await files().set(`${newId}/${key}`, await blob.arrayBuffer(), { metadata: { type: blob.type } });
        record.files.push(key);
      }
    }
    await meta().setJSON(newId, record);
    return json({ ok: true, id: newId });
  }

  if (!isAdmin(req)) return unauthorised();

  if (req.method === "GET" && !id) {
    const { blobs } = await meta().list();
    const items = (await Promise.all(blobs.map((b) => meta().get(b.key, { type: "json" })))).filter(Boolean);
    items.sort((a, b) => b.created.localeCompare(a.created));
    return json({ enquiries: items });
  }

  if (req.method === "GET" && id && file) {
    const res = await files().getWithMetadata(`${id}/${file}`, { type: "arrayBuffer" });
    if (!res) return json({ error: "Image not found." }, 404);
    return new Response(res.data, { headers: { "content-type": res.metadata?.type || "image/jpeg", "cache-control": "private, max-age=3600" } });
  }

  if (req.method === "PATCH" && id) {
    const record = await meta().get(id, { type: "json" });
    if (!record) return json({ error: "Enquiry not found." }, 404);
    const body = await req.json().catch(() => ({}));
    if (body.status && STATUSES.includes(body.status)) record.status = body.status;
    if (typeof body.adminNotes === "string") record.adminNotes = body.adminNotes.slice(0, 5000);
    record.updated = new Date().toISOString();
    await meta().setJSON(id, record);
    return json({ ok: true, enquiry: record });
  }

  if (req.method === "DELETE" && id) {
    await Promise.all([meta().delete(id), ...Object.values(FILES).map((k) => files().delete(`${id}/${k}`))]);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: ["/api/enquiries", "/api/enquiries/:id", "/api/enquiries/:id/:file"] };
