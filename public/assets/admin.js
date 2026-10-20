// Add Vision configurator admin: sign in, enquiries inbox, and editing of every setting the public page uses.
(async function () {
  const { esc, fmt, toast } = AV;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clone = (o) => structuredClone(o);

  let token = "";
  try { token = sessionStorage.getItem("av-admin") || ""; } catch (e) {}
  const loaded = await AV.loadConfig();
  const DEF = loaded.def;
  let SAVED = loaded.cfg, W = clone(SAVED), dirty = false;
  let enquiries = [], currentId = null;
  const imgURLs = {};
  AV.applyBrand(W);

  // ---------- API ----------
  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (token) headers.Authorization = "Bearer " + token;
    const r = await fetch(path, { ...opts, headers });
    if (r.status === 401 && path !== "/api/login") { signOut("Your session has expired. Sign in again."); throw new Error("unauthorised"); }
    return r;
  }
  const errorOf = async (r, fallback) => (await r.json().catch(() => ({}))).error || fallback;

  // ---------- Sign in / out ----------
  function showLogin(msg) {
    $("#login").hidden = false; $("#app").hidden = true; $("#signOut").hidden = true; $("#savebar").hidden = true;
    $("#loginErr").hidden = !msg; $("#loginErr").textContent = msg || "";
    setTimeout(() => $("#pw").focus(), 50);
  }
  function showApp() {
    $("#login").hidden = true; $("#app").hidden = false; $("#signOut").hidden = false;
    fillForm(); renderTables(); loadEnquiries(); updateSavebar();
  }
  function signOut(msg) { token = ""; try { sessionStorage.removeItem("av-admin"); } catch (e) {} showLogin(msg); }
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter || $("#loginForm button"); btn.disabled = true;
    try {
      const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: $("#pw").value }) });
      if (r.status === 404) throw new Error("The admin service isn't running here. It works once the site is deployed on Netlify (or locally with netlify dev).");
      if (!r.ok) throw new Error(await errorOf(r, "Sign in failed. Try again."));
      token = (await r.json()).token;
      try { sessionStorage.setItem("av-admin", token); } catch (e2) {}
      $("#pw").value = ""; showApp();
    } catch (err) { $("#loginErr").hidden = false; $("#loginErr").textContent = err.message; }
    btn.disabled = false;
  });
  $("#signOut").addEventListener("click", () => { if (dirty && !confirmLeave()) return; signOut(); });
  const confirmLeave = () => { toast("Save or discard your changes first."); return false; };

  // ---------- Tabs ----------
  $("#tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    $$("#tabs [data-tab]").forEach((x) => x.setAttribute("aria-selected", x === b));
    $$(".tab").forEach((t) => (t.hidden = t.id !== "tab-" + b.dataset.tab));
  });

  // ---------- Settings binding ----------
  const getPath = (o, p) => p.split(".").reduce((a, k) => (a ? a[k] : undefined), o);
  const setPath = (o, p, v) => { const ks = p.split("."), last = ks.pop(); const t = ks.reduce((a, k) => (a[k] ??= {}), o); t[last] = v; };
  const hex = (v) => (/^#[0-9a-f]{6}$/i.test(v || "") ? v : "#000000");

  function fillForm() {
    $$("[data-path]").forEach((el) => { const v = getPath(W, el.dataset.path); if (el.type === "checkbox") el.checked = Boolean(v); else el.value = v ?? ""; });
    $$("[data-color]").forEach((el) => (el.value = hex(getPath(W, el.dataset.color))));
    $$("[data-lines]").forEach((el) => (el.value = (getPath(W, el.dataset.lines) || []).join("\n")));
    renderLogo();
  }
  function markDirty() { dirty = true; updateSavebar(); }
  function updateSavebar() { $("#savebar").hidden = !dirty || $("#app").hidden; }

  $("#app").addEventListener("input", (e) => {
    const el = e.target, d = el.dataset;
    if (d.path) {
      const v = el.type === "checkbox" ? el.checked : el.type === "number" ? (el.value === "" ? 0 : +el.value) : el.value;
      setPath(W, d.path, v);
      const pick = $(`[data-color="${d.path}"]`); if (pick) pick.value = hex(v);
    } else if (d.color) { setPath(W, d.color, el.value); const txt = $(`[data-path="${d.color}"]`); if (txt) txt.value = el.value; }
    else if (d.lines) setPath(W, d.lines, el.value.split("\n").map((s) => s.trim()).filter(Boolean));
    else if (d.list) {
      const row = W[d.list][+d.idx];
      row[d.key] = el.type === "checkbox" ? el.checked : el.type === "number" ? (el.value === "" ? 0 : +el.value) : el.value;
      if (el.type === "checkbox") el.closest("tr")?.classList.toggle("off", d.key === "enabled" && !el.checked);
      if (d.list === "products" && ["p", "cw", "ch"].includes(d.key)) { const cell = el.closest("tr").querySelector(".pxcab"); if (cell) cell.textContent = pxCab(row); }
      if (d.list === "environments" && d.key === "label") renderProducts();
    } else return;
    if ((d.path || d.color || "").startsWith("brand") || d.list === "booking") { AV.applyBrand(W); renderLogo(); }
    markDirty();
  });
  $("#app").addEventListener("change", (e) => { if (e.target.type === "checkbox" || e.target.tagName === "SELECT") e.target.dispatchEvent(new Event("input", { bubbles: true })); });

  // ---------- Editable tables ----------
  const inp = (list, idx, key, val, cls = "", type = "text", extra = "") =>
    `<input class="t ${cls}" type="${type}" ${type === "number" ? 'step="any" min="0"' : ""} data-list="${list}" data-idx="${idx}" data-key="${key}" value="${esc(val ?? "")}" aria-label="${esc(key)}" ${extra}>`;
  const chk = (list, idx, key, val, label) => `<input type="checkbox" data-list="${list}" data-idx="${idx}" data-key="${key}" ${val !== false && val ? "checked" : ""} aria-label="${esc(label)}">`;
  const perSel = (list, idx, val) => `<select class="t" data-list="${list}" data-idx="${idx}" data-key="per" aria-label="Price basis"><option value="m2"${val === "m2" ? " selected" : ""}>per m²</option><option value="fixed"${val !== "m2" ? " selected" : ""}>fixed</option></select>`;
  const pxCab = (p) => (+p.p > 0 ? `${Math.round(+p.cw / +p.p)} × ${Math.round(+p.ch / +p.p)}` : "—");

  function renderEnvs() {
    $("#envTable").innerHTML = `<tr><th>On</th><th>Label</th><th>Description</th><th>Products</th><th></th></tr>` +
      W.environments.map((e, i) => {
        const n = W.products.filter((p) => p.env === e.id).length;
        return `<tr class="${e.enabled === false ? "off" : ""}"><td class="ctr">${chk("environments", i, "enabled", e.enabled !== false, "Show " + e.label)}</td>
          <td>${inp("environments", i, "label", e.label, "w-m")}</td><td>${inp("environments", i, "sub", e.sub, "w-xl")}</td>
          <td class="mono">${n}</td><td>${n ? "" : `<button class="iconbtn del" data-del-env="${i}">Delete</button>`}</td></tr>`;
      }).join("");
  }
  function renderProducts() {
    $("#productGroups").innerHTML = W.environments.map((env) => {
      const rows = W.products.map((p, i) => ({ p, i })).filter((x) => x.p.env === env.id).sort((a, b) => +a.p.p - +b.p.p);
      return `<div class="panel card-pad">
        <div class="group-hd"><h2 class="sec">${esc(env.label)} products</h2><button class="btn ghost small" data-add-product="${esc(env.id)}">Add product</button></div>
        ${rows.length ? `<div class="table-scroll"><table class="edit"><tr><th>On</th><th>Name</th><th>Pitch mm</th><th>Cabinet W mm</th><th>Cabinet H mm</th><th>Pixels / cab</th><th>Nits</th><th>kg / m²</th><th>Max W / m²</th><th>LED tech</th><th>Refresh Hz</th><th>Service</th><th>£ / m²</th><th></th></tr>
        ${rows.map(({ p, i }) => `<tr class="${p.enabled === false ? "off" : ""}">
          <td class="ctr">${chk("products", i, "enabled", p.enabled !== false, "Show " + p.name)}</td>
          <td>${inp("products", i, "name", p.name, "w-m")}</td>
          <td>${inp("products", i, "p", p.p, "", "number")}</td><td>${inp("products", i, "cw", p.cw, "", "number")}</td><td>${inp("products", i, "ch", p.ch, "", "number")}</td>
          <td class="mono pxcab">${pxCab(p)}</td>
          <td>${inp("products", i, "nits", p.nits, "", "number")}</td><td>${inp("products", i, "kg", p.kg, "", "number")}</td><td>${inp("products", i, "w", p.w, "", "number")}</td>
          <td>${inp("products", i, "tech", p.tech, "w-m")}</td><td>${inp("products", i, "refresh", p.refresh, "", "number")}</td><td>${inp("products", i, "service", p.service, "w-m")}</td>
          <td>${inp("products", i, "price", p.price, "", "number")}</td>
          <td><div class="rowbtns"><button class="iconbtn" data-dup="${i}">Duplicate</button><button class="iconbtn del" data-del="products:${i}">Delete</button></div></td></tr>`).join("")}
        </table></div>` : `<p class="muted">No products yet. Customers won't see this environment until you add one.</p>`}
      </div>`;
    }).join("");
  }
  function renderOptions(list, el, withDefault) {
    $(el).innerHTML = `<tr><th>On</th>${withDefault ? "<th>Ticked</th>" : ""}<th>Label</th><th>Description</th><th>Price £</th><th>Basis</th><th></th></tr>` +
      W[list].map((m, i) => `<tr class="${m.enabled === false ? "off" : ""}"><td class="ctr">${chk(list, i, "enabled", m.enabled !== false, "Show " + m.label)}</td>
        ${withDefault ? `<td class="ctr">${chk(list, i, "default", m.default, "Ticked by default")}</td>` : ""}
        <td>${inp(list, i, "label", m.label, "w-l")}</td><td>${inp(list, i, "sub", m.sub, "w-xl")}</td>
        <td>${inp(list, i, "price", m.price, "", "number")}</td><td>${perSel(list, i, m.per)}</td>
        <td><button class="iconbtn del" data-del="${list}:${i}">Delete</button></td></tr>`).join("");
  }
  function renderBooking() {
    W.booking ||= [];
    $("#bookingTable").innerHTML = `<tr><th>On</th><th>Button text</th><th>Booking link</th><th>Style</th><th></th></tr>` +
      W.booking.map((b, i) => `<tr class="${b.enabled === false ? "off" : ""}"><td class="ctr">${chk("booking", i, "enabled", b.enabled !== false, "Show " + b.label)}</td>
        <td>${inp("booking", i, "label", b.label, "w-l")}</td><td>${inp("booking", i, "url", b.url, "w-xl", "url", 'style="width:380px"')}</td>
        <td><select class="t" data-list="booking" data-idx="${i}" data-key="style" aria-label="Button style"><option value="primary"${b.style !== "outline" ? " selected" : ""}>Filled</option><option value="outline"${b.style === "outline" ? " selected" : ""}>Outline</option></select></td>
        <td><div class="rowbtns"><a class="iconbtn" href="${esc(/^https?:/i.test(b.url || "") ? b.url : "#")}" target="_blank" rel="noopener">Test</a><button class="iconbtn del" data-del="booking:${i}">Delete</button></div></td></tr>`).join("");
  }
  function renderTables() { renderEnvs(); renderProducts(); renderOptions("mounts", "#mountTable", false); renderOptions("addons", "#addonTable", true); renderBooking(); }

  const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  $("#app").addEventListener("click", (e) => {
    const t = e.target.closest("button"); if (!t) return;
    const d = t.dataset;
    if (d.addProduct) { W.products.push({ env: d.addProduct, enabled: true, name: "New product", p: 2.5, cw: 500, ch: 500, nits: 800, kg: 30, w: 500, tech: "", refresh: 3840, service: "Front", price: 0 }); renderTables(); markDirty(); }
    else if (d.dup) { const copy = clone(W.products[+d.dup]); copy.name += " (copy)"; W.products.splice(+d.dup + 1, 0, copy); renderTables(); markDirty(); }
    else if (d.del) { const [list, i] = d.del.split(":"); const gone = W[list].splice(+i, 1)[0]; renderTables(); markDirty(); toast(`Removed ${gone.name || gone.label}. Discard to undo.`); }
    else if (d.delEnv) { W.environments.splice(+d.delEnv, 1); renderTables(); markDirty(); }
    else if (d.add === "mounts") { W.mounts.push({ id: uid("mount"), label: "New mounting option", sub: "", enabled: true, price: 0, per: "fixed" }); renderTables(); markDirty(); }
    else if (d.add === "booking") { W.booking.push({ label: "Book a call", url: "https://", style: "outline", enabled: true }); renderTables(); markDirty(); }
    else if (d.add === "addons") { W.addons.push({ id: uid("svc"), label: "New service", sub: "", enabled: true, default: false, price: 0, per: "fixed" }); renderTables(); markDirty(); }
    else if (t.id === "addEnv") { W.environments.push({ id: uid("env"), label: "New environment", sub: "", enabled: true }); renderTables(); markDirty(); }
  });

  // ---------- Logo ----------
  function renderLogo() {
    $("#logoPrev").innerHTML = `<img src="${esc(AV.logoFor(W.brand, false))}" alt="Logo preview"><span class="muted" style="margin-top:6px">${W.brand.logo ? "Uploaded logo" : "Add Vision logo (built in)"}</span>`;
    $("#logoClear").hidden = !W.brand.logo;
  }
  $("#logoFile").addEventListener("change", (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    if (f.size > 300 * 1024) { toast("That logo is over 300 KB. Export a smaller PNG or SVG."); return; }
    const r = new FileReader(); r.onload = () => { W.brand.logo = r.result; AV.applyBrand(W); renderLogo(); markDirty(); }; r.readAsDataURL(f);
  });
  $("#logoClear").addEventListener("click", () => { W.brand.logo = ""; AV.applyBrand(W); renderLogo(); markDirty(); });
  ["#logoBtn", "#importBtn"].forEach((id) => $(id).addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("#" + $(id).htmlFor).click(); } }));

  // ---------- Save / discard ----------
  $("#save").addEventListener("click", async (e) => {
    const btn = e.currentTarget; btn.disabled = true; btn.textContent = "Saving…";
    try {
      const r = await api("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(W) });
      if (!r.ok) throw new Error(await errorOf(r, "Couldn't save. Try again."));
      const j = await r.json(); SAVED = clone(W); dirty = false; updateSavebar();
      $("#lastSaved").textContent = `Last saved ${new Date(j.updated).toLocaleString("en-GB")}.`;
      toast("Saved. The live site now uses these settings.");
    } catch (err) { if (err.message !== "unauthorised") toast(err.message); }
    btn.disabled = false; btn.textContent = "Save & publish";
  });
  $("#discard").addEventListener("click", () => { W = clone(SAVED); dirty = false; AV.applyBrand(W); fillForm(); renderTables(); updateSavebar(); toast("Changes discarded"); });
  addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  // ---------- Backup ----------
  function download(name, blob) { const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); }
  $("#exportJson").addEventListener("click", () => download(`configurator-settings-${new Date().toISOString().slice(0, 10)}.json`, new Blob([JSON.stringify(W, null, 2)], { type: "application/json" })));
  $("#importJson").addEventListener("change", (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    f.text().then((txt) => {
      const data = JSON.parse(txt);
      if (!Array.isArray(data.products) || !data.brand) throw new Error();
      W = AV.merge(DEF, data); AV.applyBrand(W); fillForm(); renderTables(); markDirty();
      toast("Settings loaded. Check them, then Save & publish.");
    }).catch(() => toast("That file isn't a settings backup from this admin."));
  });
  const resetButton = `<button class="btn danger" id="resetAll">Reset settings…</button>`;
  $("#resetArea").addEventListener("click", async (e) => {
    const id = e.target.id;
    if (id === "resetAll") $("#resetArea").innerHTML = `<div class="confirm"><span>This can't be undone. Reset all settings?</span><button class="btn danger small" id="resetYes">Yes, reset</button><button class="btn ghost small" id="resetNo">Cancel</button></div>`;
    else if (id === "resetNo") $("#resetArea").innerHTML = resetButton;
    else if (id === "resetYes") {
      try {
        const r = await api("/api/config", { method: "DELETE" }); if (!r.ok) throw new Error(await errorOf(r, "Couldn't reset."));
        SAVED = clone(DEF); W = clone(DEF); dirty = false; AV.applyBrand(W); fillForm(); renderTables(); updateSavebar(); toast("Settings reset to defaults");
      } catch (err) { if (err.message !== "unauthorised") toast(err.message); }
      $("#resetArea").innerHTML = resetButton;
    }
  });

  // ---------- Enquiries ----------
  const STATUS = { new: "New", contacted: "Contacted", quoted: "Quoted", won: "Won", lost: "Lost" };
  const when = (iso) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  async function loadEnquiries() {
    $("#enqEmpty").hidden = false; $("#enqEmpty").textContent = "Loading enquiries…";
    try {
      const r = await api("/api/enquiries");
      if (!r.ok) throw new Error(await errorOf(r, "Couldn't load enquiries."));
      enquiries = (await r.json()).enquiries || [];
      renderList();
      if (currentId && enquiries.some((x) => x.id === currentId)) showDetail(currentId);
    } catch (err) { if (err.message !== "unauthorised") { $("#enqTable").innerHTML = ""; $("#enqEmpty").textContent = err.message; } }
  }
  function filtered() {
    const q = $("#q").value.trim().toLowerCase(), s = $("#statusFilter").value;
    return enquiries.filter((x) => (!s || x.status === s) && (!q || [x.name, x.company, x.email, x.ref, x.phone, x.postcode].join(" ").toLowerCase().includes(q)));
  }
  function renderList() {
    const n = enquiries.filter((x) => x.status === "new").length;
    $("#newCount").hidden = !n; $("#newCount").textContent = n;
    const rows = filtered();
    $("#enqEmpty").hidden = rows.length > 0;
    $("#enqEmpty").textContent = enquiries.length ? "No enquiries match your search." : "No enquiries yet. They'll appear here as soon as a customer presses Send.";
    $("#enqTable").innerHTML = rows.length ? `<tr><th>Received</th><th>Customer</th><th>Screen</th><th>Status</th></tr>` + rows.map((x) => `
      <tr class="row" tabindex="0" data-id="${esc(x.id)}" aria-selected="${x.id === currentId}">
        <td class="nowrap">${esc(when(x.created))}<small class="mono">${esc(x.ref)}</small></td>
        <td>${esc(x.name)}<small>${esc(x.company || x.email)}</small></td>
        <td>${esc(x.summary?.size || "—")}<small>${esc(x.summary?.product || "")}${x.files?.length ? " · photo" : ""}</small></td>
        <td><span class="chip st-${esc(x.status)}">${esc(STATUS[x.status] || x.status)}</span></td>
      </tr>`).join("") : "";
  }
  $("#q").addEventListener("input", renderList);
  $("#statusFilter").addEventListener("change", renderList);
  $("#refresh").addEventListener("click", loadEnquiries);
  $("#enqTable").addEventListener("click", (e) => { const r = e.target.closest("tr.row"); if (r) showDetail(r.dataset.id); });
  $("#enqTable").addEventListener("keydown", (e) => { const r = e.target.closest("tr.row"); if (r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); showDetail(r.dataset.id); } });

  async function imageURL(id, file) {
    const k = `${id}/${file}`; if (imgURLs[k]) return imgURLs[k];
    const r = await api(`/api/enquiries/${encodeURIComponent(id)}/${file}`); if (!r.ok) return "";
    return (imgURLs[k] = URL.createObjectURL(await r.blob()));
  }
  async function showDetail(id) {
    currentId = id; renderList();
    const x = enquiries.find((e) => e.id === id); if (!x) return;
    const s = x.summary || {};
    const kv = (rows) => `<dl class="kv">${rows.filter((r) => r[1]).map(([k, v, sel]) => `<dt>${esc(k)}</dt><dd class="${sel ? "sel" : ""}">${esc(v)}</dd>`).join("")}</dl>`;
    $("#detail").innerHTML = `
      <div class="hd"><div><div class="eyebrow">${esc(x.ref || "No reference")} · ${esc(when(x.created))}</div><h2>${esc(x.name)}</h2><div class="muted">${esc(x.company || "")}</div></div>
        <div class="field" style="min-width:150px"><label for="dStatus">Status</label><select class="t" id="dStatus">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === x.status ? " selected" : ""}>${v}</option>`).join("")}</select></div></div>
      <div class="bd">
        ${kv([["Email", x.email, 1], ["Phone", x.phone, 1], ["Postcode", x.postcode], ["Sector", x.sector], ["Timeline", x.timeline], ["Budget guide", x.budget], ["Their notes", x.notes]])}
        ${kv([["Screen", [s.size, s.product].filter(Boolean).join(" · ")], ["Resolution", s.resolution], ["Cabinets", s.cabinets], ["Environment", s.env], ["Mounting", s.mount], ["Est. budget", s.budget]])}
        ${x.files?.length ? `<div class="imgs" id="dImgs">${x.files.map((f) => `<figure><img data-file="${f}" alt="${f === "photo" ? "Customer's site photo" : "Mockup with screen placed"}"><figcaption><span>${f === "photo" ? "Site photo" : "Mockup"}</span><a href="#" data-dl="${f}">Download</a></figcaption></figure>`).join("")}</div>` : `<p class="muted" style="margin:0">No photo was supplied.</p>`}
        <details><summary class="muted" style="cursor:pointer">Full specification</summary><pre class="spec">${esc(x.specification || "")}</pre></details>
        <div class="field"><label for="dNotes">Internal notes</label><textarea class="t" id="dNotes" rows="3" placeholder="Only visible in the admin">${esc(x.adminNotes || "")}</textarea></div>
        <div class="actions" id="dActions"><button class="btn primary small" id="dSaveNotes">Save notes</button><button class="btn ghost small" id="dCopy">Copy specification</button><span class="grow" style="flex:1"></span><button class="btn danger small" id="dDelete">Delete</button></div>
      </div>`;
    $$("#dImgs img").forEach(async (img) => { img.src = await imageURL(x.id, img.dataset.file); });
  }
  async function patch(id, body, msg) {
    try {
      const r = await api(`/api/enquiries/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await errorOf(r, "Couldn't update the enquiry."));
      const j = await r.json(); const i = enquiries.findIndex((e) => e.id === id); if (i > -1) enquiries[i] = j.enquiry;
      renderList(); toast(msg);
    } catch (err) { if (err.message !== "unauthorised") toast(err.message); }
  }
  $("#detail").addEventListener("change", (e) => { if (e.target.id === "dStatus") patch(currentId, { status: e.target.value }, `Marked as ${STATUS[e.target.value]}`); });
  $("#detail").addEventListener("click", async (e) => {
    const t = e.target, x = enquiries.find((q) => q.id === currentId); if (!x) return;
    if (t.matches("img[data-file]") && t.src) { const a = document.createElement("a"); a.href = t.src; a.target = "_blank"; a.rel = "noopener"; a.click(); }
    else if (t.dataset.dl) { e.preventDefault(); const url = await imageURL(x.id, t.dataset.dl); if (url) { const a = document.createElement("a"); a.href = url; a.download = `${x.ref || x.id}-${t.dataset.dl}.jpg`; document.body.appendChild(a); a.click(); a.remove(); } }
    else if (t.id === "dSaveNotes") patch(x.id, { adminNotes: $("#dNotes").value }, "Notes saved");
    else if (t.id === "dCopy") { try { await navigator.clipboard.writeText(x.specification || ""); toast("Specification copied"); } catch (err) { toast("Open Full specification and copy the text"); } }
    else if (t.id === "dDelete") { $("#dActions").innerHTML = `<div class="confirm"><span>Delete this enquiry and its photos for good?</span><button class="btn danger small" id="dDelYes">Delete</button><button class="btn ghost small" id="dDelNo">Cancel</button></div>`; }
    else if (t.id === "dDelNo") showDetail(x.id);
    else if (t.id === "dDelYes") {
      try {
        const r = await api(`/api/enquiries/${encodeURIComponent(x.id)}`, { method: "DELETE" }); if (!r.ok) throw new Error(await errorOf(r, "Couldn't delete."));
        enquiries = enquiries.filter((q) => q.id !== x.id); currentId = null; renderList();
        $("#detail").innerHTML = `<div class="empty">Enquiry deleted.</div>`; toast("Enquiry deleted");
      } catch (err) { if (err.message !== "unauthorised") toast(err.message); }
    }
  });
  $("#exportCsv").addEventListener("click", () => {
    const cols = [["Received", (x) => x.created], ["Reference", (x) => x.ref], ["Status", (x) => x.status], ["Name", (x) => x.name], ["Company", (x) => x.company], ["Email", (x) => x.email], ["Phone", (x) => x.phone], ["Postcode", (x) => x.postcode], ["Sector", (x) => x.sector], ["Timeline", (x) => x.timeline], ["Budget guide", (x) => x.budget], ["Product", (x) => x.summary?.product], ["Size", (x) => x.summary?.size], ["Area m2", (x) => x.summary?.area], ["Resolution", (x) => x.summary?.resolution], ["Cabinets", (x) => x.summary?.cabinets], ["Mounting", (x) => x.summary?.mount], ["Est. budget", (x) => x.summary?.budget], ["Photo", (x) => (x.files?.includes("photo") ? "yes" : "no")], ["Customer notes", (x) => x.notes], ["Internal notes", (x) => x.adminNotes]];
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.map((c) => q(c[0])).join(","), ...filtered().map((x) => cols.map((c) => q(c[1](x))).join(","))].join("\r\n");
    download(`enquiries-${new Date().toISOString().slice(0, 10)}.csv`, new Blob(["﻿" + csv], { type: "text/csv" }));
  });

  if (loaded.cfg.updated) $("#lastSaved").textContent = `Last saved ${new Date(loaded.cfg.updated).toLocaleString("en-GB")}.`;
  if (token) showApp(); else showLogin();
})();
