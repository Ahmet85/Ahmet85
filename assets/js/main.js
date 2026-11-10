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

// Ventus sahnesi: karanlıkta ışık hüzmesi; kaydırdıkça un savrulur,
// "Ventus" yazısını oluşturur, sonra dağılır ve pizza karanlıktan belirir.
(function () {
  const scene = document.getElementById('ventus-sahne');
  if (!scene) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = scene.querySelector('.art-canvas');
  const ctx = canvas.getContext('2d');
  const caps = scene.querySelectorAll('.art-cap');
  const grain = scene.querySelector('.art-grain');

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (t) => t * t * (3 - 2 * t);
  const range = (p, a, b) => smooth(clamp((p - a) / (b - a), 0, 1));
  const outCubic = (t) => 1 - Math.pow(1 - t, 3);

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

  // yumuşak un tanesi
  const sprite = document.createElement('canvas'); sprite.width = sprite.height = 64;
  (function () {
    const sc = sprite.getContext('2d');
    const gr = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,246,230,1)');
    gr.addColorStop(0.35, 'rgba(255,240,215,.55)');
    gr.addColorStop(1, 'rgba(255,236,205,0)');
    sc.fillStyle = gr; sc.fillRect(0, 0, 64, 64);
  })();

  const small = window.matchMedia('(max-width: 820px)').matches;
  const N = small ? 2400 : 5200;
  const parts = [];
  for (let i = 0; i < N; i++) {
    parts.push({
      a: -0.62 + Math.random() * 0.78,        // savrulma açısı (sağa, hafif yukarı)
      s: Math.pow(Math.random(), 0.7),        // savrulma mesafesi
      z: Math.random(),                        // derinlik
      ph: Math.random() * 6.283,
      dl: Math.random(),                       // gecikme
      tx: null, ty: null
    });
  }
  const motes = [];
  for (let i = 0; i < (small ? 70 : 140); i++) motes.push({ x: Math.random(), y: Math.random(), z: Math.random(), ph: Math.random() * 6.283 });

  let W = 0, H = 0, dpr = 1, running = false;

  function buildTargets() {
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    const oc = off.getContext('2d');
    const fs = Math.min(W * (small ? 0.3 : 0.22), H * 0.34);
    oc.fillStyle = '#fff'; oc.textAlign = 'center'; oc.textBaseline = 'middle';
    oc.font = 'italic 300 ' + fs + 'px "Cormorant Garamond", "Times New Roman", serif';
    oc.fillText('Ventus', W / 2, H * (small ? 0.36 : 0.42));
    const data = oc.getImageData(0, 0, W, H).data;
    const pts = [];
    const step = 2;
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (data[(y * W + x) * 4 + 3] > 140) pts.push([x, y]);
    for (let i = pts.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pts[i], pts[j]] = [pts[j], pts[i]]; }
    parts.forEach((p, i) => {
      if (i < pts.length) { p.tx = pts[i][0] + (Math.random() - 0.5) * step; p.ty = pts[i][1] + (Math.random() - 0.5) * step; }
      else { p.tx = null; p.ty = null; }
    });
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildTargets();
  }

  // ışık hüzmesi: üstten hafif sağdan iner
  function light(x, y) {
    const ax = W * 0.58 - (y / H) * W * 0.08;
    const w = W * 0.07 + y * 0.32;
    const d = (x - ax) / w;
    return Math.exp(-d * d);
  }

  function drawBeam(alpha) {
    for (let k = 0; k < 3; k++) {
      const spread = [0.10, 0.2, 0.32][k];
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(255,232,196,' + (0.07 * alpha) + ')');
      g.addColorStop(0.7, 'rgba(255,232,196,' + (0.025 * alpha) + ')');
      g.addColorStop(1, 'rgba(255,232,196,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(W * 0.58 - W * 0.02, -10); ctx.lineTo(W * 0.58 + W * 0.02, -10);
      ctx.lineTo(W * 0.5 + W * spread, H); ctx.lineTo(W * 0.5 - W * spread, H);
      ctx.closePath(); ctx.fill();
    }
  }

  function progress() {
    const r = scene.getBoundingClientRect();
    const total = r.height - (window.innerHeight - 72);
    return clamp(-r.top / (total || 1), 0, 1);
  }

  let lastCap = -1;
  function frame(ms) {
    const t = ms / 1000;
    const p = progress();
    const reveal = range(p, 0.68, 0.92);
    scene.style.setProperty('--reveal', reveal.toFixed(3));
    const cap = p < 0.26 ? 0 : p < 0.64 ? 1 : 2;
    if (cap !== lastCap) { caps.forEach((c, i) => c.classList.toggle('is-active', i === cap)); lastCap = cap; }

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    drawBeam(1 - reveal * 0.6);

    // ışıkta süzülen toz
    for (const m of motes) {
      const x = ((m.x + Math.sin(t * 0.05 + m.ph) * 0.02) % 1) * W;
      const y = ((m.y + t * 0.004 * (0.4 + m.z)) % 1) * H;
      const l = light(x, y);
      if (l < 0.05) continue;
      const r = 0.6 + m.z * 1.8;
      ctx.globalAlpha = l * 0.55 * (1 - reveal * 0.7);
      ctx.drawImage(sprite, x - r * 2, y - r * 2, r * 4, r * 4);
    }

    const appear = range(p, 0.0, 0.05);
    const k = outCubic(clamp((p - 0.02) / 0.3, 0, 1));
    const hx = W * (small ? 0.02 : 0.1), hy = H * (small ? 0.5 : 0.7);      // ustanın eli
    for (const q of parts) {
      const dist = q.s * W * (small ? 1.05 : 0.85) * k;
      const sw = (0.35 + q.z) * (small ? 10 : 18);
      let x = hx + Math.cos(q.a) * dist + Math.sin(t * 0.45 + q.ph) * sw * k;
      let y = hy + Math.sin(q.a) * dist * 1.1 + k * k * H * 0.1 * q.s + Math.cos(t * 0.38 + q.ph * 1.7) * sw * 0.8 * k;
      let a = appear * (0.35 + 0.65 * (1 - q.s * 0.5));
      let lit = 0.18 + 0.82 * light(x, y);
      let formed = 0;

      if (q.tx !== null) {
        const f = range(p, 0.26 + q.dl * 0.1, 0.4 + q.dl * 0.1);
        x += (q.tx + Math.sin(t * 0.8 + q.ph) * 0.8 - x) * f;
        y += (q.ty + Math.cos(t * 0.7 + q.ph) * 0.8 - y) * f;
        lit = lit + (1 - lit) * f;
        formed = f;
      } else {
        a *= 1 - range(p, 0.26, 0.45) * 0.75;
      }

      const blow = range(p, 0.62 + q.dl * 0.08, 0.82 + q.dl * 0.08);
      if (blow > 0) {
        x += (x - W * 0.45) * blow * 0.5 + blow * W * 0.3 * (q.z - 0.2);
        y -= blow * H * (0.25 + q.z * 0.3);
        a *= 1 - blow;
      }
      if (a < 0.01) continue;

      let r = 0.45 + q.z * 1.25 + formed * 0.35;
      if (q.z > 0.93 && q.tx === null) { r *= 4; a *= 0.25; }  // öndeki bulanık taneler
      ctx.globalAlpha = Math.min(1, a * lit);
      ctx.drawImage(sprite, x - r * 2, y - r * 2, r * 4, r * 4);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (running) requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver(([e]) => {
    const was = running; running = e.isIntersecting;
    if (running && !was) requestAnimationFrame(frame);
  });

  const start = () => { resize(); io.observe(scene); requestAnimationFrame(frame); };
  window.addEventListener('resize', () => { resize(); });
  if (document.fonts && document.fonts.load) {
    document.fonts.load('italic 300 80px "Cormorant Garamond"').then(start, start);
  } else start();
})();
