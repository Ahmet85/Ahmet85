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

// Ventus sahnesi: aşağı kaydırdıkça çuval eğilir, un serpilir, hamur pizzaya döner
(function () {
  const scene = document.getElementById('ventus-sahne');
  if (!scene) return;
  const stage = scene.querySelector('.scene-stage');
  const bag = scene.querySelector('.scene-bag');
  const canvas = scene.querySelector('.scene-flour');
  const steps = scene.querySelectorAll('.scene-steps li');
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (t) => t * t * (3 - 2 * t);
  const range = (p, a, b) => ease(clamp((p - a) / (b - a), 0, 1));

  let W = 0, H = 0, dpr = 1, progress = 0, running = false;
  const dust = document.createElement('canvas'); // unun hamurda biriken izi
  const dctx = dust.getContext('2d');
  let particles = [];

  function resize() {
    const r = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    for (const c of [canvas, dust]) { c.width = W * dpr; c.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function dough() { // hamur dairesi: merkez ve yarıçap
    const d = W * 0.74;
    return { x: W / 2, y: H * 0.98 - d / 2, r: d / 2 };
  }

  function bagMouth(rot) { // çuval ağzının (üst kenar) sahnedeki konumu
    const bw = bag.offsetWidth, bh = bag.offsetHeight;
    const cx = W / 2 + parseFloat(getComputedStyle(stage).getPropertyValue('--bag-x')) / 100 * bw;
    const cy = parseFloat(getComputedStyle(stage).getPropertyValue('--bag-y')) / 100 * bh + bh / 2;
    const a = rot * Math.PI / 180;
    return { x: cx + Math.sin(a) * bh * 0.46, y: cy - Math.cos(a) * bh * 0.46 };
  }

  function update() {
    const r = scene.getBoundingClientRect();
    const total = r.height - window.innerHeight;
    progress = clamp(-r.top / (total || 1), 0, 1);
    const tilt = range(progress, 0.05, 0.3);
    const rot = -6 + tilt * 146;               // çuval ters döner
    const pourT = range(progress, 0.22, 0.62);
    const sweep = Math.sin(pourT * Math.PI * 2.5) * 100 * Math.sin(pourT * Math.PI); // serperken sağa sola gezer
    const shift = -tilt * 45 + sweep; // ağzı hamurun ortasına getirir
    const drop = tilt * 6 - range(progress, 0.7, 0.95) * 30;
    stage.style.setProperty('--bag-r', rot + 'deg');
    stage.style.setProperty('--bag-x', shift + '%');
    stage.style.setProperty('--bag-y', drop + '%');
    stage.style.setProperty('--pizza', range(progress, 0.6, 0.88).toFixed(3));
    bag.style.opacity = String(1 - range(progress, 0.78, 0.95));
    const active = progress < 0.4 ? 0 : progress < 0.68 ? 1 : 2;
    steps.forEach((li, i) => li.classList.toggle('is-active', i === active));
    if (progress < 0.12) dctx.clearRect(0, 0, W, H); // yukarı çıkınca hamur temizlenir
    return rot;
  }

  function frame() {
    const rot = update();
    const pour = progress > 0.22 && progress < 0.64 ? 1 : 0;
    if (pour) {
      const m = bagMouth(rot);
      const dd = dough();
      for (let i = 0; i < 12; i++) {
        particles.push({
          x: m.x + (Math.random() - 0.5) * W * 0.05, y: m.y + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 2.4, vy: Math.random() * 1.2,
          s: 0.7 + Math.random() * 2, a: 0.5 + Math.random() * 0.5,
          land: dd.y + (Math.random() * 1.7 - 0.85) * dd.r // her tanenin düşeceği yükseklik
        });
      }
    }
    const d = dough();
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 1 - parseFloat(getComputedStyle(stage).getPropertyValue('--pizza') || 0);
    ctx.drawImage(dust, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#FFFFFF';
    const keep = [];
    for (const p of particles) {
      p.vy += 0.12; p.vx *= 0.99; p.x += p.vx + Math.sin(p.y / 18) * 0.25; p.y += p.vy;
      const dx = p.x - d.x, dy = p.y - d.y;
      if (p.y >= p.land && dx * dx + dy * dy < d.r * d.r * 0.94) { // hamura düştü
        dctx.fillStyle = 'rgba(255,255,255,' + (p.a * 0.35) + ')';
        dctx.beginPath(); dctx.arc(p.x, p.y, p.s * 1.3, 0, 6.283); dctx.fill();
        continue;
      }
      if (p.y > H + 10) continue;
      ctx.globalAlpha = p.a;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill();
      keep.push(p);
    }
    ctx.globalAlpha = 1;
    particles = keep;
    if (running || particles.length) requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver(([e]) => {
    const was = running; running = e.isIntersecting;
    if (running && !was) requestAnimationFrame(frame);
  });
  resize(); update();
  io.observe(scene);
  window.addEventListener('resize', resize);
})();
