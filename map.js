/* OKTO bölüm haritası (grup düzeni): kullanıcının "Güneşli Sular" görseli model alınarak kodla çizilir.
   Dikey harita: üstte grup adı + derinlik aralığı; aşağı doğru zikzak 4 ortam adası (s45) (ortam süsü + mini canavar + ad etiketi),
   en altta büyük canavarın adası (adı + derinliği); adalar noktalı yolla bağlı; en altta sonraki grubun adı ve ok.
   İlerleme: bitirilen adalar tikli, şu anki ada parlar ve Okto üstünde durur, açılmamış adalar soluk ve kilitli.
   OktoMap.draw(ctx, G) — G = { W, H, S, FONT, time, top, group (0..), unlocked (en büyük açık bölüm no), current (bölüm no),
     swim: { from, to, t } (Okto bir adadan ötekine yüzer), look: { palette, accessory } }
   OktoMap.hit(x, y) → bölüm numarası ya da null (son çizime göre). OktoMap.layout: son çizimin yazı kutuları (test için). */
(() => {
'use strict';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
// grup renkleri: Güneşli Sular açık mavi, Alacakaranlık lacivert-mor, Karanlık Derinlikler koyu, Buzul Denizi buz mavisi
const THEMES = [
  { top: '#56cdf0', mid: '#1a83c0', bot: '#0b4a86', rock: 'rgba(10,60,110,.55)', title: '#ffffff', pill: '#0e5c8a', sun: true },
  { top: '#3a5aa8', mid: '#26307a', bot: '#140c40', rock: 'rgba(30,20,80,.6)', title: '#e8e0ff', pill: '#3a2a7a', sun: false },
  { top: '#16294a', mid: '#0b1530', bot: '#03060f', rock: 'rgba(20,30,60,.7)', title: '#bfe8ff', pill: '#1a2a4a', sun: false },
  { top: '#bfefff', mid: '#5fb0dc', bot: '#173f70', rock: 'rgba(225,245,255,.45)', title: '#ffffff', pill: '#1d5788', sun: true, ice: true }, // s46 Buzul Denizi
];
let last = null; // son çizimin adaları (dokunma için)
const layout = { texts: [], islands: [] };

function pill(c, x, y, text, size, fill, stroke, textCol, FONT, maxW) {
  c.font = `700 ${size}px ${FONT}`;
  let w = c.measureText(text).width; if (w < text.length * size * 0.3) w = text.length * size * 0.56; // ölçüm güvencesi
  let s = size; if (maxW && w + size * 1.4 > maxW) { s = size * (maxW - size * 1.4) / w; c.font = `700 ${s}px ${FONT}`; w = c.measureText(text).width; } // sığmazsa küçült
  const pw = w + s * 1.4, ph = s * 1.7;
  c.fillStyle = fill; c.beginPath(); c.roundRect(x - pw / 2, y - ph / 2, pw, ph, ph / 2); c.fill();
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2.5; c.stroke(); }
  c.fillStyle = textCol; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(text, x - w / 2, y + s * 0.05);
  layout.texts.push({ text, x0: x - pw / 2, x1: x + pw / 2, y0: y - ph / 2, y1: y + ph / 2 });
  return { w: pw, h: ph };
}
function coral(c, x, y, s, col) {
  c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = 3.5 * s;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 18 * s); c.moveTo(x, y - 9 * s); c.lineTo(x - 7 * s, y - 16 * s); c.moveTo(x, y - 12 * s); c.lineTo(x + 7 * s, y - 20 * s); c.stroke();
}
// ada: ortamına göre süslenmiş platform
function island(c, kind, x, y, w, s, t, dark) {
  const h = w * 0.22;
  c.save();
  if (kind === 'akinti') { // güçlü akıntı: platform yerine girdap
    c.strokeStyle = 'rgba(140,220,255,.75)'; c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { c.lineWidth = (6 - i) * s; c.beginPath(); c.ellipse(x, y + h * 0.2, w * (0.5 - i * 0.08), h * (0.6 - i * 0.08), 0, t * 0.8 + i, t * 0.8 + i + 4.2); c.stroke(); }
    c.restore(); return;
  }
  const ice = dark === 'ice', sand = ice ? '#eaf8ff' : dark ? '#5a5a7a' : '#e9c98a', sand2 = ice ? '#9fd0ea' : dark ? '#3a3a58' : '#c9a061';
  if (kind === 'gemi') { // batık gemi tahtası
    c.fillStyle = '#7a5030'; c.strokeStyle = '#3a2210'; c.lineWidth = 3 * s; c.beginPath(); c.moveTo(x - w * 0.5, y); c.lineTo(x + w * 0.5, y - h * 0.3); c.lineTo(x + w * 0.42, y + h * 0.5); c.lineTo(x - w * 0.42, y + h * 0.6); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.3)'; for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x - w * 0.46, y + h * (k * 0.18)); c.lineTo(x + w * 0.46, y - h * 0.3 + h * (k * 0.2)); c.stroke(); }
    c.restore(); return;
  }
  const g = c.createLinearGradient(0, y - h, 0, y + h); g.addColorStop(0, sand); g.addColorStop(1, sand2);
  c.fillStyle = g; c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2 * s;
  c.beginPath(); c.ellipse(x, y, w * 0.5, h * 0.55, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.ellipse(x, y + h * 0.35, w * 0.46, h * 0.28, 0, 0, Math.PI); c.fill();
  if (kind === 'canyon' || kind === 'magara') { // yanlarda kaya sütunları / mağara kemeri
    c.fillStyle = kind === 'magara' ? '#2a2a44' : '#5a6a8a'; c.strokeStyle = '#1a2238'; c.lineWidth = 2.5 * s;
    for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) { const bx = x + sx * w * (0.4 - k * 0.09), bh = h * (1.35 - k * 0.35); c.beginPath(); c.roundRect(bx - w * 0.06, y - bh, w * 0.12, bh, 4 * s); c.fill(); c.stroke(); }
    if (kind === 'magara') { c.beginPath(); c.arc(x, y - h * 0.2, w * 0.31, Math.PI, 0); c.lineWidth = w * 0.06; c.strokeStyle = '#2a2a44'; c.stroke(); }
  }
  if (kind === 'baca') for (const dx of [-0.32, 0.3]) { // sıcak bacalar
    c.fillStyle = '#3a3448'; c.beginPath(); c.moveTo(x + w * dx - 10 * s, y); c.lineTo(x + w * dx - 6 * s, y - 26 * s); c.lineTo(x + w * dx + 6 * s, y - 26 * s); c.lineTo(x + w * dx + 10 * s, y); c.fill();
    c.fillStyle = `rgba(255,140,40,${0.6 + 0.3 * Math.sin(t * 4 + dx)})`; c.beginPath(); c.ellipse(x + w * dx, y - 26 * s, 6 * s, 2.5 * s, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(220,220,230,.35)'; for (let k = 0; k < 3; k++) { const p = (t * 0.6 + k / 3) % 1; c.beginPath(); c.arc(x + w * dx + Math.sin(p * 6) * 4 * s, y - 30 * s - p * 30 * s, (4 + p * 6) * s, 0, TAU); c.fill(); }
  }
  if (kind === 'mayin') for (const dx of [-0.34, 0.33]) { c.fillStyle = '#3d26a0'; c.beginPath(); c.arc(x + w * dx, y - 12 * s, 8 * s, 0, TAU); c.fill(); c.fillStyle = '#ff6a6a'; c.beginPath(); c.arc(x + w * dx, y - 21 * s, 3 * s, 0, TAU); c.fill(); }
  if (kind === 'yosun' || kind === 'kacis') for (const dx of [-0.38, -0.3, 0.3, 0.38]) { // yosun / karanlık otlar
    c.strokeStyle = kind === 'kacis' ? '#2a4a5a' : '#3aa060'; c.lineWidth = 4 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + w * dx, y);
    for (let k = 1; k <= 5; k++) c.lineTo(x + w * dx + Math.sin(t * 2 + k + dx * 9) * 4 * s, y - k * 9 * s); c.stroke();
  }
  if (kind === 'sarkit' || kind === 'isik' || (ice && kind === 'arena')) { // buz sarkıtları / kuzey ışığı / buz sarayı kuleleri
    c.fillStyle = 'rgba(235,250,255,.95)'; c.strokeStyle = '#6ab8e0'; c.lineWidth = 2 * s;
    for (const [dx, hh] of [[-0.36, 30], [-0.26, 20], [0.28, 24], [0.38, 34]]) { c.beginPath(); c.moveTo(x + w * dx - 8 * s, y); c.lineTo(x + w * dx, y - hh * s); c.lineTo(x + w * dx + 8 * s, y); c.closePath(); c.fill(); c.stroke(); }
    if (kind === 'isik') { c.save(); c.globalCompositeOperation = 'lighter'; for (const [dx, col] of [[-0.2, 'rgba(120,255,200,.35)'], [0.2, 'rgba(180,140,255,.3)']]) { c.fillStyle = col; c.beginPath(); c.moveTo(x + w * dx - 6 * s, y - 70 * s); c.lineTo(x + w * dx + 6 * s, y - 70 * s); c.lineTo(x + w * dx + 16 * s, y); c.lineTo(x + w * dx - 16 * s, y); c.fill(); } c.restore(); }
  }
  if (kind === 'buzdag' || kind === 'kaygan') { // buz blokları / kaygan parıltılar
    if (kind === 'buzdag') { c.fillStyle = '#f4fcff'; c.strokeStyle = '#5aa8d4'; c.lineWidth = 2 * s; for (const [dx, bw, bh] of [[-0.3, 34, 18], [0.3, 40, 22]]) { c.beginPath(); c.roundRect(x + w * dx - bw / 2 * s, y - bh * s, bw * s, bh * s, 4 * s); c.fill(); c.stroke(); } }
    else { c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2.5 * s; c.lineCap = 'round'; for (const [dx, dy] of [[-0.35, -4], [-0.25, 2], [0.25, -3], [0.36, 3]]) { c.beginPath(); c.moveTo(x + w * dx - 10 * s, y + dy * s); c.lineTo(x + w * dx + 10 * s, y + dy * s - 2 * s); c.stroke(); } }
  }
  if (kind === 'reefs' || (kind === 'arena' && !ice)) { // mercanlar ve deniz yıldızı
    coral(c, x - w * 0.36, y - h * 0.1, s * 1.1, '#ff6fa8'); coral(c, x - w * 0.27, y - h * 0.05, s * 0.9, '#ffb03a');
    coral(c, x + w * 0.3, y - h * 0.1, s * 1.1, '#a87cff'); coral(c, x + w * 0.38, y - h * 0.02, s * 0.9, '#ffd23a');
    c.fillStyle = '#ff8a5a'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 3 : 7) * s; c.lineTo(x + w * 0.42 + Math.cos(a) * r, y + h * 0.1 + Math.sin(a) * r); } c.fill();
  }
  c.restore();
}
// harita düzeni (s45): 5 ada (4 mini canavar bölümü + büyük canavar), yukarıdan aşağı zikzak
const NB = 5, BIG = NB - 1;
function nodes(W, H, top) {
  const ys = [0.19, 0.32, 0.45, 0.58, 0.755].map(k => top + (H - top) * k);
  return ys.map((y, i) => ({ x: W / 2 + [-0.17, 0.17, -0.17, 0.17, 0][i] * W, y, w: Math.min(W * (i === BIG ? 0.74 : 0.5), i === BIG ? 320 : 210) }));
}
function pathPt(a, b, k) { const mx = (a.x + b.x) / 2 + (a === b ? 0 : (b.y - a.y) * 0.45 * (a.x <= b.x ? -1 : 1)), my = (a.y + b.y) / 2; const u = 1 - k; return { x: u * u * a.x + 2 * u * k * mx + k * k * b.x, y: u * u * (a.y + 26) + 2 * u * k * my + k * k * (b.y - 40) }; }

