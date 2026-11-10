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

// Ürün sahneleri: geniş kadrajda usta tezgaha un serper; kaydırdıkça kamera
// tezgah boyunca pakete yaklaşır, arka plan flulaşır.
// Ventus ana sayfada; diğer unlar ürün vitrinindeki "Sahneyi izle" ile tam ekran açılır.
const IMG = 'assets/img/urunler/';
const img = (f) => (window.IMG_DATA && window.IMG_DATA[f]) || IMG + f; // önizleme için gömülü görseller
const WA = 'https://wa.me/905302220090?text=';
// pack: [dosya genişliği, sol boşluk, paket genişliği]; paketin kendi yüksekliği her dosyada 704 px
const SCENES = {
  ventus: {
    name: 'Ventus Pizzalık Un', bg: 'sef-sahne.jpg', pack: 'ventus', packDim: [593, 78, 436],
    base: { x: 1300, y: 752, h: 310 }, pinch: [[556, 312], [572, 318], [586, 322], [544, 306]],
    floor: 690, lightX: 420, startX: 560,
    caps: [
      ['VENTUS PİZZALIK UN · ÖZMERMER', 'Her pizza, bir avuç<br>unla başlar.'],
      ['PROTEİN EN AZ %13 · KÜL EN ÇOK %0,57', 'Kuvvetli ve dirençli<br>bir hamur.'],
      ['VENTUS PİZZALIK UN', 'Kolay açılır, yırtılmaz.<br>Fırında kabarmaz.']
    ]
  },
  antebin: {
    name: 'Antebin Baklavalık Un', bg: 'sahne-antebin.jpg', pack: 'antebin', packDim: [598, 79, 440],
    base: { x: 1330, y: 765, h: 290 }, pinch: [[350, 380], [365, 388], [378, 394]],
    floor: 600, lightX: 380, startX: 420, rate: 18,
    caps: [
      ['ANTEBİN BAKLAVALIK UN · ÖZMERMER', 'Baklava, yufkanın<br>inceliğinde saklı.'],
      ['PROTEİN EN AZ %12 · KÜL EN ÇOK %0,65', 'Açımda kurumaz,<br>yapışmaz.'],
      ['ANTEBİN BAKLAVALIK UN', 'Şerbetini çeker,<br>hışır kalır.']
    ]
  },
  albina: {
    name: 'Albina Pastalık-Böreklik Un', bg: 'sahne-albina.jpg', pack: 'albina', packDim: [589, 78, 433],
    base: { x: 1300, y: 800, h: 290 }, pinch: [[505, 268], [530, 274], [555, 276], [580, 274], [605, 268]],
    floor: 610, lightX: 620, startX: 520, rate: 30,
    caps: [
      ['ALBİNA PASTALIK-BÖREKLİK UN · ÖZMERMER', 'Pastanenin sabahı<br>unla başlar.'],
      ['PROTEİN EN AZ %12 · KÜL EN ÇOK %0,55', 'Hamur güzel kabarır,<br>iyi hacim alır.'],
      ['ALBİNA PASTALIK-BÖREKLİK UN', 'Pasta, poğaça, simit.<br>Parlak ve canlı.']
    ]
  },
  dededen: {
    name: 'Özmermer Dededen Pidelik Un', bg: 'sahne-dededen.jpg', pack: 'dededen', packDim: [599, 79, 440],
    base: { x: 1330, y: 800, h: 300 }, pinch: [[520, 470], [570, 485], [610, 500], [640, 515]],
    floor: 640, lightX: 620, startX: 520, rate: 12,
    caps: [
      ['DEDEDEN PİDELİK UN · ÖZMERMER', 'Tırnak pidesi,<br>ustanın imzasıdır.'],
      ['PROTEİN EN AZ %11 · KÜL EN ÇOK %0,55', 'Yoğururken çabuk<br>kıvama gelir.'],
      ['DEDEDEN PİDELİK UN', 'Pideye istenen tabanı<br>ve rengi verir.']
    ]
  },
  pideci: {
    name: 'Özmermer Pideci Un', bg: 'sahne-pideci.jpg', pack: 'pideci', packDim: [602, 79, 443],
    base: { x: 1310, y: 770, h: 290 }, pinch: [[620, 420], [650, 428], [680, 436]],
    floor: 600, lightX: 700, startX: 560, rate: 9,
    caps: [
      ['PİDECİ UN · ÖZMERMER', 'Pide, fırının<br>ağzında pişer.'],
      ['PROTEİN EN AZ %11 · KÜL EN ÇOK %0,68', 'Çabuk ve kolay<br>kıvama gelir.'],
      ['PİDECİ UN', 'Pideden lahmacuna,<br>çok yönlü bir un.']
    ]
  },
  'luks-francalik': {
    name: 'Lüks Francalık Un', bg: 'sahne-luks-francalik.jpg', pack: 'luks-francalik', packDim: [601, 79, 442],
    base: { x: 1330, y: 800, h: 300 }, pinch: [[600, 520], [630, 535], [655, 550]],
    floor: 690, lightX: 680, startX: 560, rate: 10,
    caps: [
      ['LÜKS FRANCALIK UN · ÖZMERMER', 'Ekmek, fırının<br>ateşinde olgunlaşır.'],
      ['PROTEİN EN AZ %11 · KÜL %0,7–0,8', 'Katkıya ve geliştiriciye<br>ihtiyaç duymaz.'],
      ['LÜKS FRANCALIK UN', 'Mikserde dayanıklı,<br>bekleme süresi uzun.']
    ]
  },
  'tam-bugday': {
    name: 'Tam Buğday Unu', bg: 'sahne-tam-bugday.jpg', pack: 'tam-bugday', packDim: [576, 76, 424],
    base: { x: 1320, y: 785, h: 300 }, pinch: [[680, 388], [692, 395], [705, 400], [718, 403]],
    floor: 610, lightX: 620, startX: 640,
    caps: [
      ['TAM BUĞDAY UNU · ÖZMERMER', 'Buğdayın tamamı,<br>ekmeğin özü.'],
      ['PROTEİN EN AZ %11 · KÜL EN ÇOK %1,2', 'Rafine edilmeden<br>üretilir.'],
      ['TAM BUĞDAY UNU', 'Lif, vitamin ve mineral<br>bakımından zengin.']
    ]
  }
};

