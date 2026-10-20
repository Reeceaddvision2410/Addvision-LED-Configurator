// Shared by every page: loads settings (built-in defaults + anything saved in the admin) and applies Add Vision branding.
(function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  const fmt = (n, d = 0) => Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });

  function merge(def, saved) {
    if (!saved) return structuredClone(def);
    const out = { ...structuredClone(def), ...saved };
    for (const k of ["brand", "contact", "pricing", "form"]) out[k] = { ...def[k], ...(saved[k] || {}) };
    return out;
  }

  async function loadConfig() {
    const def = await fetch("/assets/default-config.json", { cache: "no-cache" }).then((r) => r.json());
    try {
      const r = await fetch("/api/config", { cache: "no-store" });
      if (r.ok) { const j = await r.json(); return { cfg: merge(def, j.config), def, saved: Boolean(j.config) }; }
    } catch (e) {}
    return { cfg: merge(def, null), def, saved: false };
  }

  function lum(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 0;
    const n = parseInt(m[1], 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function applyBrand(cfg) {
    const b = cfg.brand, root = document.documentElement.style;
    if (b.accent) { root.setProperty("--accent", b.accent); root.setProperty("--accent-ink", lum(b.accent) > 0.45 ? "#111111" : "#ffffff"); }
    if (b.ink) { root.setProperty("--brand-ink", b.ink); root.setProperty("--brand-fg", lum(b.ink) > 0.45 ? "#0d1726" : "#ffffff"); }
    document.querySelectorAll("[data-b]").forEach((el) => {
      const v = el.dataset.b.split(".").reduce((o, k) => (o ? o[k] : undefined), cfg);
      if (v !== undefined && v !== "") el.textContent = v;
    });
    const header = document.querySelector("header.top");
    if (header) {
      header.classList.toggle("light", b.header === "light");
      const logo = header.querySelector("img.logo"), mark = header.querySelector(".mark"), co = header.querySelector(".co"), div = header.querySelector(".divider");
      if (logo && b.logo) { logo.src = b.logo; logo.alt = b.company; logo.hidden = false; mark.hidden = true; co.hidden = true; div.hidden = false; }
      else if (logo) { logo.hidden = true; mark.hidden = false; co.hidden = false; div.hidden = true; }
    }
    const foot = document.getElementById("siteFooter");
    if (foot) {
      const c = cfg.contact, site = (b.website || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
      foot.innerHTML = `<div class="wrap">
        <div><h3>${esc(b.company)}</h3><p>Digital signage, LED video walls and touchscreens, designed, supplied and installed.</p>${c.address ? `<p>${esc(c.address)}</p>` : ""}</div>
        <div><h3>Talk to us</h3>${c.phone ? `<p class="sel">${esc(c.phone)}</p>` : ""}${c.email ? `<p class="sel">${esc(c.email)}</p>` : ""}${c.whatsapp ? `<p>WhatsApp <span class="sel">${esc(c.whatsapp)}</span></p>` : ""}</div>
        <div><h3>More</h3>${b.website ? `<p><a href="${esc(b.website)}" target="_blank" rel="noopener">${esc(site)}</a></p>` : ""}<p>Free site surveys across the UK</p></div>
        <div class="legal"><span>© ${new Date().getFullYear()} ${esc(b.company)}. ${esc(b.legal || "")}</span><span>${esc(b.product)}</span></div>
      </div>`;
    }
  }

  let tt;
  function toast(msg) {
    let el = document.getElementById("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg; el.hidden = false; clearTimeout(tt); tt = setTimeout(() => (el.hidden = true), 2600);
  }

  window.AV = { esc, fmt, loadConfig, applyBrand, toast, merge };
})();