function draw(c, G) {
  const { W, H, FONT, time: t } = G, S = Math.min(W / 390, H / 844), top = G.top || 0;
  const groups = OktoCampaign.GROUPS, gi = Math.max(0, G.group | 0), gb = gi % groups.length, th = THEMES[gb % THEMES.length]; // gi: mutlak grup (3 gruptan sonra güçlenerek tekrar)
  const first = gi * OktoCampaign.PER_GROUP + 1; // grubun ilk bölüm numarası
  layout.texts = []; layout.islands = [];
  // arka plan
  const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, th.top); bg.addColorStop(0.55, th.mid); bg.addColorStop(1, th.bot);
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  if (th.sun) { c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) { const x = W * (0.2 + i * 0.15) + Math.sin(t * 0.3 + i) * 10; const g = c.createLinearGradient(0, 0, 0, H * 0.7); g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(x - 14, 0); c.lineTo(x + 20, 0); c.lineTo(x + 80, H * 0.7); c.lineTo(x + 10, H * 0.7); c.fill(); } c.restore(); }
  c.fillStyle = th.rock; // yanlarda kaya silüetleri
  for (const sx of [0, 1]) { c.beginPath(); const x0 = sx ? W : 0, d = sx ? -1 : 1; c.moveTo(x0, 0); for (let k = 0; k <= 12; k++) { const y = k / 12 * H; c.lineTo(x0 + d * (W * 0.07 + Math.sin(k * 1.7 + sx) * W * 0.04 + (k % 3 === 0 ? W * 0.05 : 0)), y); } c.lineTo(x0, H); c.closePath(); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 26; i++) { const x = (i * 97 % 100) / 100 * W, y = H - ((t * 18 + i * 61) % (H + 20)); c.beginPath(); c.arc(x, y, (1.2 + (i % 3)) * S, 0, TAU); c.fill(); } // kabarcıklar
  // başlık
  const L1 = OktoCampaign.level(first), L4 = OktoCampaign.level(first + BIG), GR = { name: L1.groupName }; // tekrar turunda "+1" eki
  c.font = `700 ${40 * S}px ${FONT}`; let tw = c.measureText(GR.name).width, ts = 40 * S; if (tw > W - 120) { ts *= (W - 120) / tw; /* kapat düğmesine değmesin */ c.font = `700 ${ts}px ${FONT}`; tw = c.measureText(GR.name).width; }
  const ty = top + 48 * S;
  c.lineJoin = 'round'; c.lineWidth = ts * 0.22; c.strokeStyle = 'rgba(8,40,80,.85)'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.strokeText(GR.name, W / 2 - tw / 2, ty); c.fillStyle = th.title; c.fillText(GR.name, W / 2 - tw / 2, ty);
  layout.texts.push({ text: GR.name, x0: W / 2 - tw / 2, x1: W / 2 + tw / 2, y0: ty - ts / 2, y1: ty + ts / 2 });
  pill(c, W / 2, ty + 40 * S, `${L1.start}–${L4.end} m`, 17 * S, 'rgba(10,50,90,.75)', null, '#ffffff', FONT);
  const N = nodes(W, H, top + 20 * S);
  // noktalı yol
  for (let i = 0; i < NB; i++) {
    const a = i === 0 ? { x: W / 2, y: ty + 64 * S } : N[i - 1], b = N[i], done = first + i <= G.unlocked;
    for (let k = 0.05; k < 1; k += 0.07) { const p = pathPt(a, b, k); c.fillStyle = done ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.3)'; c.beginPath(); c.arc(p.x, p.y, 3.2 * S, 0, TAU); c.fill(); }
  }
  { const a = N[BIG], b = { x: W / 2, y: H - 80 * S }; for (let k = 0.55; k < 1; k += 0.15) { c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(a.x, a.y + (b.y - a.y) * k + 30 * S, 3 * S, 0, TAU); c.fill(); } }
  // adalar
  const labels = [];
  for (let i = 0; i < NB; i++) {
    const n = first + i, L = OktoCampaign.level(n), nd = N[i], big = i === BIG, kind = big ? 'arena' : (L.zones && L.zones[0]) || 'reefs';
    const done = n < G.current || n < G.unlocked && !(n === G.current), cur = n === G.current, locked = n > G.unlocked;
    const s = S * (big ? 1.15 : 1);
    c.save(); if (locked) c.globalAlpha = 0.45;
    if (cur) { const g = c.createRadialGradient(nd.x, nd.y, nd.w * 0.1, nd.x, nd.y, nd.w * 0.7); g.addColorStop(0, `rgba(255,120,200,${0.45 + 0.15 * Math.sin(t * 3)})`); g.addColorStop(1, 'rgba(255,120,200,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(nd.x, nd.y - nd.w * 0.08, nd.w * 0.7, nd.w * 0.45, 0, 0, TAU); c.fill(); }
    island(c, kind, nd.x, nd.y, nd.w, s, t, th.ice ? 'ice' : gb === 2);
    // canavar
    const def = OktoBossAI.get(L.boss), br = (big ? 34 : 26) * S;
    if (def && window.OktoBosses) {
      const fake = { kind: def.id, def, x: nd.x + (big ? 0 : nd.w * 0.08), y: nd.y - br * 0.75 - (big ? 6 : 0) * S, r: br, flashT: 0, stun: 0, puff: 0, puffT: 0, t, side: 1, vis: 1, big };
      c.save(); if (locked) c.filter = 'grayscale(0.6) brightness(0.7)';
      OktoBosses.draw({ ctx: c, S: br / 50, W, H, time: t, FONT, boss: fake, player: { x: fake.x, y: fake.y - 100 }, slams: [], shots: [] });
      c.restore();
    }
    // ad etiketi (adalar ve canavarlar bittikten sonra en üstte çizilir)
    c.restore();
    labels.push(() => { c.save(); if (locked) c.globalAlpha = 0.45;
    const lab = big ? def.name.toLocaleLowerCase('tr').replace(/(^|\s)\S/g, m => m.toLocaleUpperCase('tr')) : L.name;
    const ly = nd.y + nd.w * 0.15;
    const pw = pill(c, nd.x, ly, lab, (big ? 22 : 18) * S, cur ? 'rgba(200,60,150,.92)' : 'rgba(8,50,80,.88)', cur ? '#ffc8ec' : 'rgba(150,230,255,.7)', '#ffffff', FONT, W - 30);
    if (big) pill(c, nd.x, ly + 30 * S, `${L.end} m`, 15 * S, 'rgba(8,50,80,.9)', 'rgba(150,230,255,.6)', '#ffffff', FONT);
    c.restore();
    // durum işaretleri
    const bx0 = Math.min(nd.x + pw.w / 2 + 16 * S, W - 16 * S); // işaret etiketin hemen sağında
    if (n < G.current && !locked) { const bx = bx0, by = ly - 2 * S; c.fillStyle = '#2fcf7a'; c.strokeStyle = '#fff'; c.lineWidth = 2.5 * S; c.beginPath(); c.arc(bx, by, 12 * S, 0, TAU); c.fill(); c.stroke(); c.lineWidth = 3 * S; c.beginPath(); c.moveTo(bx - 5 * S, by); c.lineTo(bx - 1 * S, by + 4 * S); c.lineTo(bx + 6 * S, by - 5 * S); c.stroke(); } // tik
    if (locked) { const bx = bx0, by = ly - 2 * S; c.fillStyle = '#ffd73a'; c.strokeStyle = '#ffd73a'; c.lineWidth = 3 * S; c.beginPath(); c.arc(bx, by - 6 * S, 6 * S, Math.PI, 0); c.stroke(); c.beginPath(); c.roundRect(bx - 9 * S, by - 6 * S, 18 * S, 14 * S, 3 * S); c.fill(); } // kilit
    });
    layout.islands.push({ n, x: nd.x, y: nd.y - nd.w * 0.15, r: nd.w * 0.42, locked });
  }
  for (const f of labels) f();
  // sonraki grup
  const ng = { name: OktoCampaign.level(first + OktoCampaign.PER_GROUP).groupName }, ny = H - 56 * S;
  pill(c, W / 2, ny, ng.name, 22 * S, 'rgba(0,0,0,0)', null, '#ffffff', FONT, W - 250); // köşelerdeki düğmelere değmesin
  c.strokeStyle = '#ffffff'; c.lineWidth = 4 * S; c.lineCap = 'round'; c.beginPath(); c.moveTo(W / 2 - 12 * S, ny + 20 * S); c.lineTo(W / 2, ny + 31 * S); c.lineTo(W / 2 + 12 * S, ny + 20 * S); c.stroke();
  // Okto: şu anki adada; yüzerken iki ada arasında
  let ox, oy;
  const idx = n => n - first, nodeOf = n => { const i = idx(n); return i >= 0 && i < NB ? N[i] : i >= NB ? { x: W / 2, y: ny - 30 * S, w: 0 } : { x: W / 2, y: ty + 60 * S, w: 0 }; };
  const okAt = nd => ({ x: nd.x - (nd.w ? nd.w * (nd.w < W * 0.6 ? 0.36 : 0.26) : 0), y: nd.y - (nd.w ? nd.w * 0.06 : 0) - 14 * S });
  if (G.swim && G.swim.t < 1) { const a = okAt(nodeOf(G.swim.from)), b = okAt(nodeOf(G.swim.to)), k = ease(G.swim.t); ox = a.x + (b.x - a.x) * k + Math.sin(k * Math.PI) * 40 * S; oy = a.y + (b.y - a.y) * k; }
  else { const p = okAt(nodeOf(G.swim ? G.swim.to : G.current)); ox = p.x; oy = p.y; }
  const inG = n => idx(n) >= 0 && idx(n) < NB, here = G.swim ? inG(G.swim.from) || inG(G.swim.to) : inG(G.current); // Okto yalnızca kendi grubunun haritasında
  if (here && window.OktoChar) OktoChar.draw(c, ox, oy + Math.sin(t * 3) * 3 * S, 22 * S, t, Object.assign({ expr: { wave: G.swim && G.swim.t < 1 ? 0 : 0.6 }, bob: Math.sin(t * 3) }, G.look || {}));
  if (G.fresh > 0) { // büyük canavardan sonra: yeni grup açıldı
    const a = Math.min(1, G.fresh / 0.6); c.save(); c.globalAlpha = a;
    pill(c, W / 2, top + (H - top) * 0.39, 'Yeni bölge açıldı!', 26 * S, 'rgba(255,200,40,.95)', '#fff6c8', '#5a3000', FONT, W - 40); c.restore();
  }
  last = layout.islands.slice();
}
function hit(x, y) { if (!last) return null; for (const I of last) if (Math.hypot(x - I.x, (y - I.y) * 1.3) < I.r) return I.locked ? { n: I.n, locked: true } : { n: I.n, locked: false }; return null; }
window.OktoMap = { draw, hit, THEMES, layout, groupOf: n => Math.floor((Math.max(1, n) - 1) / OktoCampaign.PER_GROUP) };
})();
