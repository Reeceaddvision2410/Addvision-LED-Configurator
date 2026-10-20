// Add Vision LED configurator: public page.
// Settings (products, options, pricing, branding) come from the admin via /api/config,
// falling back to /assets/default-config.json.
(async function () {
  const { esc, fmt, toast } = AV;
  const $ = (s) => document.querySelector(s);
  const { cfg: CFG } = await AV.loadConfig();
  AV.applyBrand(CFG);

  // ---------- Catalogue from settings ----------
  const num = (v, d = 0) => (isFinite(+v) && v !== "" ? +v : d);
  const ENVS = CFG.environments.filter((e) => e.enabled !== false && CFG.products.some((p) => p.env === e.id && p.enabled !== false));
  const SERIES = {};
  ENVS.forEach((e) => {
    SERIES[e.id] = CFG.products
      .filter((p) => p.env === e.id && p.enabled !== false && num(p.p) > 0 && num(p.cw) > 0 && num(p.ch) > 0)
      .map((p) => ({ ...p, p: num(p.p), cw: num(p.cw), ch: num(p.ch), nits: num(p.nits), kg: num(p.kg), w: num(p.w), refresh: num(p.refresh, 3840), price: num(p.price) }))
      .sort((a, b) => a.p - b.p);
  });
  const MOUNTS = CFG.mounts.filter((m) => m.enabled !== false);
  const ADDONS = CFG.addons.filter((a) => a.enabled !== false);
  if (!ENVS.length) {
    $("#step1").innerHTML = `<div class="intro"><div><h1 class="title">Configurator unavailable</h1><p class="lede">No products are switched on yet. Please contact us on ${esc(CFG.contact.phone)}.</p></div></div>`;
    return;
  }

  const recommendIdx = (env, dist) => { const l = SERIES[env]; let best = 0; l.forEach((p, i) => { if (p.p <= dist) best = i; }); return best; };
  const DEFAULT = { env: ENVS[0].id, pitchIdx: recommendIdx(ENVS[0].id, 4), cols: 6, rows: 4, mount: MOUNTS[0]?.id || "", view: "content", dist: 4, addons: ADDONS.filter((a) => a.default).map((a) => a.id) };
  const saved = loadState();
  let S = Object.assign(structuredClone(DEFAULT), saved || {});
  if (!SERIES[S.env]) S.env = DEFAULT.env;
  if (!MOUNTS.some((m) => m.id === S.mount)) S.mount = DEFAULT.mount;
  S.addons = (S.addons || []).filter((id) => ADDONS.some((a) => a.id === id));

  function loadState() { try { return JSON.parse(localStorage.getItem("av-cfg-v2")); } catch (e) { return null; } }
  function saveState() { try { localStorage.setItem("av-cfg-v2", JSON.stringify(S)); } catch (e) {} }

  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const pitchLabel = (p) => "P" + +p.toFixed(2);
  const product = () => { const l = SERIES[S.env]; if (S.pitchIdx >= l.length || S.pitchIdx < 0) S.pitchIdx = l.length - 1; return l[S.pitchIdx]; };
  const envLabel = () => ENVS.find((e) => e.id === S.env)?.label || S.env;
  const mountLabel = () => MOUNTS.find((m) => m.id === S.mount)?.label || "Not specified";

  function calc() {
    const pr = product();
    const pxW = Math.round(pr.cw / pr.p), pxH = Math.round(pr.ch / pr.p);
    const W = (pr.cw * S.cols) / 1000, H = (pr.ch * S.rows) / 1000, area = W * H;
    const resW = pxW * S.cols, resH = pxH * S.rows, px = resW * resH;
    const diag = Math.sqrt(W * W + H * H) / 0.0254;
    const ratio = resW / resH;
    const g = gcd(resW, resH);
    let ar = `${resW / g}:${resH / g}`;
    for (const [r, n] of [[16 / 9, "16:9"], [21 / 9, "21:9"], [4 / 3, "4:3"], [1, "1:1"], [9 / 16, "9:16"], [32 / 9, "32:9"], [3, "3:1"], [2, "2:1"]]) {
      if (Math.abs(ratio - r) / r < 0.03) { ar = Math.abs(ratio - r) / r < 0.005 ? n : "≈ " + n; break; }
    }
    if (ar.length > 9) ar = ratio.toFixed(2) + ":1";
    const weight = area * pr.kg, maxW = area * pr.w, avgW = maxW * 0.35, amps = maxW / 230;
    const proc = px <= 2.3e6 ? "HD sending processor (up to 2.3 MP)" : px <= 8.9e6 ? "4K sending processor (up to 8.8 MP)" : `Multi-processor array (${Math.ceil(px / 8.8e6)} × 4K)`;
    const ports = Math.ceil(px / 650000);
    const fmtName = resW >= 3840 && resH >= 2160 ? "Native 4K UHD or above" : resW >= 1920 && resH >= 1080 ? "Full HD or above" : resW >= 1280 && resH >= 720 ? "HD 720p class" : "Below HD";
    return { pr, pxW, pxH, W, H, area, resW, resH, px, diag, ar, weight, maxW, avgW, amps, proc, ports, fmtName, cabs: S.cols * S.rows, minView: pr.p, optView: pr.p * 3 };
  }

  function budget(c) {
    if (!CFG.pricing.show || !c.pr.price) return null;
    const cost = (item) => (num(item.price) ? (item.per === "m2" ? c.area * num(item.price) : num(item.price)) : 0);
    let t = c.area * c.pr.price;
    const m = MOUNTS.find((x) => x.id === S.mount); if (m) t += cost(m);
    ADDONS.filter((a) => S.addons.includes(a.id)).forEach((a) => (t += cost(a)));
    const band = num(CFG.pricing.band) / 100, r = (v) => Math.round(v / 100) * 100;
    return { low: r(t * (1 - band)), high: r(t * (1 + band)) };
  }
  const money = (v) => "£" + fmt(v);

  // ---------- Controls ----------
  function renderEnv() {
    $("#envOpts").innerHTML = ENVS.map((e) => `<button class="opt" data-env="${esc(e.id)}" aria-pressed="${S.env === e.id}"><b>${esc(e.label)}</b><span>${esc(e.sub)}</span></button>`).join("");
    $("#envOpts").className = "opts" + (ENVS.length === 2 ? " two" : "");
  }
  function renderPitches() {
    const list = SERIES[S.env], best = recommendIdx(S.env, S.dist);
    $("#pitchOpts").innerHTML = list.map((p, i) => `<button class="pitch ${i === best ? "rec" : ""}" data-pitch="${i}" aria-pressed="${S.pitchIdx === i}" title="${esc(p.name)} ${pitchLabel(p.p)}">${pitchLabel(p.p)}</button>`).join("");
    const pr = product();
    $("#seriesInfo").innerHTML = `<b>${esc(pr.name)} ${pitchLabel(pr.p)}</b> · ${esc(pr.tech)} · ${fmt(pr.nits)} nits · cabinet ${fmt(pr.cw, pr.cw % 1 ? 1 : 0)} × ${fmt(pr.ch, pr.ch % 1 ? 1 : 0)} mm · ${esc(pr.service)} service`;
  }
  function renderMounts() {
    $("#mountOpts").innerHTML = MOUNTS.map((m) => `<button class="opt" data-mount="${esc(m.id)}" aria-pressed="${S.mount === m.id}"><b>${esc(m.label)}</b><span>${esc(m.sub)}</span></button>`).join("");
    $("#mountOpts").closest("section").hidden = !MOUNTS.length;
  }
  function renderAddons() {
    $("#addOns").innerHTML = ADDONS.map((a) => `<label class="check"><input type="checkbox" id="ao-${esc(a.id)}" data-addon="${esc(a.id)}" ${S.addons.includes(a.id) ? "checked" : ""}><span>${esc(a.label)}<small>${esc(a.sub)}</small></span></label>`).join("");
    $("#addOns").closest("section").hidden = !ADDONS.length;
  }
  function renderFormOptions() {
    const fill = (id, list, sel) => ($(id).innerHTML = (list || []).map((o) => `<option${o === sel ? " selected" : ""}>${esc(o)}</option>`).join(""));
    fill("#fSector", CFG.form.sectors); fill("#fWhen", CFG.form.timelines, CFG.form.timelines?.[1]); fill("#fBudget", CFG.form.budgets);
    const c = CFG.contact, lines = [[c.email, c.email], [c.phone, c.phone], [c.whatsapp && "WhatsApp " + c.whatsapp, c.whatsapp]].filter((l) => l[0]);
    $("#contactLines").innerHTML = lines.map(([t, v]) => `<div class="line"><span>${esc(t)}</span><button class="btn ghost small" data-copy="${esc(v)}">Copy</button></div>`).join("");
  }
  function renderAll() { renderEnv(); renderPitches(); renderMounts(); renderAddons(); }

  function update() {
    S.cols = Math.max(1, Math.min(80, S.cols | 0)); S.rows = Math.max(1, Math.min(50, S.rows | 0));
    const c = calc();
    $("#cols").value = S.cols; $("#rows").value = S.rows;
    $("#wOut").textContent = fmt(c.W, 2) + " m"; $("#hOut").textContent = fmt(c.H, 2) + " m";
    $("#viewDist").value = S.dist; $("#viewDistOut").textContent = fmt(S.dist, S.dist % 1 ? 1 : 0) + " m";
    $("#stageTitle").textContent = `${fmt(c.W, 2)} × ${fmt(c.H, 2)} m  ·  ${c.cabs} cabinets  ·  ${mountLabel()}`;
    document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.view === S.view));
    const tiles = [
      ["Resolution", `${fmt(c.resW)} × ${fmt(c.resH)}`, `${fmt(c.px / 1e6, 2)} megapixels`],
      ["Screen size", `${fmt(c.W, 2)} × ${fmt(c.H, 2)} m`, `${fmt(c.area, 2)} m² · ${fmt(c.diag)}″ diagonal`],
      ["Aspect ratio", c.ar, c.fmtName],
      ["Brightness", `${fmt(c.pr.nits)} nits`, `${c.pr.refresh} Hz refresh`],
      ["Weight", `${fmt(c.weight)} kg`, `${c.pr.kg} kg/m² excl. structure`],
      ["Power max", `${fmt(c.maxW / 1000, 1)} kW`, `${fmt(c.amps, 1)} A at 230 V`],
      ["Power typical", `${fmt(c.avgW / 1000, 1)} kW`, `≈ ${fmt((c.avgW * 12 * 365) / 1000)} kWh/yr at 12 h/day`],
      ["Viewing distance", `${fmt(c.minView, 1)}–${fmt(c.optView, 1)} m`, "minimum – optimal"],
    ];
    $("#readout").innerHTML = tiles.map((t) => `<div><dt>${t[0]}</dt><dd>${t[1]}<small>${t[2]}</small></dd></div>`).join("");
    const b = budget(c);
    $("#budget").hidden = !b;
    if (b) $("#budget").innerHTML = `<span class="eyebrow">Indicative budget</span><b>${money(b.low)} – ${money(b.high)}</b><span>${esc(CFG.pricing.note)}</span>`;
    renderNotes(c);
    drawScene(c);
    mkSync(c);
    saveState();
  }

  function renderNotes(c) {
    const n = [], list = SERIES[S.env], P = pitchLabel(c.pr.p);
    if (c.pr.p > S.dist) n.push(["warn", "Pitch", `${P} is coarse for viewers at ${S.dist} m. Pixels will be visible; consider ${pitchLabel(list[recommendIdx(S.env, S.dist)].p)} or finer.`]);
    else if (c.pr.p < S.dist / 3) n.push(["info", "Pitch", `${P} is finer than you need at ${S.dist} m. A coarser pitch would look the same from there and cost less.`]);
    else n.push(["ok", "Pitch", `${P} is a good match for a closest viewer at ${S.dist} m.`]);
    if (c.resW >= 1920 && c.resH >= 1080) n.push(["ok", "Content", `Takes full HD content natively${c.resW >= 3840 && c.resH >= 2160 ? ", and 4K" : ""}. Content plays at ${fmt(c.resW)} × ${fmt(c.resH)} pixel-for-pixel.`]);
    else n.push(["info", "Content", `Content will be built at ${fmt(c.resW)} × ${fmt(c.resH)} px. Video is scaled to fit, so we design launch content at exact resolution.`]);
    n.push(["info", "Processing", `${c.proc}, ${c.ports} LAN output${c.ports > 1 ? "s" : ""}, ${c.cabs} receiving cards.`]);
    const circuits = Math.ceil(c.amps / 13);
    n.push([c.amps > 32 ? "warn" : "info", "Power", c.amps > 32 ? `${fmt(c.amps, 1)} A at full white. Needs a dedicated distribution board or 3-phase supply. We cover this in the survey.` : `${fmt(c.amps, 1)} A at full white: about ${circuits} × 13 A circuit${circuits > 1 ? "s" : ""} or one dedicated 32 A supply.`]);
    if (S.env !== "indoor" && S.mount === "hung") n.push(["warn", "Mounting", "Flown outdoor or window screens need wind-load and rigging calculations. We'll include these in the survey."]);
    if (S.mount === "wall" && c.weight > 500) n.push(["warn", "Structure", `${fmt(c.weight)} kg on a wall needs a structural check or floor-loaded frame.`]);
    $("#notes").innerHTML = n.map((x) => `<div class="note"><span class="chip ${x[0]}">${x[1]}</span><span>${x[2]}</span></div>`).join("");
  }

  // ---------- Brand logo for screens and mockups ----------
  const LOGO = new Image();
  LOGO.onload = () => update();
  LOGO.src = CFG.brand.logo || "/assets/logo-light.svg";
  const logoReady = () => LOGO.complete && LOGO.naturalWidth > 0;

  // ---------- Step 1 scale preview ----------
  const cv = $("#scene"), ctx = cv.getContext("2d");
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  function drawDemo(g, x, y, w, h, c) {
    const grad = g.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, "#0d1622"); grad.addColorStop(0.45, "#172335"); grad.addColorStop(0.8, "#068aaf"); grad.addColorStop(1, css("--accent") || "#71c8fa");
    g.fillStyle = grad; g.fillRect(x, y, w, h);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.globalAlpha = 0.18; g.fillStyle = "#fff";
    for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(x + w * (0.15 + i * 0.13), y + h * (0.3 + 0.4 * Math.sin(i * 1.7)), Math.min(w, h) * (0.08 + 0.05 * (i % 3)), 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
    if (logoReady() && !CFG.brand.demoText) {
      const ar = LOGO.naturalWidth / LOGO.naturalHeight; let lw = w * 0.62, lh = lw / ar;
      if (lh > h * 0.42) { lh = h * 0.42; lw = lh * ar; }
      g.drawImage(LOGO, x + (w - lw) / 2, y + (h - lh) / 2 - h * 0.05, lw, lh);
      g.globalAlpha = 0.8; g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "top";
      g.font = `500 ${Math.max(5, lh * 0.2)}px Jost, Futura, sans-serif`;
      g.fillText(`${fmt(c.resW)} × ${fmt(c.resH)} · ${fmt(c.pr.nits)} nits`, x + w / 2, y + (h + lh) / 2 - h * 0.02);
      g.restore(); g.globalAlpha = 1; return;
    }
    const text = CFG.brand.demoText || CFG.brand.company.toUpperCase();
    let fs = Math.max(6, Math.min(w / 9, h / 3.5));
    g.font = `800 ${fs}px Jost, Futura, sans-serif`;
    const tw = g.measureText(text).width; if (tw > w * 0.86) { fs *= (w * 0.86) / tw; g.font = `800 ${fs}px Jost, Futura, sans-serif`; }
    g.fillStyle = "#fff"; g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.fillText(text, x + w * 0.07, y + h * 0.55);
    g.font = `500 ${fs * 0.32}px Jost, Futura, sans-serif`; g.globalAlpha = 0.85;
    g.fillText(`${fmt(c.resW)} × ${fmt(c.resH)} · ${fmt(c.pr.nits)} nits`, x + w * 0.07, y + h * 0.55 + fs * 0.55);
    g.restore(); g.globalAlpha = 1;
  }

  function drawScene(c) {
    const Wc = cv.width, Hc = cv.height;
    const col = { stage: css("--stage"), floor: css("--stage-floor"), ink: css("--ink"), muted: css("--muted"), line: css("--line") };
    ctx.clearRect(0, 0, Wc, Hc); ctx.fillStyle = col.stage; ctx.fillRect(0, 0, Wc, Hc);
    const elev = S.mount === "floor" ? 0 : S.mount === "pole" ? 2.2 : S.mount === "hung" ? 2.5 : Math.max(0.6, Math.min(1.0, 3 - c.H));
    const sceneW = Math.max(c.W + 2.2, 4.5), sceneH = Math.max(elev + c.H + 0.8, 3.2);
    const pad = 70, floorY = Hc - 110, scale = Math.min((Wc - pad * 2) / sceneW, (floorY - 50) / sceneH);
    const sw = c.W * scale, sh = c.H * scale, x0 = Wc / 2 - sw / 2 + (1.0 * scale) / 2, yTop = floorY - (elev + c.H) * scale;
    ctx.fillStyle = col.floor; ctx.fillRect(0, floorY, Wc, Hc - floorY);
    ctx.strokeStyle = col.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(Wc, floorY); ctx.stroke();
    ctx.fillStyle = col.muted;
    if (S.mount === "pole") { const pw = Math.max(10, 0.2 * scale); ctx.fillRect(x0 + sw / 2 - pw / 2, yTop + sh, pw, floorY - (yTop + sh)); ctx.fillRect(x0 + sw / 2 - pw * 2, floorY - 6, pw * 4, 6); }
    if (S.mount === "hung") { ctx.strokeStyle = col.muted; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); [x0 + sw * 0.2, x0 + sw * 0.8].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, yTop); ctx.stroke(); }); ctx.setLineDash([]); }
    if (S.mount === "floor") ctx.fillRect(x0 - 6, floorY - 4, sw + 12, 4);
    ctx.fillStyle = "#05070b"; ctx.fillRect(x0 - 4, yTop - 4, sw + 8, sh + 8);
    if (S.view === "content") drawDemo(ctx, x0, yTop, sw, sh, c); else { ctx.fillStyle = "#11161f"; ctx.fillRect(x0, yTop, sw, sh); }
    const cwPx = sw / S.cols, chPx = sh / S.rows;
    ctx.strokeStyle = S.view === "content" ? "rgba(0,0,0,.35)" : "rgba(255,255,255,.28)"; ctx.lineWidth = S.view === "content" ? 1 : 1.5;
    for (let i = 1; i < S.cols; i++) { ctx.beginPath(); ctx.moveTo(x0 + i * cwPx, yTop); ctx.lineTo(x0 + i * cwPx, yTop + sh); ctx.stroke(); }
    for (let j = 1; j < S.rows; j++) { ctx.beginPath(); ctx.moveTo(x0, yTop + j * chPx); ctx.lineTo(x0 + sw, yTop + j * chPx); ctx.stroke(); }
    if (S.view === "cabinets" && cwPx > 26 && chPx > 16) {
      ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.font = `${Math.min(15, cwPx / 4)}px IBM Plex Mono, monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (let j = 0; j < S.rows; j++) for (let i = 0; i < S.cols; i++) ctx.fillText(String.fromCharCode(65 + (j % 26)) + (i + 1), x0 + i * cwPx + cwPx / 2, yTop + j * chPx + chPx / 2);
    }
    ctx.strokeStyle = col.ink; ctx.fillStyle = col.ink; ctx.lineWidth = 1.5;
    ctx.font = "600 22px IBM Plex Mono, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    const line = (a, b, c2, d) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c2, d); ctx.stroke(); };
    const tick = (x, y, o) => { ctx.beginPath(); if (o === "v") { ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8); } else { ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); } ctx.stroke(); };
    const label = (t, x, y) => { const w = ctx.measureText(t).width + 14; ctx.save(); ctx.fillStyle = col.stage; ctx.fillRect(x - w / 2, y - (ctx.textBaseline === "top" ? -2 : 26), w, 26); ctx.restore(); ctx.fillText(t, x, y); };
    const dy = yTop - 22; line(x0, dy, x0 + sw, dy); tick(x0, dy, "v"); tick(x0 + sw, dy, "v"); label(`${fmt(c.W, 2)} m`, x0 + sw / 2, dy - 6);
    const dx = x0 + sw + 26; line(dx, yTop, dx, yTop + sh); tick(dx, yTop, "h"); tick(dx, yTop + sh, "h");
    ctx.save(); ctx.translate(dx + 12, yTop + sh / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "top"; label(`${fmt(c.H, 2)} m`, 0, 0); ctx.restore();
    const ph = 1.75 * scale, px = x0 - 0.75 * scale, u = ph / 7.5;
    ctx.fillStyle = col.ink;
    ctx.beginPath(); ctx.arc(px, floorY - ph + u * 0.5, u * 0.5, 0, Math.PI * 2); ctx.fill();
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill(); };
    rr(px - u * 0.85, floorY - ph + u * 1.15, u * 1.7, u * 3.0, u * 0.4); rr(px - u * 0.7, floorY - u * 3.4, u * 0.6, u * 3.4, u * 0.25); rr(px + u * 0.1, floorY - u * 3.4, u * 0.6, u * 3.4, u * 0.25);
    ctx.fillStyle = col.muted; ctx.font = "18px IBM Plex Mono, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("1.75 m", px, floorY + 10);
    ctx.textAlign = "left"; ctx.fillText(`${fmt(c.resW)} × ${fmt(c.resH)} px · ${c.pr.name} ${pitchLabel(c.pr.p)} · ${S.cols} × ${S.rows} cabinets`, 24, Hc - 40);
  }

  // ---------- Step 2: real-size mockup maker ----------
  const mk = $("#mk"), mctx = mk.getContext("2d");
  const MK = { img: null, sample: false, mode: "empty", line: null, pxPerM: 0, pos: null, art: null, content: "demo", night: false, label: true, drag: null };

  function mkScaleK() { const r = mk.getBoundingClientRect(); return r.width ? Math.max(1, mk.width / r.width) : 1; }
  function mkRefLen() { const v = $("#mkRef").value; return v === "custom" ? parseFloat(($("#mkCustom").value || "").replace(",", ".")) : parseFloat(v); }
  function mkBox(c = calc()) { const w = c.W * MK.pxPerM, h = c.H * MK.pxPerM; return { x: MK.pos.x - w / 2, y: MK.pos.y - h / 2, w, h }; }

  function mkSetImage(src, sample) {
    const s = Math.min(1, 1800 / Math.max(src.width, src.height));
    mk.width = Math.round(src.width * s); mk.height = Math.round(src.height * s);
    MK.img = src; MK.sample = Boolean(sample);
    $("#mkEmpty").hidden = true;
    if (sample) {
      MK.line = { ...sample.line }; MK.pxPerM = sample.pxPerM; MK.pos = { ...sample.pos }; MK.mode = "place";
      $("#mkRef").value = "2.0"; $("#mkCustomWrap").hidden = true;
    } else {
      const W = mk.width, H = mk.height;
      MK.line = { x1: W * 0.18, y1: H * 0.45, x2: W * 0.18, y2: H * 0.85 }; MK.pxPerM = 0; MK.pos = null; MK.mode = "scale";
    }
    mkSync(); mk.focus({ preventScroll: true });
  }

  function mkFinishScale() {
    const m = mkRefLen();
    if (!(m > 0)) { toast("Enter the real length in metres, for example 4.5"); $("#mkCustom").focus(); return; }
    const L = MK.line, len = Math.hypot(L.x2 - L.x1, L.y2 - L.y1);
    if (len < 10) { toast("Drag the dots further apart first."); return; }
    MK.pxPerM = len / m;
    if (!MK.pos) MK.pos = { x: mk.width / 2, y: mk.height * 0.42 };
    MK.mode = "place"; mkSync();
    toast("Screen placed at real size. Drag it into position.");
  }

  function mkClamp() { if (!MK.pos) return; MK.pos.x = Math.min(mk.width, Math.max(0, MK.pos.x)); MK.pos.y = Math.min(mk.height, Math.max(0, MK.pos.y)); }

  function mkSync(c = calc()) {
    $("#mkSizeLbl").textContent = `${fmt(c.W, 2)} × ${fmt(c.H, 2)} m screen`;
    $("#mkCols").value = S.cols; $("#mkRows").value = S.rows;
    $("#mkW").textContent = fmt(c.W, 2) + " m"; $("#mkH").textContent = fmt(c.H, 2) + " m";
    $("#mkStepScale").classList.toggle("off", !MK.img);
    $("#mkStepPlace").classList.toggle("off", MK.mode !== "place");
    $("#mkStepPhoto").hidden = !MK.img;
    $("#mkScaleDone").hidden = MK.mode !== "scale"; $("#mkScaleEdit").hidden = MK.mode !== "place";
    const st = $("#mkStatus");
    if (!MK.img) st.innerHTML = `<span class="chip info">Start</span><span>Upload a photo, or try the sample shopfront to see how it works.</span>`;
    else if (MK.mode === "scale") st.innerHTML = `<span class="chip accent">Scale</span><span>Drag the orange dots to each end of your ${esc($("#mkRef").selectedOptions[0].text.replace(/ \(.*/, "").toLowerCase())}, then press <b>Place my screen</b>.</span>`;
    else {
      const b = mkBox(c), tooBig = b.w > mk.width * 1.02 || b.h > mk.height * 1.02, tiny = b.w < 24;
      st.innerHTML = tooBig ? `<span class="chip warn">Check</span><span>The screen is bigger than your photo. Check the scale, or make the screen smaller.</span>`
        : tiny ? `<span class="chip warn">Check</span><span>The screen looks very small. Check the scale line covers the whole door.</span>`
        : `<span class="chip ok">Real size</span><span>${fmt(c.W, 2)} × ${fmt(c.H, 2)} m ${esc(c.pr.name)} ${pitchLabel(c.pr.p)}, scaled from your ${MK.sample ? "sample" : "photo"}. Drag it to move it.</span>`;
    }
    mkDraw(false, c);
  }

  function pill(g, text, x, y, k, bg, fg, align = "center") {
    g.font = `600 ${12 * k}px IBM Plex Mono, monospace`; g.textBaseline = "middle"; g.textAlign = "left";
    const w = g.measureText(text).width + 16 * k, h = 24 * k;
    let lx = align === "center" ? x - w / 2 : x; lx = Math.min(Math.max(4, lx), mk.width - w - 4);
    const ly = Math.min(Math.max(4, y), mk.height - h - 4);
    g.fillStyle = bg; g.beginPath(); g.roundRect ? g.roundRect(lx, ly, w, h, 4 * k) : g.rect(lx, ly, w, h); g.fill();
    g.fillStyle = fg; g.fillText(text, lx + 8 * k, ly + h / 2);
  }

  function mkDraw(exporting = false, c = calc(), g = mctx) {
    const W = mk.width, H = mk.height, k = exporting ? Math.max(1, W / 900) : mkScaleK(), accent = css("--accent") || "#e2541c";
    g.clearRect(0, 0, W, H);
    if (!MK.img) { g.fillStyle = css("--stage"); g.fillRect(0, 0, W, H); return; }
    g.drawImage(MK.img, 0, 0, W, H);
    if (MK.night) { g.fillStyle = "rgba(4,8,20,.62)"; g.fillRect(0, 0, W, H); }

    if (MK.mode === "scale" && !exporting) {
      const L = MK.line;
      g.strokeStyle = "rgba(0,0,0,.55)"; g.lineWidth = 7 * k; g.beginPath(); g.moveTo(L.x1, L.y1); g.lineTo(L.x2, L.y2); g.stroke();
      g.strokeStyle = accent; g.lineWidth = 3 * k; g.beginPath(); g.moveTo(L.x1, L.y1); g.lineTo(L.x2, L.y2); g.stroke();
      [[L.x1, L.y1], [L.x2, L.y2]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 11 * k, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill(); g.lineWidth = 4 * k; g.strokeStyle = accent; g.stroke(); });
      const m = mkRefLen();
      pill(g, m > 0 ? `${fmt(m, m % 1 ? 2 : 1)} m` : "? m", (L.x1 + L.x2) / 2 + 18 * k, (L.y1 + L.y2) / 2 - 12 * k, k, accent, css("--accent-ink") || "#fff", "left");
      return;
    }
    if (MK.mode !== "place" || !MK.pos) return;

    const b = mkBox(c), bez = Math.max(2, 0.025 * MK.pxPerM);
    g.save();
    if (MK.night) { g.shadowColor = "rgba(110,160,255,.75)"; g.shadowBlur = Math.max(20, b.w * 0.12); }
    g.fillStyle = "#05070b"; g.fillRect(b.x - bez, b.y - bez, b.w + bez * 2, b.h + bez * 2);
    g.restore();
    g.save(); g.beginPath(); g.rect(b.x, b.y, b.w, b.h); g.clip();
    if (MK.content === "art" && MK.art) {
      const s = Math.max(b.w / MK.art.width, b.h / MK.art.height), aw = MK.art.width * s, ah = MK.art.height * s;
      g.drawImage(MK.art, b.x + (b.w - aw) / 2, b.y + (b.h - ah) / 2, aw, ah);
    } else if (MK.content === "grid") { g.fillStyle = "#11161f"; g.fillRect(b.x, b.y, b.w, b.h); }
    else drawDemo(g, b.x, b.y, b.w, b.h, c);
    if (!MK.night) { const sh = g.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h); sh.addColorStop(0, "rgba(255,255,255,.10)"); sh.addColorStop(0.5, "rgba(255,255,255,0)"); g.fillStyle = sh; g.fillRect(b.x, b.y, b.w, b.h); }
    const cw = b.w / S.cols, ch = b.h / S.rows;
    if (cw > 5 && ch > 5) {
      g.strokeStyle = MK.content === "grid" ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.22)"; g.lineWidth = Math.max(1, k * 0.8);
      for (let i = 1; i < S.cols; i++) { g.beginPath(); g.moveTo(b.x + i * cw, b.y); g.lineTo(b.x + i * cw, b.y + b.h); g.stroke(); }
      for (let j = 1; j < S.rows; j++) { g.beginPath(); g.moveTo(b.x, b.y + j * ch); g.lineTo(b.x + b.w, b.y + j * ch); g.stroke(); }
    }
    g.restore();
    if (!exporting) { g.setLineDash([8 * k, 6 * k]); g.strokeStyle = accent; g.lineWidth = 2 * k; g.strokeRect(b.x - bez - 3 * k, b.y - bez - 3 * k, b.w + (bez + 3 * k) * 2, b.h + (bez + 3 * k) * 2); g.setLineDash([]); }
    if (MK.label) {
      const t = `${fmt(c.W, 2)} × ${fmt(c.H, 2)} m · ${pitchLabel(c.pr.p)}`, top = b.y - bez - 30 * k;
      pill(g, t, b.x + b.w / 2, top < 4 ? b.y + b.h + bez + 6 * k : top, k, accent, css("--accent-ink") || "#fff");
    }
    if (exporting) {
      const h = 40 * k; g.fillStyle = "#141414"; g.globalAlpha = 0.88; g.fillRect(0, H - h, W, h); g.globalAlpha = 1;
      g.fillStyle = css("--brand-fg") || "#fff"; g.textAlign = "left"; g.textBaseline = "middle";
      let cw2;
      if (logoReady()) { const lh = h * 0.62, lw = lh * (LOGO.naturalWidth / LOGO.naturalHeight); g.drawImage(LOGO, 12 * k, H - h / 2 - lh / 2, lw, lh); cw2 = lw + 6 * k; }
      else { g.font = `700 ${13 * k}px Jost, Futura, sans-serif`; g.fillText(CFG.brand.company.toUpperCase(), 12 * k, H - h / 2); cw2 = g.measureText(CFG.brand.company.toUpperCase()).width; }
      g.font = `${11 * k}px IBM Plex Mono, monospace`; g.globalAlpha = 0.8;
      g.fillText(`  ${c.pr.name} ${pitchLabel(c.pr.p)} · ${fmt(c.W, 2)} × ${fmt(c.H, 2)} m · ${fmt(c.resW)} × ${fmt(c.resH)} px${ref ? " · " + ref : ""}`, 12 * k + cw2, H - h / 2);
      g.globalAlpha = 1;
    }
  }

  function mkExportCanvas(maxSide = 1800) {
    const c = calc(), out = document.createElement("canvas"), s = Math.min(1, maxSide / Math.max(mk.width, mk.height));
    out.width = Math.round(mk.width * s); out.height = Math.round(mk.height * s);
    const g = out.getContext("2d"); g.save(); g.scale(s, s);
    mkDraw(true, c, g); g.restore();
    return out;
  }
  const mkReady = () => Boolean(MK.img && MK.mode === "place");
  const toBlob = (canvas, q = 0.85) => new Promise((res) => canvas.toBlob(res, "image/jpeg", q));
  function shrink(src, maxSide) { const s = Math.min(1, maxSide / Math.max(src.width, src.height)), c = document.createElement("canvas"); c.width = Math.round(src.width * s); c.height = Math.round(src.height * s); c.getContext("2d").drawImage(src, 0, 0, c.width, c.height); return c; }

  function sampleShopfront() {
    const W = 1800, H = 1100, ppm = 150, ground = 960, c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"), m = (v) => v * ppm;
    let sky = g.createLinearGradient(0, 0, 0, 300); sky.addColorStop(0, "#9fbbd6"); sky.addColorStop(1, "#dbe5ee"); g.fillStyle = sky; g.fillRect(0, 0, W, 300);
    g.fillStyle = "#b9a58f"; g.fillRect(0, 40, W, ground - 40);
    g.strokeStyle = "rgba(80,60,40,.18)"; g.lineWidth = 1; for (let y = 52; y < ground; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.fillStyle = "#8d7a66"; g.fillRect(0, 40, W, 16);
    for (const x of [240, 640, 1040, 1440]) { g.fillStyle = "#e9e4dc"; g.fillRect(x - 6, ground - m(5.6) - 6, m(1.1) + 12, m(1.6) + 12); g.fillStyle = "#3d4a57"; g.fillRect(x, ground - m(5.6), m(1.1), m(1.6)); g.fillStyle = "#e9e4dc"; g.fillRect(x + m(0.55) - 3, ground - m(5.6), 6, m(1.6)); g.fillRect(x, ground - m(4.8) - 3, m(1.1), 6); }
    g.fillStyle = "#1c2a3a"; g.fillRect(150, ground - m(4.1), 1500, m(0.8));
    g.fillStyle = "#f2efe8"; g.font = "700 64px Jost, Futura, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("YOUR SHOP", 900, ground - m(3.7));
    g.fillStyle = "#2a3540"; g.fillRect(150, ground - m(3.3), 1500, m(3.3));
    const glass = g.createLinearGradient(0, ground - m(3.2), 0, ground); glass.addColorStop(0, "#4b6377"); glass.addColorStop(1, "#22303d");
    g.fillStyle = glass; g.fillRect(170, ground - m(3.15), 1060, m(2.85));
    g.fillStyle = "rgba(255,255,255,.08)"; g.beginPath(); g.moveTo(300, ground - m(3.15)); g.lineTo(520, ground - m(3.15)); g.lineTo(320, ground - m(0.3)); g.lineTo(170, ground - m(0.3)); g.closePath(); g.fill();
    g.fillStyle = "#2a3540"; g.fillRect(690, ground - m(3.15), 14, m(2.85));
    g.fillStyle = "#cfd5da"; g.fillRect(150, ground - m(0.3), 1100, m(0.3));
    g.fillStyle = "#4b6377"; g.fillRect(1250, ground - m(3.15), 380, m(0.95));
    const dx = 1370, dw = m(0.9), dh = m(2.0);
    g.fillStyle = "#11181f"; g.fillRect(dx - 8, ground - dh - 8, dw + 16, dh + 8);
    g.fillStyle = glass; g.fillRect(dx, ground - dh, dw, dh);
    g.fillStyle = "#c9a54a"; g.fillRect(dx + 14, ground - m(1.05), 6, 40);
    g.fillStyle = "#9aa3ab"; g.fillRect(0, ground, W, H - ground);
    g.strokeStyle = "rgba(0,0,0,.12)"; for (let x = 0; x < W; x += 120) { g.beginPath(); g.moveTo(x, ground); g.lineTo(x - 60, H); g.stroke(); }
    g.fillStyle = "#7d868e"; g.fillRect(0, ground, W, 10);
    return { canvas: c, info: { pxPerM: ppm, line: { x1: dx - 4, y1: ground, x2: dx - 4, y2: ground - dh }, pos: { x: 700, y: ground - m(1.75) } } };
  }

  function mkPoint(e) { const r = mk.getBoundingClientRect(); return { x: ((e.clientX - r.left) * mk.width) / r.width, y: ((e.clientY - r.top) * mk.height) / r.height, k: Math.max(1, mk.width / r.width) }; }
  function mkHit(p) {
    if (MK.mode === "scale") { const R = 22 * p.k, L = MK.line; if (Math.hypot(p.x - L.x1, p.y - L.y1) < R) return "a"; if (Math.hypot(p.x - L.x2, p.y - L.y2) < R) return "b"; return null; }
    if (MK.mode === "place" && MK.pos) { const b = mkBox(); const pad = 6 * p.k; if (p.x > b.x - pad && p.x < b.x + b.w + pad && p.y > b.y - pad && p.y < b.y + b.h + pad) return "move"; }
    return null;
  }
  mk.addEventListener("pointerdown", (e) => {
    const p = mkPoint(e), h = mkHit(p); if (!h) return;
    MK.drag = { h, ox: h === "move" ? p.x - MK.pos.x : 0, oy: h === "move" ? p.y - MK.pos.y : 0 };
    mk.setPointerCapture(e.pointerId); e.preventDefault();
  });
  mk.addEventListener("pointermove", (e) => {
    const p = mkPoint(e);
    if (!MK.drag) { const h = mkHit(p); mk.style.cursor = h === "move" ? "move" : h ? "grab" : "default"; return; }
    const cx = Math.min(mk.width, Math.max(0, p.x)), cy = Math.min(mk.height, Math.max(0, p.y));
    if (MK.drag.h === "a") { MK.line.x1 = cx; MK.line.y1 = cy; }
    else if (MK.drag.h === "b") { MK.line.x2 = cx; MK.line.y2 = cy; }
    else { MK.pos.x = p.x - MK.drag.ox; MK.pos.y = p.y - MK.drag.oy; mkClamp(); }
    mkDraw();
  });
  const mkEnd = () => { if (MK.drag) { MK.drag = null; mkSync(); } };
  mk.addEventListener("pointerup", mkEnd); mk.addEventListener("pointercancel", mkEnd);
  mk.addEventListener("keydown", (e) => {
    if (MK.mode !== "place" || !MK.pos) return;
    const step = (e.shiftKey ? 0.5 : 0.05) * MK.pxPerM, d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return; e.preventDefault(); MK.pos.x += d[0] * step; MK.pos.y += d[1] * step; mkClamp(); mkDraw();
  });

  function readImage(file, cb) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif|bmp)$/.test(file.type)) { toast("Use a JPG or PNG image. iPhone HEIC photos can be exported as JPG first."); return; }
    const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => cb(im); im.onerror = () => toast("That image couldn't be opened. Try a JPG or PNG."); im.src = r.result; };
    r.readAsDataURL(file);
  }
  $("#mkFile").addEventListener("change", (e) => { readImage(e.target.files[0], (im) => { mkSetImage(im, null); toast("Photo added. Now set the scale."); }); e.target.value = ""; });
  $("#mkArt").addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) { if (!MK.art) { $("#mkContent").value = "demo"; MK.content = "demo"; mkDraw(); } return; }
    readImage(f, (im) => { MK.art = shrink(im, 1600); MK.content = "art"; mkDraw(); toast("Artwork added to the screen."); });
    e.target.value = "";
  });
  const stageEl = $("#mkStage");
  stageEl.addEventListener("dragover", (e) => { e.preventDefault(); stageEl.classList.add("drop"); });
  stageEl.addEventListener("dragleave", () => stageEl.classList.remove("drop"));
  stageEl.addEventListener("drop", (e) => { e.preventDefault(); stageEl.classList.remove("drop"); readImage(e.dataTransfer.files[0], (im) => mkSetImage(im, null)); });
  ["#mkFileBtn", "#mkFileBtn2"].forEach((id) => $(id).addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("#mkFile").click(); } }));
  $("#mkRef").addEventListener("change", () => { $("#mkCustomWrap").hidden = $("#mkRef").value !== "custom"; if (MK.mode === "place") mkFinishScale(); else mkSync(); });
  $("#mkCustom").addEventListener("input", () => mkDraw());
  $("#mkCustom").addEventListener("keydown", (e) => { if (e.key === "Enter") mkFinishScale(); });
  $("#mkContent").addEventListener("change", (e) => { MK.content = e.target.value; if (MK.content === "art" && !MK.art) $("#mkArt").click(); mkDraw(); });
  $("#mkNight").addEventListener("change", (e) => { MK.night = e.target.checked; mkDraw(); });
  $("#mkLabel").addEventListener("change", (e) => { MK.label = e.target.checked; mkDraw(); });
  addEventListener("resize", () => { if (!$("#step2").hidden) mkDraw(); });

  // ---------- Steps ----------
  let step = 1, ref = "";
  function go(n) {
    if (n === 4 && !validate()) n = 3;
    step = n;
    [1, 2, 3, 4].forEach((i) => ($("#step" + i).hidden = i !== n));
    document.querySelectorAll("#steps button").forEach((b) => {
      const i = +b.dataset.go; b.removeAttribute("aria-current"); if (i === n) b.setAttribute("aria-current", "step"); b.classList.toggle("done", i < n);
    });
    if (n === 2) mkSync();
    if (n === 3) renderMini();
    if (n === 4) renderReview();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function mockDataURL() { return mkReady() ? mkExportCanvas(1200).toDataURL("image/jpeg", 0.82) : ""; }
  function renderMini() {
    const c = calc();
    const rows = [["Environment", envLabel()], ["Product", `${c.pr.name} ${pitchLabel(c.pr.p)}`], ["Size", `${fmt(c.W, 2)} × ${fmt(c.H, 2)} m`], ["Resolution", `${fmt(c.resW)} × ${fmt(c.resH)}`], ["Cabinets", `${S.cols} × ${S.rows} (${c.cabs})`], ["Mounting", mountLabel()], ["Weight", `${fmt(c.weight)} kg`], ["Power max", `${fmt(c.maxW / 1000, 1)} kW`]];
    const b = budget(c); if (b) rows.push(["Budget", `${money(b.low)} – ${money(b.high)}`]);
    $("#miniSum").innerHTML = rows.map((r) => `<div><span>${esc(r[0])}</span><span>${esc(r[1])}</span></div>`).join("");
    const url = mockDataURL(); $("#miniMock").hidden = !url; if (url) $("#miniMock").src = url;
  }
  const F = (id) => $("#" + id).value.trim();
  function validate() {
    let ok = true;
    const checks = [["fName", (v) => v.length > 1, "Enter your name."], ["fEmail", (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter an email address like name@company.co.uk."], ["fPhone", (v) => v.replace(/\D/g, "").length >= 10, "Enter a phone number with at least 10 digits."]];
    for (const [id, fn, msg] of checks) {
      const el = $("#" + id), err = el.parentElement.querySelector(".err"), good = fn(el.value.trim());
      err.hidden = good; err.textContent = good ? "" : msg; el.setAttribute("aria-invalid", !good);
      if (!good && ok) { ok = false; if (step === 3) el.focus(); }
    }
    return ok;
  }
  function specGroups(c) {
    const addons = ADDONS.filter((a) => S.addons.includes(a.id)).map((a) => a.label), b = budget(c);
    const groups = [
      ["Screen", [["Environment", envLabel()], ["Product series", `${c.pr.name} ${pitchLabel(c.pr.p)} (${+c.pr.p.toFixed(3)} mm)`], ["LED technology", c.pr.tech], ["Cabinet size", `${c.pr.cw} × ${c.pr.ch} mm (${c.pxW} × ${c.pxH} px)`], ["Cabinet layout", `${S.cols} wide × ${S.rows} high = ${c.cabs} cabinets`], ["Screen size", `${fmt(c.W, 3)} × ${fmt(c.H, 3)} m (${fmt(c.area, 2)} m², ${fmt(c.diag)}″)`], ["Resolution", `${fmt(c.resW)} × ${fmt(c.resH)} px (${fmt(c.px / 1e6, 2)} MP)`], ["Aspect ratio", c.ar], ["Brightness", `${fmt(c.pr.nits)} nits`], ["Refresh rate", `${c.pr.refresh} Hz`], ["Service access", c.pr.service]]],
      ["Installation", [["Mounting", mountLabel()], ["Closest viewer", `${S.dist} m`], ["Weight (screen only)", `${fmt(c.weight)} kg`], ["Power max / typical", `${fmt(c.maxW / 1000, 2)} kW / ${fmt(c.avgW / 1000, 2)} kW`], ["Current at 230 V", `${fmt(c.amps, 1)} A`], ["Processing", `${c.proc}, ${c.ports} LAN output${c.ports > 1 ? "s" : ""}`], ["Site photo", mkReady() && !MK.sample ? "Supplied, with mockup" : "Not supplied"]]],
      ["Services", [["Included", addons.length ? addons.join(", ") : "None selected"]]],
    ];
    if (b) groups.push(["Budget", [["Indicative budget", `${money(b.low)} – ${money(b.high)}`], ["Note", CFG.pricing.note]]]);
    groups.push(["Contact", [["Name", F("fName")], ["Company", F("fCompany") || "—"], ["Email", F("fEmail")], ["Phone", F("fPhone")], ["Postcode", F("fPost") || "—"], ["Sector", F("fSector")], ["Timeline", F("fWhen")], ["Budget guide", F("fBudget")], ["Notes", F("fNotes") || "—"]]]);
    return groups;
  }
  function renderReview() {
    const c = calc();
    if (!ref) { const d = new Date(); ref = `AV-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }
    $("#refNo").textContent = "Reference " + ref;
    const groups = specGroups(c);
    $("#specTable").innerHTML = groups.map((g) => `<tr class="h"><th colspan="2">${g[0]}</th></tr>` + g[1].map((r) => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join("")).join("");
    const text = `${CFG.brand.company} LED configuration — ${ref}\n` + groups.map((g) => `\n${g[0].toUpperCase()}\n` + g[1].map((r) => `${r[0]}: ${r[1]}`).join("\n")).join("\n");
    $("#specText").value = text; $("#hRef").value = ref; $("#hSpec").value = text;
    const url = mockDataURL(); $("#mockWrap").hidden = !url; if (url) $("#mockImg").src = url;
  }

  let sent = false;
  function status(kind, msg) { const el = $("#sendStatus"); el.hidden = false; el.innerHTML = `<span class="chip ${kind}">${kind === "ok" ? "Sent" : kind === "warn" ? "Not sent" : "Sending"}</span><span>${msg}</span>`; }
  async function sendEnquiry(btn) {
    if (sent) { status("ok", `Already sent. Your reference is ${esc(ref)}.`); return; }
    if (!validate()) { go(3); return; }
    renderReview();
    btn.disabled = true; btn.textContent = "Sending…"; status("info", "Uploading your configuration…");
    const c = calc(), b = budget(c);
    const fd = new FormData($("#leadForm"));
    fd.set("summary", JSON.stringify({ env: envLabel(), product: `${c.pr.name} ${pitchLabel(c.pr.p)}`, size: `${fmt(c.W, 2)} × ${fmt(c.H, 2)} m`, area: +c.area.toFixed(2), resolution: `${c.resW} × ${c.resH}`, cabinets: `${S.cols} × ${S.rows}`, mount: mountLabel(), addons: S.addons, budget: b ? `${money(b.low)} – ${money(b.high)}` : "" }));
    let stored = false, emailed = false, error = "";
    try {
      if (mkReady()) {
        fd.set("mockup", await toBlob(mkExportCanvas(1600), 0.82), `${ref}-mockup.jpg`);
        if (!MK.sample) fd.set("site-photo", await toBlob(shrink(MK.img, 2000), 0.85), `${ref}-site.jpg`);
      }
      const r = await fetch("/api/enquiries", { method: "POST", body: fd });
      if (r.ok) stored = true; else if (r.status !== 404) error = (await r.json().catch(() => ({}))).error || "";
    } catch (e) {}
    try {
      const r2 = await fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(new FormData($("#leadForm"))).toString() });
      emailed = r2.ok;
    } catch (e) {}
    if (stored || emailed) {
      sent = true; btn.textContent = "Enquiry sent";
      status("ok", `Thanks ${esc(F("fName").split(" ")[0])}. We've got your enquiry (reference ${esc(ref)}). ${esc(CFG.contact.replyPromise)} Want to talk sooner? Use the booking buttons to pick a time.`);
    } else {
      btn.disabled = false; btn.textContent = "Try sending again";
      status("warn", `${error ? esc(error) + " " : ""}We couldn't send your enquiry just now. Please try again, or copy the specification and email it to ${esc(CFG.contact.email)}.`);
    }
  }

  // ---------- Events ----------
  function refit() { const w = parseFloat($("#tw").value.replace(",", ".")), h = parseFloat($("#th").value.replace(",", ".")); if (w > 0 && h > 0) fitTo(w, h); }
  function fitTo(w, h) { const pr = product(); S.cols = Math.max(1, Math.round((w * 1000) / pr.cw)); S.rows = Math.max(1, Math.round((h * 1000) / pr.ch)); }
  function copy(text, msg, showBox) {
    const fallback = () => { if (showBox) { const box = $("#specText"); box.hidden = false; box.focus(); box.select(); toast("Select all and copy the text below"); } else toast("Select the text to copy it"); };
    try { navigator.clipboard.writeText(text).then(() => toast(msg), fallback); } catch (e) { fallback(); }
  }
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("button,a"); if (!t) return;
    const d = t.dataset;
    if (d.env) { const W = calc().W, H = calc().H; S.env = d.env; S.pitchIdx = recommendIdx(S.env, S.dist); fitTo(W, H); renderEnv(); renderPitches(); update(); }
    else if (d.pitch) { const c = calc(); S.pitchIdx = +d.pitch; fitTo(c.W, c.H); renderPitches(); update(); }
    else if (d.mount) { S.mount = d.mount; renderMounts(); update(); }
    else if (d.view) { S.view = d.view; update(); }
    else if (d.adj) { const [k, v] = d.adj.split(":"); S[k] = (S[k] | 0) + +v; update(); }
    else if (d.aspect) { const pr = product(); S.rows = Math.max(1, Math.round(((calc().W / +d.aspect) * 1000) / pr.ch)); update(); }
    else if (d.go) { e.preventDefault(); go(+d.go); }
    else if (d.copy) copy(d.copy, "Copied " + d.copy);
    else if (t.id === "fitBtn") { refit(); update(); }
    else if (t.id === "reset") { S = structuredClone(DEFAULT); renderAll(); $("#tw").value = "3.0"; $("#th").value = "2.0"; update(); toast("Configuration reset"); }
    else if (t.id === "copySpec") copy($("#specText").value, "Specification copied", true);
    else if (t.id === "sendBtn") sendEnquiry(t);
    else if (t.id === "mkSample" || t.id === "mkSample2") { const s = sampleShopfront(); mkSetImage(s.canvas, s.info); toast("Sample shopfront loaded. Drag the screen around."); }
    else if (t.id === "mkScaleDone") mkFinishScale();
    else if (t.id === "mkScaleEdit") { MK.mode = "scale"; mkSync(); }
    else if (t.id === "mkCenter") { if (MK.pos) { MK.pos = { x: mk.width / 2, y: mk.height / 2 }; mkDraw(); } }
    else if (t.id === "mkDownload") {
      if (!mkReady()) { toast("Add a photo and place your screen first."); return; }
      if (!ref) renderReview();
      const blob = await toBlob(mkExportCanvas(2400), 0.9), url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = `${CFG.brand.company.replace(/\W+/g, "-")}-LED-mockup-${ref}.jpg`; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000); toast("Mockup downloaded");
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.dataset.addon) { const id = e.target.dataset.addon; S.addons = e.target.checked ? [...new Set([...S.addons, id])] : S.addons.filter((x) => x !== id); update(); }
    if (e.target.id === "cols" || e.target.id === "rows") { S[e.target.id] = parseInt(e.target.value, 10) || 1; update(); }
  });
  $("#viewDist").addEventListener("input", (e) => { S.dist = +e.target.value; renderPitches(); update(); });
  ["tw", "th"].forEach((id) => $("#" + id).addEventListener("keydown", (e) => { if (e.key === "Enter") { refit(); update(); } }));
  $("#leadForm").addEventListener("submit", (e) => { e.preventDefault(); if (validate()) go(4); });

  if (!saved) { fitTo(3, 2); DEFAULT.cols = S.cols; DEFAULT.rows = S.rows; }
  renderAll(); renderFormOptions(); update();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => update());
  if (document.fonts) document.fonts.ready.then(() => update());
})();