function chefScene(root, cfg, getProgress) {
  const view = root.querySelector('.chef-view');
  const world = root.querySelector('.chef-world');
  const bg = root.querySelector('.chef-bg');
  const canvas = root.querySelector('.chef-flour');
  const pack = root.querySelector('.chef-pack');
  const ctx = canvas.getContext('2d');
  const caps = root.querySelectorAll('.art-cap');
  const grain = root.querySelector('.art-grain');

  const IW = 1680, IH = 944;
  const [pw, pad, pin] = cfg.packDim;
  const k = cfg.base.h / 704;
  const PACK = { x: cfg.base.x, y: cfg.base.y - cfg.base.h * 0.48, h: cfg.base.h };
  pack.style.left = (cfg.base.x - (pad + pin / 2) * k) + 'px';
  pack.style.top = (cfg.base.y - 704 * k) + 'px';
  pack.style.width = (pw * k) + 'px';

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (t) => t * t * (3 - 2 * t);
  const range = (p, a, b) => smooth(clamp((p - a) / (b - a), 0, 1));
  const lerp = (a, b, t) => a + (b - a) * t;
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const lightAt = (x) => clamp(1.2 - (x - cfg.lightX) / 420, 0.3, 1);

  (function () { // film greni
    const g = document.createElement('canvas'); g.width = g.height = 140;
    const gc = g.getContext('2d'); const im = gc.createImageData(140, 140);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
    }
    gc.putImageData(im, 0, 0);
    grain.style.backgroundImage = 'url(' + g.toDataURL() + ')';
  })();

  const haze = document.createElement('canvas'); haze.width = haze.height = 64;
  (function () {
    const hc = haze.getContext('2d');
    const g = hc.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,232,200,1)'); g.addColorStop(1, 'rgba(255,232,200,0)');
    hc.fillStyle = g; hc.fillRect(0, 0, 64, 64);
  })();

  let VW = 0, VH = 0, narrow = false;
  function measure() { VW = view.clientWidth; VH = view.clientHeight; narrow = VW < 820; }

  function camera(t) {
    const s0 = Math.max(VW / IW, VH / IH);
    const z1 = narrow ? 1.6 : 0.62 * VH / (PACK.h * s0);
    const S = s0 * Math.exp(lerp(0, Math.log(Math.max(z1, 1)), t));
    const fx = lerp(narrow ? cfg.startX : IW / 2, PACK.x, t);
    const fy = lerp(IH / 2, PACK.y, t);
    const ax = lerp(VW / 2, VW * (narrow ? 0.5 : 0.68), t);
    const ay = lerp(VH / 2, VH * (narrow ? 0.3 : 0.46), t);
    let tx = ax - fx * S, ty = ay - fy * S;
    tx = clamp(tx, VW - IW * S, 0); ty = clamp(ty, VH - IH * S, 0);
    world.style.transform = 'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0) scale(' + S.toFixed(4) + ')';
    const blur = 7 * smooth(clamp((t - 0.15) / 0.85, 0, 1));
    bg.style.filter = blur > 0.05 ? 'blur(' + (blur / S).toFixed(2) + 'px) brightness(' + (1 - t * 0.18).toFixed(3) + ')' : '';
  }

  // ustanın parmaklarından dökülen un: ince akış + havada asılı toz bulutu
  let dust = [], clouds = [], clock = 0;
  const top = Math.min(...cfg.pinch.map((q) => q[1]));
  const cx = cfg.pinch.reduce((a, q) => a + q[0], 0) / cfg.pinch.length;
  function flour(dt, rate) {
    clock += dt;
    const f60 = dt * 60;
    const n = Math.round(rate * f60);
    for (let i = 0; i < n; i++) {
      const o = cfg.pinch[(Math.random() * cfg.pinch.length) | 0];
      dust.push({
        x: o[0] + gauss() * 16, y: o[1] + gauss() * 8 + Math.random() * 14,
        vx: gauss() * 0.4 - 0.16, vy: 0.1 + Math.random() * 0.4,
        s: 0.3 + Math.pow(Math.random(), 2.2), a: 0.12 + Math.random() * 0.4,
        term: 0.9 + Math.random() * 1.4, ph: Math.random() * 6.28
      });
    }
    if (Math.random() < 0.06 * f60 * Math.min(1, rate / 30)) {
      clouds.push({ x: cx - 90 + Math.random() * 200, y: top + 70 + Math.random() * (cfg.floor - top - 90), r: 22 + Math.random() * 46,
        vx: (Math.random() - 0.4) * 0.12, vy: 0.05 + Math.random() * 0.1, life: 0, max: 4 + Math.random() * 4 });
    }
    ctx.clearRect(0, 0, IW, IH);
    ctx.globalCompositeOperation = 'lighter';
    const keepC = [];
    for (const c of clouds) {
      c.life += dt; c.x += c.vx * f60; c.y += c.vy * f60; c.r += 0.04 * f60;
      if (c.life > c.max) continue;
      ctx.globalAlpha = 0.05 * Math.sin(Math.PI * c.life / c.max) * lightAt(c.x);
      ctx.drawImage(haze, c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
      keepC.push(c);
    }
    clouds = keepC;
    ctx.lineCap = 'round'; ctx.strokeStyle = '#F7DDB6';
    const span = Math.max(120, cfg.floor - top);
    const keep = [];
    for (const q of dust) {
      const turb = Math.sin(q.y * 0.021 + clock * 0.9 + q.ph) * 0.022 + Math.sin(q.y * 0.009 - clock * 0.5 + q.ph * 2) * 0.014;
      const fallen = clamp((q.y - top) / span, 0, 1);
      q.vx = (q.vx + turb * (0.6 + 1.6 * fallen) * f60 + gauss() * 0.02 * f60) * Math.pow(0.99, f60);
      q.vy = Math.min(q.vy + 0.012 * f60, q.term);
      q.x += q.vx * f60; q.y += q.vy * f60;
      if (q.y > cfg.floor - q.ph * 3) continue;
      const al = q.a * (1 - fallen * 0.55) * clamp((q.y - top + 12) / 25, 0, 1) * lightAt(q.x);
      if (al >= 0.01) {
        ctx.globalAlpha = al; ctx.lineWidth = q.s;
        ctx.beginPath(); ctx.moveTo(q.x - q.vx * 2.2, q.y - q.vy * 2.2); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
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
    if (!running) { last = 0; return; }
    const dt = Math.min(0.05, last ? (ms - last) / 1000 : 0.016); last = ms;
    const p = getProgress();
    const t = range(p, 0.1, 0.82);
    camera(t); setCaption(p); flour(dt, (cfg.rate || 24) * (1 - t * 0.6));
    requestAnimationFrame(frame);
  }
  measure(); camera(0);
  return {
    start() { if (!running) { running = true; requestAnimationFrame(frame); } },
    stop() { running = false; },
    resize() { measure(); camera(range(getProgress(), 0.1, 0.82)); },
    still() { measure(); camera(1); setCaption(1); }
  };
}

function sceneMarkup(key, cfg) {
  const caps = cfg.caps.map((c, i) =>
    '<div class="art-cap' + (i === 0 ? ' is-active' : '') + '"><p class="art-kicker">' + c[0] + '</p><p class="art-line">' + c[1] + '</p>' +
    (i === 0 ? '<p class="art-hint">Kaydırın</p>' : '') +
    (i === 2 ? '<a class="art-cta" href="' + WA + encodeURIComponent('Merhaba, ' + cfg.name + ' için fiyat almak istiyorum.') + '">Fiyat sorun</a>' : '') +
    '</div>').join('');
  return '<section class="art" aria-label="' + cfg.name + '"><div class="art-sticky"><div class="chef-view"><div class="chef-world">' +
    '<img class="chef-bg" src="' + img(cfg.bg) + '" width="1680" height="944" alt="">' +
    '<canvas class="chef-flour" width="1680" height="944" aria-hidden="true"></canvas>' +
    '<img class="chef-pack" src="' + img(cfg.pack + '-1kg-sahne.png') + '" alt="' + cfg.name + ' 1 kg paketi">' +
    '</div><div class="art-grain" aria-hidden="true"></div><div class="chef-shade" aria-hidden="true"></div></div>' +
    '<div class="container art-captions">' + caps + '</div></div></section>';
}

(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ana sayfadaki Ventus sahnesi
  const home = document.getElementById('ventus-sahne');
  if (home) {
    const view = home.querySelector('.chef-view');
    const sc = chefScene(home, SCENES.ventus, () => {
      const r = home.getBoundingClientRect();
      return Math.min(1, Math.max(0, -r.top / ((r.height - view.clientHeight) || 1)));
    });
    if (reduce) { sc.still(); window.addEventListener('resize', sc.still); }
    else {
      new IntersectionObserver(([e]) => (e.isIntersecting ? sc.start() : sc.stop())).observe(home);
      window.addEventListener('resize', sc.resize);
    }
  }

  // tam ekran sahne penceresi
  const modal = document.getElementById('sahne-penceresi');
  if (!modal) return;
  const scroller = modal.querySelector('.scene-scroll');
  const closeBtn = modal.querySelector('.scene-close');
  let current = null, opener = null;

  function open(key, btn) {
    const cfg = SCENES[key]; if (!cfg || !cfg.bg) return;
    opener = btn;
    scroller.innerHTML = sceneMarkup(key, cfg);
    modal.hidden = false; document.body.classList.add('scene-lock');
    scroller.scrollTop = 0; // pencere görünür olduktan sonra başa sar
    current = chefScene(scroller, cfg, () => Math.min(1, Math.max(0, scroller.scrollTop / ((scroller.scrollHeight - scroller.clientHeight) || 1))));
    if (reduce) current.still(); else current.start();
    closeBtn.focus();
  }
  function close() {
    if (current) current.stop();
    current = null; modal.hidden = true; scroller.innerHTML = '';
    document.body.classList.remove('scene-lock');
    if (opener) opener.focus();
  }
  document.querySelectorAll('.scene-open').forEach((b) => {
    const cfg = SCENES[b.dataset.scene];
    if (cfg && cfg.bg) b.hidden = false; // görseli hazır olan sahnelerin düğmesi görünür
    b.addEventListener('click', () => open(b.dataset.scene, b));
  });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });
  window.addEventListener('resize', () => current && current.resize());
})();

// Sayfa içi bağlantılar (logo, menü, kutucuklar): kaydırarak değil, doğrudan hedefe atlar.
// Atlama sırasında Ventus sahnesi gizlenir; sahne yalnızca fare/klavye/parmakla kaydırınca oynar.
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    const root = document.documentElement;
    root.classList.add('jumping');
    root.style.scrollBehavior = 'auto';
    const top = id === 'ust' ? 0 : Math.round(target.getBoundingClientRect().top + window.scrollY - 80);
    window.scrollTo(0, top);
    history.replaceState(null, '', '#' + id);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.style.scrollBehavior = '';
      root.classList.remove('jumping');
    }));
  });
});
