(function(){
// ---- Product data (typical values per series) ----
const ENVS = {
  indoor:  {label:"Indoor", sub:"Reception, retail, boardroom"},
  window:  {label:"Window-facing", sub:"Shopfront, high brightness"},
  outdoor: {label:"Outdoor", sub:"IP65, direct sunlight"}
};
// pitch mm, cabinet w×h mm, nits, kg per m², max W per m², series name, notes
const SERIES = {
  indoor: [
    {p:0.9375, cw:600, ch:337.5, nits:600,  kg:24, w:420, name:"AV Studio COB", tech:"COB, flip-chip", refresh:3840, service:"Front"},
    {p:1.25,   cw:600, ch:337.5, nits:600,  kg:25, w:450, name:"AV Studio",     tech:"SMD 1010", refresh:3840, service:"Front"},
    {p:1.5625, cw:600, ch:337.5, nits:700,  kg:25, w:480, name:"AV Studio",     tech:"SMD 1212", refresh:3840, service:"Front"},
    {p:1.953,  cw:500, ch:500,   nits:800,  kg:30, w:500, name:"AV Interior",   tech:"SMD 1515", refresh:3840, service:"Front & rear"},
    {p:2.604,  cw:500, ch:500,   nits:900,  kg:30, w:520, name:"AV Interior",   tech:"SMD 2020", refresh:3840, service:"Front & rear"},
    {p:3.91,   cw:500, ch:1000,  nits:1000, kg:28, w:560, name:"AV Interior",   tech:"SMD 2121", refresh:3840, service:"Front & rear"}
  ],
  window: [
    {p:1.953,  cw:500, ch:500,   nits:2500, kg:32, w:650, name:"AV Shopfront",  tech:"SMD 1515 high-bright", refresh:3840, service:"Front"},
    {p:2.5,    cw:500, ch:1000,  nits:3000, kg:30, w:700, name:"AV Shopfront",  tech:"SMD 1921", refresh:3840, service:"Front"},
    {p:3.91,   cw:500, ch:1000,  nits:4000, kg:30, w:760, name:"AV Shopfront",  tech:"SMD 1921", refresh:3840, service:"Front"}
  ],
  outdoor: [
    {p:2.976,  cw:500, ch:500,   nits:4500, kg:36, w:780, name:"AV Exterior",   tech:"SMD 1415, IP65", refresh:3840, service:"Front"},
    {p:3.91,   cw:500, ch:1000,  nits:5000, kg:34, w:800, name:"AV Exterior",   tech:"SMD 1921, IP65", refresh:3840, service:"Front & rear"},
    {p:4.81,   cw:500, ch:1000,  nits:5500, kg:34, w:820, name:"AV Exterior",   tech:"SMD 2727, IP65", refresh:3840, service:"Front & rear"},
    {p:6.67,   cw:960, ch:960,   nits:6500, kg:40, w:850, name:"AV Billboard",  tech:"SMD 3535, IP65", refresh:3840, service:"Front & rear"},
    {p:8,      cw:960, ch:960,   nits:6500, kg:40, w:850, name:"AV Billboard",  tech:"SMD 3535, IP65", refresh:3840, service:"Rear"},
    {p:10,     cw:960, ch:960,   nits:7000, kg:42, w:900, name:"AV Billboard",  tech:"DIP 346, IP65", refresh:1920, service:"Rear"}
  ]
};
const MOUNTS = {
  wall:  {label:"Wall-mounted",    sub:"Fixed frame on load-bearing wall"},
  floor: {label:"Floor-standing",  sub:"Ground-stacked with rear support"},
  hung:  {label:"Ceiling-hung",    sub:"Flown from rated points"},
  pole:  {label:"Pole / totem",    sub:"Freestanding steel structure"}
};
const ADDONS = [
  {id:"install", label:"Installation & commissioning", sub:"Survey, structure, power, calibration"},
  {id:"cms",     label:"Cloud CMS", sub:"Schedule and update content remotely"},
  {id:"live",    label:"Live video input", sub:"HDMI / SDI processor for live feeds"},
  {id:"content", label:"Content design", sub:"Launch content made for your screen"},
  {id:"warranty",label:"5-year warranty & maintenance", sub:"Spares kit and response SLA"}
];

const DEFAULT = {env:"indoor", pitchIdx:3, cols:6, rows:6, mount:"wall", view:"content", dist:4, addons:["install","cms"], box:{x:0.3,y:0.2,w:0.4,h:0.4}, lock:true, opacity:0.9};
let S = Object.assign(structuredClone(DEFAULT), load() || {});
if(S.view==="site") S.view = "content";
let photo = null, drag = null, exporting = false;
let step = 1;

function load(){ try{ const v = JSON.parse(localStorage.getItem("av-cfg")); if(v && SERIES[v.env]) return v; }catch(e){} return null; }
function save(){ try{ localStorage.setItem("av-cfg", JSON.stringify(S)); }catch(e){} }

const $ = s => document.querySelector(s);
const fmt = (n, d=0) => n.toLocaleString("en-GB",{minimumFractionDigits:d, maximumFractionDigits:d});
const gcd = (a,b) => b ? gcd(b, a % b) : a;

function product(){ const list = SERIES[S.env]; if(S.pitchIdx >= list.length) S.pitchIdx = list.length-1; return list[S.pitchIdx]; }

function calc(){
  const pr = product();
  const pxW = Math.round(pr.cw / pr.p), pxH = Math.round(pr.ch / pr.p);
  const wmm = pr.cw * S.cols, hmm = pr.ch * S.rows;
  const W = wmm/1000, H = hmm/1000, area = W*H;
  const resW = pxW*S.cols, resH = pxH*S.rows, px = resW*resH;
  const diag = Math.sqrt(W*W+H*H)/0.0254;
  const g = gcd(resW,resH); let ar = `${resW/g}:${resH/g}`;
  const ratio = resW/resH;
  const named = [[16/9,"16:9"],[21/9,"21:9"],[4/3,"4:3"],[1,"1:1"],[9/16,"9:16"],[32/9,"32:9"],[3,"3:1"],[2,"2:1"]];
  for(const [r,n] of named){ if(Math.abs(ratio-r)/r < 0.03){ ar = (Math.abs(ratio-r)/r<0.005? n : "≈ "+n); break; } }
  if(ar.length > 9) ar = ratio.toFixed(2)+":1";
  const weight = area*pr.kg, maxW = area*pr.w, avgW = maxW*0.35;
  const amps = maxW/230;
  let proc;
  if(px <= 2.3e6) proc = "HD sending processor (up to 2.3 MP)";
  else if(px <= 8.9e6) proc = "4K sending processor (up to 8.8 MP)";
  else proc = `Multi-processor array (${Math.ceil(px/8.8e6)} × 4K)`;
  const ports = Math.ceil(px/650000);
  let fmtName = "";
  if(resW>=3840 && resH>=2160) fmtName="Native 4K UHD or above";
  else if(resW>=1920 && resH>=1080) fmtName="Full HD or above";
  else if(resW>=1280 && resH>=720) fmtName="HD 720p class";
  else fmtName="Below HD";
  return {pr,pxW,pxH,W,H,area,resW,resH,px,diag,ar,weight,maxW,avgW,amps,proc,ports,fmtName,cabs:S.cols*S.rows,minView:pr.p,optView:pr.p*3};
}

// ---- Render controls ----
function renderEnv(){
  $("#envOpts").innerHTML = Object.entries(ENVS).map(([k,v]) =>
    `<button class="opt" data-env="${k}" aria-pressed="${S.env===k}"><b>${v.label}</b><span>${v.sub}</span></button>`).join("");
}
function renderPitches(){
  const list = SERIES[S.env];
  // recommended: largest pitch ≤ distance; plus anything finer down to 2 steps
  const okIdx = list.map((p,i)=>p.p <= S.dist ? i : -1).filter(i=>i>=0);
  const best = okIdx.length ? okIdx[okIdx.length-1] : 0;
  $("#pitchOpts").innerHTML = list.map((p,i) =>
    `<button class="pitch ${i===best?'rec':''}" data-pitch="${i}" aria-pressed="${S.pitchIdx===i}" title="${p.name} P${p.p}">P${+p.p.toFixed(2)}</button>`).join("");
  const pr = product();
  $("#seriesInfo").innerHTML = `<b>${pr.name} P${+pr.p.toFixed(2)}</b> · ${pr.tech} · ${fmt(pr.nits)} nits · cabinet ${fmt(pr.cw,pr.cw%1?1:0)} × ${fmt(pr.ch,pr.ch%1?1:0)} mm · ${pr.service} service`;
}
function renderMounts(){
  $("#mountOpts").innerHTML = Object.entries(MOUNTS).map(([k,v]) =>
    `<button class="opt" data-mount="${k}" aria-pressed="${S.mount===k}"><b>${v.label}</b><span>${v.sub}</span></button>`).join("");
}
function renderAddons(){
  $("#addOns").innerHTML = ADDONS.map(a =>
    `<label class="check"><input type="checkbox" id="ao-${a.id}" data-addon="${a.id}" ${S.addons.includes(a.id)?"checked":""}><span>${a.label}<small>${a.sub}</small></span></label>`).join("");
}

function update(){
  S.cols = Math.max(1, Math.min(60, S.cols|0)); S.rows = Math.max(1, Math.min(40, S.rows|0));
  const c = calc();
  $("#cols").value = S.cols; $("#rows").value = S.rows;
  $("#wOut").textContent = fmt(c.W,2)+" m"; $("#hOut").textContent = fmt(c.H,2)+" m";
  $("#viewDist").value = S.dist; $("#viewDistOut").textContent = fmt(S.dist, S.dist%1?1:0)+" m";
  $("#stageTitle").textContent = `${fmt(c.W,2)} × ${fmt(c.H,2)} m  ·  ${c.cabs} cabinets  ·  ${MOUNTS[S.mount].label}`;
  document.querySelectorAll("[data-view]").forEach(b=>b.setAttribute("aria-pressed", b.dataset.view===S.view));
  const tiles = [
    ["Resolution", `${fmt(c.resW)} × ${fmt(c.resH)}`, `${fmt(c.px/1e6,2)} megapixels`],
    ["Screen size", `${fmt(c.W,2)} × ${fmt(c.H,2)} m`, `${fmt(c.area,2)} m² · ${fmt(c.diag)}″ diagonal`],
    ["Aspect ratio", c.ar, c.fmtName],
    ["Brightness", `${fmt(c.pr.nits)} nits`, `${c.pr.refresh} Hz refresh`],
    ["Weight", `${fmt(c.weight)} kg`, `${c.pr.kg} kg/m² excl. structure`],
    ["Power max", `${fmt(c.maxW/1000,1)} kW`, `${fmt(c.amps,1)} A at 230 V`],
    ["Power typical", `${fmt(c.avgW/1000,1)} kW`, `≈ ${fmt(c.avgW*12*365/1000)} kWh/yr at 12 h/day`],
    ["Viewing distance", `${fmt(c.minView,1)}–${fmt(c.optView,1)} m`, "minimum – optimal"]
  ];
  $("#readout").innerHTML = tiles.map(t=>`<div><dt>${t[0]}</dt><dd>${t[1]}<small>${t[2]}</small></dd></div>`).join("");
  renderNotes(c);
  $("#sitebar").hidden = S.view!=="site";
  cv.style.touchAction = S.view==="site" ? "none" : "auto";
  $("#lockRatio").checked = S.lock; $("#opac").value = S.opacity;
  if(S.view==="site"){ applyLock(c); clampBox(); }
  draw(c);
  save();
}

function renderNotes(c){
  const n = [];
  if(c.pr.p > S.dist) n.push(["warn","Pitch", `P${+c.pr.p.toFixed(2)} is coarse for viewers at ${S.dist} m. Pixels will be visible; consider P${+(SERIES[S.env].filter(p=>p.p<=S.dist).pop()||SERIES[S.env][0]).p.toFixed(2)} or finer.`]);
  else if(c.pr.p < S.dist/3) n.push(["info","Pitch", `P${+c.pr.p.toFixed(2)} is finer than you need at ${S.dist} m. A coarser pitch would look the same from there and cost less.`]);
  else n.push(["ok","Pitch", `P${+c.pr.p.toFixed(2)} is a good match for a closest viewer at ${S.dist} m.`]);
  if(c.resW >= 1920 && c.resH >= 1080) n.push(["ok","Content", `Takes full HD content natively${c.resW>=3840&&c.resH>=2160?", and 4K":""}. Our CMS outputs at ${fmt(c.resW)} × ${fmt(c.resH)} pixel-for-pixel.`]);
  else n.push(["info","Content", `Content will be built at ${fmt(c.resW)} × ${fmt(c.resH)} px. Video is scaled to fit, so we design launch content at exact resolution.`]);
  n.push(["info","Processing", `${c.proc}, ${c.ports} LAN output${c.ports>1?"s":""}, ${c.cabs} receiving cards.`]);
  const circuits = Math.ceil(c.amps/13);
  n.push([c.amps>32?"warn":"info","Power", c.amps>32 ? `${fmt(c.amps,1)} A at full white. Needs a dedicated distribution board or 3-phase supply. We cover this in the survey.` : `${fmt(c.amps,1)} A at full white: about ${circuits} × 13 A circuit${circuits>1?"s":""} or one dedicated 32 A supply.`]);
  if(S.env!=="indoor" && S.mount==="hung") n.push(["warn","Mounting","Flown outdoor or window screens need wind-load and rigging calculations. We'll include these in the survey."]);
  if(S.mount==="wall" && c.weight>500) n.push(["warn","Structure", `${fmt(c.weight)} kg on a wall needs a structural check or floor-loaded frame.`]);
  $("#notes").innerHTML = n.map(x=>`<div class="note"><span class="chip ${x[0]}">${x[1]}</span><span>${x[2]}</span></div>`).join("");
}

// ---- Scene drawing ----
const cv = $("#scene"), ctx = cv.getContext("2d");
function css(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
function draw(c){
  const Wc = cv.width, Hc = cv.height;
  const col = {stage:css("--stage"), floor:css("--stage-floor"), ink:css("--ink"), muted:css("--muted"), accent:css("--accent"), line:css("--line")};
  ctx.clearRect(0,0,Wc,Hc);
  ctx.fillStyle = col.stage; ctx.fillRect(0,0,Wc,Hc);
  if(S.view==="site"){ drawSite(c, col); return; }
  // scene extents in metres
  const person = 1.75;
  const elev = S.mount==="floor" ? 0.0 : S.mount==="pole" ? 2.2 : S.mount==="hung" ? Math.max(2.5, 0) : Math.max(0.6, Math.min(1.0, 3 - c.H));
  const sceneW = Math.max(c.W + 2.2, 4.5), sceneH = Math.max(elev + c.H + 0.8, 3.2);
  const pad = 70, floorY = Hc - 110;
  const scale = Math.min((Wc - pad*2)/sceneW, (floorY - 50)/sceneH);
  const x0 = Wc/2 - (c.W*scale)/2 + (1.0*scale)/2;
  const yTop = floorY - (elev + c.H)*scale;
  const sw = c.W*scale, sh = c.H*scale;
  // floor
  ctx.fillStyle = col.floor; ctx.fillRect(0,floorY,Wc,Hc-floorY);
  ctx.strokeStyle = col.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0,floorY); ctx.lineTo(Wc,floorY); ctx.stroke();
  // structure
  ctx.fillStyle = col.muted;
  if(S.mount==="pole"){ const pw = Math.max(10, 0.2*scale); ctx.fillRect(x0+sw/2-pw/2, yTop+sh, pw, floorY-(yTop+sh)); ctx.fillRect(x0+sw/2-pw*2, floorY-6, pw*4, 6); }
  if(S.mount==="hung"){ ctx.strokeStyle = col.muted; ctx.lineWidth=2; ctx.setLineDash([6,6]); [x0+sw*0.2,x0+sw*0.8].forEach(x=>{ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,yTop);ctx.stroke();}); ctx.setLineDash([]); }
  if(S.mount==="floor"){ ctx.fillRect(x0-6, floorY-4, sw+12, 4); }
  // screen body
  ctx.fillStyle = "#05070b"; ctx.fillRect(x0-4, yTop-4, sw+8, sh+8);
  if(S.view==="content"){ drawContent(x0,yTop,sw,sh,c); }
  else { ctx.fillStyle = "#11161f"; ctx.fillRect(x0,yTop,sw,sh); }
  // cabinet grid
  const cwPx = sw/S.cols, chPx = sh/S.rows;
  ctx.strokeStyle = S.view==="content" ? "rgba(0,0,0,.35)" : "rgba(255,255,255,.28)";
  ctx.lineWidth = S.view==="content" ? 1 : 1.5;
  for(let i=1;i<S.cols;i++){ ctx.beginPath(); ctx.moveTo(x0+i*cwPx,yTop); ctx.lineTo(x0+i*cwPx,yTop+sh); ctx.stroke(); }
  for(let j=1;j<S.rows;j++){ ctx.beginPath(); ctx.moveTo(x0,yTop+j*chPx); ctx.lineTo(x0+sw,yTop+j*chPx); ctx.stroke(); }
  if(S.view==="cabinets" && cwPx>26 && chPx>16){
    ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.font = `${Math.min(15, cwPx/4)}px IBM Plex Mono, monospace`; ctx.textAlign="center"; ctx.textBaseline="middle";
    for(let j=0;j<S.rows;j++) for(let i=0;i<S.cols;i++) ctx.fillText(String.fromCharCode(65+ (j%26))+(i+1), x0+i*cwPx+cwPx/2, yTop+j*chPx+chPx/2);
  }
  // dimension lines
  ctx.strokeStyle = col.ink; ctx.fillStyle = col.ink; ctx.lineWidth = 1.5;
  ctx.font = "600 22px IBM Plex Mono, monospace"; ctx.textAlign="center"; ctx.textBaseline="bottom";
  const dy = yTop - 22;
  line(x0,dy,x0+sw,dy); tick(x0,dy,"v"); tick(x0+sw,dy,"v");
  label(`${fmt(c.W,2)} m`, x0+sw/2, dy-6);
  const dx = x0 + sw + 26;
  line(dx,yTop,dx,yTop+sh); tick(dx,yTop,"h"); tick(dx,yTop+sh,"h");
  ctx.save(); ctx.translate(dx+12, yTop+sh/2); ctx.rotate(-Math.PI/2); ctx.textBaseline="top"; label(`${fmt(c.H,2)} m`,0,0); ctx.restore();
  // person
  const ph = person*scale, px = x0 - 0.75*scale;
  drawPerson(px, floorY, ph, col.ink);
  ctx.fillStyle = col.muted; ctx.font = "18px IBM Plex Mono, monospace"; ctx.textAlign="center"; ctx.textBaseline="top";
  ctx.fillText("1.75 m", px, floorY+10);
  // bottom label
  ctx.textAlign="left"; ctx.fillStyle = col.muted; ctx.font = "18px IBM Plex Mono, monospace";
  ctx.fillText(`${fmt(c.resW)} × ${fmt(c.resH)} px · ${c.pr.name} P${+c.pr.p.toFixed(2)} · ${S.cols} × ${S.rows} cabinets`, 24, Hc-40);
  function line(a,b,c2,d){ ctx.beginPath(); ctx.moveTo(a,b); ctx.lineTo(c2,d); ctx.stroke(); }
  function tick(x,y,o){ ctx.beginPath(); if(o==="v"){ctx.moveTo(x,y-8);ctx.lineTo(x,y+8);} else {ctx.moveTo(x-8,y);ctx.lineTo(x+8,y);} ctx.stroke(); }
  function label(t,x,y){ const w = ctx.measureText(t).width+14; ctx.save(); ctx.fillStyle = col.stage; ctx.fillRect(x-w/2, y-(ctx.textBaseline==="top"?-2:26), w, 26); ctx.restore(); ctx.fillText(t,x,y); }
}
function drawContent(x,y,w,h,c){
  const g = ctx.createLinearGradient(x,y,x+w,y+h);
  g.addColorStop(0,"#0b1d4a"); g.addColorStop(.55,"#1d5bd8"); g.addColorStop(1,"#e2541c");
  ctx.fillStyle = g; ctx.fillRect(x,y,w,h);
  ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  ctx.globalAlpha = .18; ctx.fillStyle = "#fff";
  for(let i=0;i<7;i++){ ctx.beginPath(); ctx.arc(x+w*(0.15+i*0.13), y+h*(0.3+0.4*Math.sin(i*1.7)), Math.min(w,h)*(0.08+0.05*(i%3)), 0, Math.PI*2); ctx.fill(); }
  ctx.globalAlpha = 1;
  const fs = Math.max(12, Math.min(w/9, h/3.5));
  ctx.fillStyle = "#fff"; ctx.textAlign="left"; ctx.textBaseline="alphabetic";
  ctx.font = `800 ${fs}px Archivo, sans-serif`;
  ctx.fillText("ADD VISION", x+w*0.07, y+h*0.55);
  ctx.font = `500 ${fs*0.32}px IBM Plex Sans, sans-serif`; ctx.globalAlpha=.85;
  ctx.fillText(`${fmt(c.resW)} × ${fmt(c.resH)} · ${fmt(c.pr.nits)} nits`, x+w*0.07, y+h*0.55+fs*0.55);
  // pixel texture hint for coarse pitch
  const pxSize = w / c.resW;
  if(pxSize > 2.5){ ctx.globalAlpha = .35; ctx.fillStyle="#000"; for(let i=0;i<=c.resW;i++){ ctx.fillRect(x+i*pxSize-pxSize*0.18, y, pxSize*0.36, h);} for(let j=0;j<=c.resH;j++){ ctx.fillRect(x, y+j*pxSize-pxSize*0.18, w, pxSize*0.36);} }
  ctx.restore(); ctx.globalAlpha = 1;
}
// ---- Your site: photo + movable screen box ----
function boxPx(){ return {x:S.box.x*cv.width, y:S.box.y*cv.height, w:S.box.w*cv.width, h:S.box.h*cv.height}; }
function ratioN(c){ return (c.W/c.H) * cv.height / cv.width; } // box w/h in normalised units
function clampBox(){
  const b = S.box; b.w = Math.min(1, Math.max(0.03, b.w)); b.h = Math.min(1, Math.max(0.03, b.h));
  b.x = Math.min(1-b.w, Math.max(0, b.x)); b.y = Math.min(1-b.h, Math.max(0, b.y));
}
function applyLock(c){
  if(!S.lock) return;
  const r = ratioN(c), cx = S.box.x + S.box.w/2, cy = S.box.y + S.box.h/2;
  let w = S.box.w, h = w / r;
  if(h > 0.95){ h = 0.95; w = h * r; }
  if(w > 1){ w = 1; h = w / r; }
  S.box.w = w; S.box.h = h; S.box.x = cx - w/2; S.box.y = cy - h/2;
}
function canvasScale(){ const r = cv.getBoundingClientRect(); return r.width ? cv.width / r.width : 1; }
function drawSite(c, col){
  const Wc = cv.width, Hc = cv.height, k = Math.max(1, canvasScale());
  if(photo){
    const s = Math.min(Wc/photo.width, Hc/photo.height), w = photo.width*s, h = photo.height*s;
    ctx.fillStyle = "#000"; ctx.fillRect(0,0,Wc,Hc);
    ctx.drawImage(photo, (Wc-w)/2, (Hc-h)/2, w, h);
  } else {
    ctx.strokeStyle = col.muted; ctx.lineWidth = 2*k; ctx.setLineDash([12*k, 10*k]);
    ctx.strokeRect(30, 30, Wc-60, Hc-60); ctx.setLineDash([]);
    ctx.fillStyle = col.ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `600 ${16*k}px IBM Plex Sans, sans-serif`;
    ctx.fillText("Upload a photo of your storefront or wall", Wc/2, Hc*0.12);
    ctx.fillStyle = col.muted; ctx.font = `${12*k}px IBM Plex Sans, sans-serif`;
    ctx.fillText("Drop an image here, or use Upload photo below", Wc/2, Hc*0.12 + 24*k);
  }
  const b = boxPx(), cwPx = b.w/S.cols, chPx = b.h/S.rows;
  ctx.save(); ctx.globalAlpha = S.opacity; drawContent(b.x, b.y, b.w, b.h, c); ctx.restore(); ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1;
  for(let i=1;i<S.cols;i++){ ctx.beginPath(); ctx.moveTo(b.x+i*cwPx,b.y); ctx.lineTo(b.x+i*cwPx,b.y+b.h); ctx.stroke(); }
  for(let j=1;j<S.rows;j++){ ctx.beginPath(); ctx.moveTo(b.x,b.y+j*chPx); ctx.lineTo(b.x+b.w,b.y+j*chPx); ctx.stroke(); }
  ctx.strokeStyle = col.accent; ctx.lineWidth = 2*k; ctx.strokeRect(b.x, b.y, b.w, b.h);
  if(!exporting){
    const hs = 7*k; ctx.fillStyle = "#fff";
    [[b.x,b.y],[b.x+b.w,b.y],[b.x,b.y+b.h],[b.x+b.w,b.y+b.h]].forEach(([x,y])=>{ ctx.fillRect(x-hs,y-hs,hs*2,hs*2); ctx.strokeRect(x-hs,y-hs,hs*2,hs*2); });
  }
  const t = `${fmt(c.W,2)} × ${fmt(c.H,2)} m · ${S.cols} × ${S.rows} cabinets`;
  ctx.font = `600 ${12*k}px IBM Plex Mono, monospace`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  const tw = ctx.measureText(t).width + 16*k, th = 22*k;
  let lx = Math.min(Math.max(0, b.x), Wc - tw), ly = b.y - th - 6*k; if(ly < 0) ly = b.y + b.h + 6*k; if(ly + th > Hc) ly = b.y + 6*k;
  ctx.fillStyle = col.accent; ctx.fillRect(lx, ly, tw, th);
  ctx.fillStyle = css("--accent-ink"); ctx.fillText(t, lx + 8*k, ly + th/2);
}
function cvPoint(e){ const r = cv.getBoundingClientRect(); return {x:(e.clientX-r.left)*cv.width/r.width, y:(e.clientY-r.top)*cv.height/r.height, k:cv.width/r.width}; }
function hitBox(p){
  const b = boxPx(), R = 14*Math.max(1,p.k);
  const corners = [["nw",b.x,b.y],["ne",b.x+b.w,b.y],["sw",b.x,b.y+b.h],["se",b.x+b.w,b.y+b.h]];
  for(const [n,x,y] of corners) if(Math.abs(p.x-x)<R && Math.abs(p.y-y)<R) return n;
  if(p.x>b.x && p.x<b.x+b.w && p.y>b.y && p.y<b.y+b.h) return "move";
  return null;
}
const CURSORS = {nw:"nwse-resize", se:"nwse-resize", ne:"nesw-resize", sw:"nesw-resize", move:"move"};
cv.addEventListener("pointerdown", e=>{
  if(S.view!=="site") return;
  const p = cvPoint(e), h = hitBox(p); if(!h) return;
  drag = {h, p, b:{...S.box}}; cv.setPointerCapture(e.pointerId); e.preventDefault();
});
cv.addEventListener("pointermove", e=>{
  if(S.view!=="site"){ cv.style.cursor = ""; return; }
  const p = cvPoint(e);
  if(!drag){ cv.style.cursor = CURSORS[hitBox(p)] || "default"; return; }
  const dx = (p.x-drag.p.x)/cv.width, dy = (p.y-drag.p.y)/cv.height, b = drag.b, c = calc();
  if(drag.h==="move"){ S.box.x = b.x+dx; S.box.y = b.y+dy; }
  else {
    let l=b.x, t=b.y, r=b.x+b.w, bt=b.y+b.h;
    if(drag.h.includes("w")) l = Math.min(r-0.03, l+dx); else r = Math.max(l+0.03, r+dx);
    if(drag.h.includes("n")) t = Math.min(bt-0.03, t+dy); else bt = Math.max(t+0.03, bt+dy);
    if(S.lock){ const hh = (r-l)/ratioN(c); if(drag.h.includes("n")) t = bt-hh; else bt = t+hh; }
    S.box = {x:l, y:t, w:r-l, h:bt-t};
  }
  clampBox(); draw(c);
});
const endDrag = ()=>{ if(drag){ drag = null; save(); } };
cv.addEventListener("pointerup", endDrag); cv.addEventListener("pointercancel", endDrag);

function loadPhoto(file){
  if(!file) return;
  if(!/^image\//.test(file.type)){ toast("Choose an image file such as a JPG or PNG."); return; }
  const r = new FileReader();
  r.onload = ()=>{ const im = new Image();
    im.onload = ()=>{ photo = im; S.view = "site"; $("#photoClear").hidden = false; update(); toast("Photo added. Drag the box over where the screen will go."); };
    im.onerror = ()=>toast("That image couldn't be opened. Try a JPG or PNG.");
    im.src = r.result; };
  r.readAsDataURL(file);
}
$("#photoIn").addEventListener("change", e=>{ loadPhoto(e.target.files[0]); e.target.value = ""; });
$("#photoBtn").addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("#photoIn").click(); } });
const stageEl = document.querySelector(".stage");
stageEl.addEventListener("dragover", e=>{ e.preventDefault(); stageEl.classList.add("drop"); });
stageEl.addEventListener("dragleave", ()=>stageEl.classList.remove("drop"));
stageEl.addEventListener("drop", e=>{ e.preventDefault(); stageEl.classList.remove("drop"); loadPhoto(e.dataTransfer.files[0]); });
$("#lockRatio").addEventListener("change", e=>{ S.lock = e.target.checked; update(); });
$("#opac").addEventListener("input", e=>{ S.opacity = +e.target.value; draw(calc()); save(); });
$("#boxW").addEventListener("keydown", e=>{ if(e.key==="Enter") $("#boxFit").click(); });
addEventListener("resize", ()=>{ if(S.view==="site") draw(calc()); });

