// Mobil menü
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('ana-menu');

toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
});

nav.querySelectorAll('a').forEach((link) =>
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Menüyü aç');
  })
);

// Telif yılı
document.getElementById('yil').textContent = new Date().getFullYear();

// Ürün sekmeleri
document.documentElement.classList.add('js');
const tabs = Array.from(document.querySelectorAll('.ptab'));
const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));

function selectTab(i, focus) {
  tabs.forEach((t, j) => {
    const on = i === j;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    panels[j].hidden = !on;
  });
  if (focus) tabs[i].focus();
}

tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(i, false));
  t.addEventListener('keydown', (e) => {
    const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (k) { e.preventDefault(); selectTab((i + k + tabs.length) % tabs.length, true); }
    if (e.key === 'Home') { e.preventDefault(); selectTab(0, true); }
    if (e.key === 'End') { e.preventDefault(); selectTab(tabs.length - 1, true); }
  });
});
if (tabs.length) selectTab(0, false);

// Ventus sahnesi: geniş kadrajda şef tezgaha un serper; kaydırdıkça kamera
// tezgah boyunca Ventus paketine yaklaşır, arka plan flulaşır.
(function () {
  const scene = document.getElementById('ventus-sahne');
  if (!scene) return;
  const view = scene.querySelector('.chef-view');
  const world = scene.querySelector('.chef-world');
  const bg = scene.querySelector('.chef-bg');
  const canvas = scene.querySelector('.chef-flour');
  const ctx = canvas.getContext('2d');
  const caps = scene.querySelectorAll('.art-cap');
  const grain = scene.querySelector('.art-grain');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const IW = 1680, IH = 944;                 // görselin koordinatları
  const PACK = { x: 1300, y: 600, h: 310 };  // paketin merkezi ve yüksekliği

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (t) => t * t * (3 - 2 * t);
  const range = (p, a, b) => smooth(clamp((p - a) / (b - a), 0, 1));
  const lerp = (a, b, t) => a + (b - a) * t;

  // film greni
  (function () {
    const g = document.createElement('canvas'); g.width = g.height = 140;
    const gc = g.getContext('2d'); const im = gc.createImageData(140, 140);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
    }
    gc.putImageData(im, 0, 0);
    grain.style.backgroundImage = 'url(' + g.toDataURL() + ')';
  })();

  let VW = 0, VH = 0, narrow = false;
  function measure() {
    VW = view.clientWidth; VH = view.clientHeight; narrow = VW < 820;
  }

  function progress() {
    const r = scene.getBoundingClientRect();
    const total = r.height - view.clientHeight;
    return clamp(-r.top / (total || 1), 0, 1);
  }

  // kamera: t=0 geniş kadraj, t=1 paketin yakın planı
  function camera(t) {
    const s0 = Math.max(VW / IW, VH / IH);
    const z1 = narrow ? 1.6 : 0.62 * VH / (PACK.h * s0);
    const S = s0 * Math.exp(lerp(0, Math.log(Math.max(z1, 1)), t));
    const fx = lerp(narrow ? 560 : IW / 2, PACK.x, t);
    const fy = lerp(IH / 2, PACK.y, t);
    const ax = lerp(VW / 2, VW * (narrow ? 0.5 : 0.68), t);
    const ay = lerp(VH / 2, VH * (narrow ? 0.3 : 0.46), t);
    let tx = ax - fx * S, ty = ay - fy * S;
    tx = clamp(tx, VW - IW * S, 0); ty = clamp(ty, VH - IH * S, 0); // görsel kenarı görünmesin
    world.style.transform = 'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0) scale(' + S.toFixed(4) + ')';
    const blur = 7 * smooth(clamp((t - 0.15) / 0.85, 0, 1));
    bg.style.filter = blur > 0.05 ? 'blur(' + (blur / S).toFixed(2) + 'px) brightness(' + (1 - t * 0.18).toFixed(3) + ')' : '';
  }

  // şefin parmaklarından dökülen un: ince akış + havada asılı toz bulutu
  const PINCH = [[556, 312], [572, 318], [586, 322], [544, 306]]; // parmak uçları
  const haze = document.createElement('canvas'); haze.width = haze.height = 64;
  (function () {
    const hc = haze.getContext('2d');
    const g = hc.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,232,200,1)'); g.addColorStop(1, 'rgba(255,232,200,0)');
    hc.fillStyle = g; hc.fillRect(0, 0, 64, 64);
  })();
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const lightAt = (x) => clamp(1.2 - (x - 420) / 420, 0.3, 1); // ışık soldan gelir
  let dust = [], clouds = [], clock = 0;

  function flour(dt, rate) {
    clock += dt;
    const k = dt * 60;
    // ince taneler
    const n = Math.round(rate * k);
    for (let i = 0; i < n; i++) {
      const o = PINCH[(Math.random() * PINCH.length) | 0];
      dust.push({
        x: o[0] + gauss() * 16, y: o[1] + gauss() * 8 + Math.random() * 14,
        vx: gauss() * 0.4 - 0.16, vy: 0.1 + Math.random() * 0.4,
        s: 0.3 + Math.pow(Math.random(), 2.2) * 1.0,
        a: 0.12 + Math.random() * 0.4,
        term: 0.9 + Math.random() * 1.4, ph: Math.random() * 6.28
      });
    }
    // toz bulutu
    if (Math.random() < 0.06 * k * Math.min(1, rate / 30)) {
      clouds.push({ x: 470 + Math.random() * 200, y: 380 + Math.random() * 260, r: 22 + Math.random() * 46,
        vx: (Math.random() - 0.4) * 0.12, vy: 0.05 + Math.random() * 0.1, life: 0, max: 4 + Math.random() * 4 });
    }

    ctx.clearRect(0, 0, IW, IH);
    ctx.globalCompositeOperation = 'lighter';

    const keepC = [];
    for (const c of clouds) {
      c.life += dt; c.x += c.vx * k; c.y += c.vy * k; c.r += 0.04 * k;
      if (c.life > c.max) continue;
      const f = Math.sin(Math.PI * c.life / c.max);
      ctx.globalAlpha = 0.05 * f * lightAt(c.x);
      ctx.drawImage(haze, c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
      keepC.push(c);
    }
    clouds = keepC;

    ctx.lineCap = 'round';
    ctx.strokeStyle = '#F7DDB6';
    const keep = [];
    for (const q of dust) {
      // hava akımı: yavaş değişen girdap
      const turb = Math.sin(q.y * 0.021 + clock * 0.9 + q.ph) * 0.022 + Math.sin(q.y * 0.009 - clock * 0.5 + q.ph * 2) * 0.014;
      const fallen = clamp((q.y - 320) / 340, 0, 1);
      q.vx = (q.vx + turb * (0.6 + 1.6 * fallen) * k + gauss() * 0.02 * k) * Math.pow(0.99, k);
      q.vy = Math.min(q.vy + 0.012 * k, q.term);
      q.x += q.vx * k; q.y += q.vy * k;
      if (q.y > 690 - q.ph * 3) continue;
      const fade = (1 - fallen * 0.55) * clamp((q.y - 300) / 25, 0, 1);
      const al = q.a * fade * lightAt(q.x);
      if (al < 0.01) { keep.push(q); continue; }
      ctx.globalAlpha = al;
      ctx.lineWidth = q.s;
      ctx.beginPath();
      ctx.moveTo(q.x - q.vx * 2.2, q.y - q.vy * 2.2); // hafif hareket izi
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
      keep.push(q);
    }
    dust = keep.length > 9000 ? keep.slice(-9000) : keep;
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  let running = false, last = 0, lastCap = -1;
  function setCaption(p) {
    const c = p < 0.28 ? 0 : p < 0.7 ? 1 : 2;
    if (c !== lastCap) { caps.forEach((el, i) => el.classList.toggle('is-active', i === c)); lastCap = c; }
  }
  function frame(ms) {
    const dt = Math.min(0.05, last ? (ms - last) / 1000 : 0.016); last = ms;
    const p = progress();
    const t = range(p, 0.1, 0.82);
    camera(t);
    setCaption(p);
    flour(dt, 24 * (1 - t * 0.6));
    if (running) requestAnimationFrame(frame); else last = 0;
  }

  measure();
  if (reduce) { camera(1); window.addEventListener('resize', () => { measure(); camera(1); }); return; }
  camera(0);
  const io = new IntersectionObserver(([e]) => {
    const was = running; running = e.isIntersecting;
    if (running && !was) requestAnimationFrame(frame);
  });
  io.observe(scene);
  window.addEventListener('resize', () => { measure(); camera(range(progress(), 0.1, 0.82)); });
})();