function drawPerson(cx, floor, h, color){
  ctx.fillStyle = color; const u = h/7.5;
  ctx.beginPath(); ctx.arc(cx, floor - h + u*0.5, u*0.5, 0, Math.PI*2); ctx.fill();
  roundRect(cx - u*0.85, floor - h + u*1.15, u*1.7, u*3.0, u*0.4);
  roundRect(cx - u*0.7, floor - u*3.4, u*0.6, u*3.4, u*0.25);
  roundRect(cx + u*0.1, floor - u*3.4, u*0.6, u*3.4, u*0.25);
  function roundRect(x,y,w,hh,r){ ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x,y,w,hh,r) : ctx.rect(x,y,w,hh); ctx.fill(); }
}

// ---- Steps ----
function go(n){
  if(n===3 && !validate()){ n = 2; }
  step = n;
  [1,2,3].forEach(i => $("#step"+i).hidden = i!==n);
  document.querySelectorAll("#steps button").forEach(b=>{
    const i = +b.dataset.go; b.toggleAttribute("aria-current", false);
    if(i===n) b.setAttribute("aria-current","step");
    b.classList.toggle("done", i<n);
  });
  if(n===2) renderMini();
  if(n===3) renderReview();
  window.scrollTo({top:0, behavior:"smooth"});
}
function renderMini(){
  const c = calc();
  const rows = [["Environment",ENVS[S.env].label],["Product",`${c.pr.name} P${+c.pr.p.toFixed(2)}`],["Size",`${fmt(c.W,2)} × ${fmt(c.H,2)} m`],["Resolution",`${fmt(c.resW)} × ${fmt(c.resH)}`],["Cabinets",`${S.cols} × ${S.rows} (${c.cabs})`],["Mounting",MOUNTS[S.mount].label],["Weight",`${fmt(c.weight)} kg`],["Power max",`${fmt(c.maxW/1000,1)} kW`]];
  $("#miniSum").innerHTML = rows.map(r=>`<div><span>${r[0]}</span><span>${r[1]}</span></div>`).join("");
}
const F = id => $("#"+id).value.trim();
function validate(){
  let ok = true;
  const checks = [["fName", v=>v.length>1, "Enter your name."],["fEmail", v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter an email address like name@company.co.uk."],["fPhone", v=>v.replace(/\D/g,"").length>=10, "Enter a phone number with at least 10 digits."]];
  for(const [id,fn,msg] of checks){
    const el = $("#"+id), err = el.parentElement.querySelector(".err");
    const good = fn(el.value.trim()); err.hidden = good; err.textContent = good ? "" : msg; el.setAttribute("aria-invalid", !good);
    if(!good && ok){ ok = false; if(step===2) el.focus(); }
  }
  return ok;
}
let ref = "";
function renderReview(){
  const c = calc();
  if(!ref){ const d = new Date(); ref = `AV-${String(d.getFullYear()).slice(2)}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${Math.random().toString(36).slice(2,6).toUpperCase()}`; }
  $("#refNo").textContent = "Reference " + ref;
  const addons = ADDONS.filter(a=>S.addons.includes(a.id)).map(a=>a.label);
  const groups = [
    ["Screen", [["Environment",ENVS[S.env].label],["Product series",`${c.pr.name} P${+c.pr.p.toFixed(3)}`],["LED technology",c.pr.tech],["Cabinet size",`${c.pr.cw} × ${c.pr.ch} mm (${c.pxW} × ${c.pxH} px)`],["Cabinet layout",`${S.cols} wide × ${S.rows} high = ${c.cabs} cabinets`],["Screen size",`${fmt(c.W,3)} × ${fmt(c.H,3)} m (${fmt(c.area,2)} m², ${fmt(c.diag)}″)`],["Resolution",`${fmt(c.resW)} × ${fmt(c.resH)} px (${fmt(c.px/1e6,2)} MP)`],["Aspect ratio",c.ar],["Brightness",`${fmt(c.pr.nits)} nits`],["Refresh rate",`${c.pr.refresh} Hz`],["Service access",c.pr.service]]],
    ["Installation", [["Mounting",MOUNTS[S.mount].label],["Closest viewer",`${S.dist} m`],["Weight (screen only)",`${fmt(c.weight)} kg`],["Power max / typical",`${fmt(c.maxW/1000,2)} kW / ${fmt(c.avgW/1000,2)} kW`],["Current at 230 V",`${fmt(c.amps,1)} A`],["Processing",`${c.proc}, ${c.ports} LAN output${c.ports>1?"s":""}`]]],
    ["Services", [["Included",addons.length?addons.join(", "):"None selected"]]],
    ["Contact", [["Name",F("fName")],["Company",F("fCompany")||"—"],["Email",F("fEmail")],["Phone",F("fPhone")],["Postcode",F("fPost")||"—"],["Sector",F("fSector")],["Timeline",F("fWhen")],["Budget",F("fBudget")],["Notes",F("fNotes")||"—"]]]
  ];
  const esc = s => String(s).replace(/[&<>"]/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
  groups[1][1].push(["Site photo", photo ? "Supplied" : "Not supplied"]);
  if(photo){
    const prev = S.view; S.view = "site"; exporting = true; applyLock(c); clampBox(); draw(c);
    $("#mockImg").src = cv.toDataURL("image/jpeg", 0.85);
    exporting = false; S.view = prev; draw(c);
  }
  $("#mockWrap").hidden = !photo;
  $("#specTable").innerHTML = groups.map(g=>`<tr class="h"><th colspan="2">${g[0]}</th></tr>`+g[1].map(r=>`<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join("")).join("");
  const text = `Add Vision LED configuration — ${ref}\n` + groups.map(g=>`\n${g[0].toUpperCase()}\n`+g[1].map(r=>`${r[0]}: ${r[1]}`).join("\n")).join("\n");
  $("#specText").value = text;
  $("#hRef").value = ref; $("#hSpec").value = text;
}

// ---- Events ----
document.addEventListener("click", e=>{
  const t = e.target.closest("button,a"); if(!t) return;
  const d = t.dataset;
  if(d.env){ S.env = d.env; const list = SERIES[S.env]; const okIdx = list.map((p,i)=>p.p<=S.dist?i:-1).filter(i=>i>=0); S.pitchIdx = okIdx.length? okIdx[okIdx.length-1] : 0; refit(); renderEnv(); renderPitches(); update(); }
  else if(d.pitch){ const tw = calc().W, th = calc().H; S.pitchIdx = +d.pitch; fitTo(tw,th); renderPitches(); update(); }
  else if(d.mount){ S.mount = d.mount; renderMounts(); update(); }
  else if(d.view){ S.view = d.view; update(); }
  else if(d.adj){ const [k,v] = d.adj.split(":"); S[k] = (S[k]|0) + (+v); update(); }
  else if(d.aspect){ const pr = product(); const r = +d.aspect; const W = calc().W; S.rows = Math.max(1, Math.round((W/r)*1000/pr.ch)); update(); }
  else if(d.go){ e.preventDefault(); go(+d.go); }
  else if(d.copy){ copy(d.copy, "Copied "+d.copy); }
  else if(t.id==="fitBtn"){ refit(); update(); }
  else if(t.id==="photoClear"){ photo = null; t.hidden = true; update(); toast("Photo removed"); }
  else if(t.id==="boxFit"){
    const w = parseFloat($("#boxW").value.replace(",", "."));
    if(!(w>0)){ toast("Enter the measured width in metres, for example 3.2"); $("#boxW").focus(); return; }
    const b = boxPx(); fitTo(w, w * b.h / b.w); S.lock = true; update();
    const c = calc(); toast(`Screen sized to ${fmt(c.W,2)} × ${fmt(c.H,2)} m`);
  }
  else if(t.id==="reset"){ S = structuredClone(DEFAULT); renderAll(); $("#tw").value="3.6"; $("#th").value="2.0"; refit(); update(); toast("Configuration reset"); }
  else if(t.id==="sendBtn"){ sendEnquiry(t); }
  else if(t.id==="copySpec"){ copy($("#specText").value, "Specification copied", true); }
});
document.addEventListener("change", e=>{
  if(e.target.dataset.addon){ const id = e.target.dataset.addon; S.addons = e.target.checked ? [...new Set([...S.addons,id])] : S.addons.filter(x=>x!==id); update(); }
  if(e.target.id==="cols"||e.target.id==="rows"){ S[e.target.id] = parseInt(e.target.value,10)||1; update(); }
});
$("#viewDist").addEventListener("input", e=>{ S.dist = +e.target.value; renderPitches(); update(); });
["tw","th"].forEach(id=>$("#"+id).addEventListener("keydown", e=>{ if(e.key==="Enter"){ refit(); update(); }}));
$("#leadForm").addEventListener("submit", e=>{ e.preventDefault(); if(validate()) go(3); });

function refit(){ const w = parseFloat($("#tw").value.replace(",", ".")), h = parseFloat($("#th").value.replace(",", ".")); if(w>0 && h>0) fitTo(w,h); }
function fitTo(w,h){ const pr = product(); S.cols = Math.max(1, Math.round(w*1000/pr.cw)); S.rows = Math.max(1, Math.round(h*1000/pr.ch)); }

function copy(text, msg, showBox){
  const done = ()=>toast(msg);
  const fallback = ()=>{ const box = $("#specText"); if(showBox){ box.hidden = false; box.focus(); box.select(); toast("Select all and copy the text below"); } else toast("Select the text to copy it"); };
  try{ navigator.clipboard.writeText(text).then(done, fallback); }catch(err){ fallback(); }
}
let tt; function toast(m){ const el = $("#toast"); el.textContent = m; el.hidden = false; clearTimeout(tt); tt = setTimeout(()=>el.hidden = true, 2200); }

// ---- Send enquiry (Netlify Forms) ----
function jpegBlob(source, maxSide, q){
  return new Promise(res=>{
    const w = source.width, h = source.height, s = Math.min(1, maxSide/Math.max(w,h));
    const c = document.createElement("canvas"); c.width = Math.round(w*s); c.height = Math.round(h*s);
    c.getContext("2d").drawImage(source, 0, 0, c.width, c.height);
    c.toBlob(b=>res(b), "image/jpeg", q);
  });
}
function status(kind, msg){ const el = $("#sendStatus"); el.hidden = false; el.innerHTML = `<span class="chip ${kind}">${kind==="ok"?"Sent":kind==="warn"?"Not sent":"Sending"}</span><span>${msg}</span>`; }
let sent = false;
async function sendEnquiry(btn){
  if(sent){ status("ok", `Already sent. Your reference is ${ref}.`); return; }
  if(!validate()){ go(2); return; }
  renderReview();
  btn.disabled = true; btn.textContent = "Sending…"; status("info", "Uploading your configuration…");
  try{
    const fd = new FormData($("#leadForm"));
    fd.delete("site-photo"); fd.delete("mockup");
    if(photo){
      const prev = S.view, c = calc(); S.view = "site"; exporting = true; applyLock(c); clampBox(); draw(c);
      const mock = await jpegBlob(cv, 1600, 0.82);
      exporting = false; S.view = prev; draw(c);
      fd.append("site-photo", await jpegBlob(photo, 2000, 0.85), `${ref}-site.jpg`);
      fd.append("mockup", mock, `${ref}-mockup.jpg`);
    }
    const r = await fetch("/", {method:"POST", body:fd});
    if(!r.ok) throw new Error("HTTP "+r.status);
    sent = true; btn.textContent = "Enquiry sent";
    status("ok", `Thanks ${F("fName").split(" ")[0]}. We've got your enquiry (reference ${ref}) and will reply within one working day.`);
  }catch(err){
    btn.disabled = false; btn.textContent = "Try sending again";
    status("warn", "We couldn't send your enquiry just now. Please try again, or copy the specification and email it to info@addvision.co.");
  }
}

function renderAll(){ renderEnv(); renderPitches(); renderMounts(); renderAddons(); }
renderAll(); update();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", ()=>update());
new MutationObserver(()=>update()).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
if(document.fonts) document.fonts.ready.then(()=>update());
})();
