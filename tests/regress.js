/* OKTO gerileme testleri: her yayından önce çalıştır →  node tests/regress.js
   (Playwright gerekir; sunucuyu kendisi açar. Ekran görüntüleri tests/out/ klasörüne düşer, git'e girmez.)
   Kontrol edilenler:
   1. Açılış ve oyun: konsolda hata yok, HUD öğeleri yerinde
   2. Klasik düzen (s21) bölüm tablosu değişmemiş
   3. Üç mevcut canavar: giriş → savaş → yenilme → bölüm kartı → girdap → sonraki bölüm
   4. Resif kuralı: ekranda en fazla 3 çarpışılabilir kaya, koridor açık
   5. Yeni altyapı (?plan=grup): grup verisi, mini canavar aşaması, sinematik giriş, büyük canavar aşamaları, büyük zafer
   6. Test adresi hiçbir şey kaydetmiyor; beceri halkası (?beceri): dokun/basılı tut/sürükle/bekleme süresi */
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(__dirname, 'out');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) { passes++; console.log('  ✓ ' + msg); } else { fails++; console.log('  ✗ ' + msg); } };

function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      let f = decodeURIComponent(q.url.split('?')[0]); if (f.endsWith('/')) f += 'index.html';
      const fp = path.join(ROOT, f);
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': TYPES[path.extname(fp)] || 'application/octet-stream' }); fs.createReadStream(fp).pipe(r);
    }).listen(0, () => res(srv));
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(), base = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();
  async function open(q = '', manual = true, profile = null) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript(([m, prof]) => {
      let seed = 777; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      if (m) window.requestAnimationFrame = () => 0; // döngüyü test elle sürer (kararlı sonuç)
      if (prof && !sessionStorage.getItem('okto_test_seeded')) { localStorage.setItem('okto_profile', JSON.stringify(prof)); sessionStorage.setItem('okto_test_seeded', '1'); } // eski kayıtlı oyuncu (yalnızca ilk açılışta)
    }, [manual, profile]);
    const page = await ctx.newPage(), errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
    await page.goto(base + q); await page.waitForTimeout(400);
    return { page, errors, close: () => ctx.close() };
  }
  // oyunu t saniye ilerletir; Okto ölmez, canavara her 'hitEvery' saniyede bir vurulur
  const run = (page, sec, hitEvery = 0, stopAt = null) => page.evaluate(([sec, hitEvery, stopAt]) => {
    const O = window.__okto; let t = 0, next = hitEvery, seen = { phases: [], states: [] };
    for (let i = 0; i < sec * 60; i++) {
      if (O.state === 'play') { O.lives = 3; O.invuln = 5; }
      O.target.x = 195 + Math.sin(t * 0.7) * 110; O.target.y = 300 + Math.sin(t * 1.1) * 120;
      O.step(1 / 60); t += 1 / 60;
      const B = O.boss;
      if (B && B.ph && !seen.phases.includes(B.ph.name)) seen.phases.push(B.ph.name);
      if (seen.states.at(-1) !== O.state) seen.states.push(O.state);
      if (hitEvery && B && B.phase === 'fight' && t > next) { O.damageBoss(1); next = t + hitEvery; }
      if (stopAt && O.state === stopAt) break;
    }
    return seen;
  }, [sec, hitEvery, stopAt]);

  // 1) açılış ve oyun (gerçek döngüyle)
  console.log('1. Açılış ve oyun');
  {
    const { page, errors, close } = await open('', false);
    ok(await page.isVisible('#menu'), 'menü açık');
    const ver = await page.textContent('#ver'); ok(/^s\d+$/.test(ver.trim()), `sürüm etiketi: ${ver.trim()}`);
    await page.evaluate(() => window.__okto.startGame(1)); await page.waitForTimeout(2500);
    ok(await page.evaluate(() => window.__okto.state) === 'play', 'oyun başladı');
    ok(await page.isVisible('#inkBtn') && await page.isVisible('#pauseBtn') && await page.isVisible('#muteBtn'), 'mürekkep, duraklatma ve ses düğmeleri görünüyor');
    await page.screenshot({ path: path.join(OUT, '1-oyun.png') });
    ok(errors.length === 0, 'konsolda hata yok' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await close();
  }

  // 2) klasik bölüm tablosu
  console.log('2. Klasik bölüm düzeni (s21, ?plan=klasik)');
  {
    const { page, close } = await open('?plan=klasik');
    const L = await page.evaluate(() => [1, 2, 3, 4, 5, 6, 7].map(n => { const l = window.__okto.levelInfo(n); return [l.name, l.start, l.end, l.tier, l.boss].join('/'); }));
    const want = ['Güneşli Sular/0/150/1/puffer', 'Alacakaranlık Bölgesi/150/400/2/jelly', 'Karanlık Derinlikler/400/700/3/squid',
      'Sonsuz Derinlik 1/700/1000/3/puffer', 'Sonsuz Derinlik 2/1000/1300/3/jelly', 'Sonsuz Derinlik 3/1300/1600/3/squid', 'Sonsuz Derinlik 4/1600/1900/3/puffer'];
    ok(JSON.stringify(L) === JSON.stringify(want), 'bölüm adları, derinlikler ve canavarlar aynı');
    ok(await page.evaluate(() => OktoCampaign.mode) === 'klasik', 'test adresi ?plan=klasik: klasik düzen');
    await close();
  }

  // 3) üç canavar baştan sona
  console.log('3. Mevcut canavarlar');
  for (const [lv, kind, hp] of [[1, 'puffer', 3], [2, 'jelly', 4], [3, 'squid', 5]]) {
    const { page, errors, close } = await open('?plan=klasik');
    await page.evaluate(lv => window.__okto.startGame(lv), lv);
    await run(page, 300, 0, 'play'); // bölümün sonuna kadar dal
    const s1 = await page.evaluate(() => { const O = window.__okto; for (let i = 0; i < 60 * 300 && !O.boss; i++) { O.lives = 3; O.invuln = 5; O.step(1 / 60); } return O.boss && { kind: O.boss.kind, hp: O.boss.maxHp, big: O.boss.big }; });
    ok(s1 && s1.kind === kind && s1.hp === hp && !s1.big, `bölüm ${lv}: ${kind} çıktı (can ${s1 && s1.hp})`);
    const seen = await run(page, 120, 2.5, 'clear');
    ok(await page.evaluate(() => window.__okto.state) === 'clear', `bölüm ${lv}: canavar yenildi, bölüm kartı`);
    await page.evaluate(() => window.__okto.startTransition());
    await run(page, 4, 0);
    ok(await page.evaluate(() => [window.__okto.state, window.__okto.levelN].join()) === `play,${lv + 1}`, `bölüm ${lv}: girdaptan bölüm ${lv + 1}'e geçildi`);
    ok(!seen.phases.length, `bölüm ${lv}: aşama değişimi yok (s21 gibi)`);
    ok(errors.length === 0, `bölüm ${lv}: hata yok`);
    await close();
  }

  // 4) resif kuralı
  console.log('4. Resif kuralı');
  {
    const { page, close } = await open('?plan=klasik');
    await page.evaluate(() => window.__okto.startGame(2));
    const r = await page.evaluate(() => { const O = window.__okto; let maxR = 0, minGap = 1e9; for (let i = 0; i < 60 * 90 && O.state === 'play'; i++) { O.lives = 3; O.invuln = 5; O.step(1 / 60); if (i % 20 === 0) { maxR = Math.max(maxR, O.rockStats().onScreen); minGap = Math.min(minGap, O.corridorNow()); } } return { maxR, minGap, d: O.player.r * 2 }; });
    ok(r.maxR <= 3, `ekranda en fazla ${r.maxR} kaya`);
    ok(r.minGap > r.d, `en dar koridor ${Math.round(r.minGap)} px > Okto ${Math.round(r.d)} px`);
    await close();
  }

  // 5) yeni altyapı
  console.log('5. Bölüm grubu altyapısı (?plan=grup)');
  {
    const { page, errors, close } = await open('?plan=grup');
    const G = await page.evaluate(() => [1, 2, 3, 4, 5, 6].map(n => { const l = window.__okto.levelInfo(n); return { n, boss: l.boss, arena: l.arena, group: l.group, start: l.start, end: l.end }; }));
    ok(G.slice(0, 5).map(g => g.boss).join() === 'kestane,yengec,vatoz,deniz-ati,puffer-big' && G.slice(0, 4).every(g => !g.arena) && G[4].arena && G[4].end === 500 && G[5].group === 2 && G[5].start === 500, 'Güneşli Sular 5 bölüm: Kestane, Yengeç, Vatoz, Deniz Atı, 5. bölümde Dev Balon Balığı (0–500 m), sonra 2. grup');
    ok(await page.evaluate(() => { const C = OktoCampaign, out = []; for (let g = 0; g < 6; g++) for (let k = 1; k <= 5; k++) { const L = C.level(g * 5 + k), big = OktoBossAI.get(L.boss).size === 'big'; out.push(big === (k === 5)); } return out.every(Boolean); }), 'her grupta (tekrar turları dahil) 1–4. bölüm mini, 5. bölüm büyük canavar');
    ok(await page.evaluate(() => { const ids = new Set(); for (let n = 1; n <= 15; n++) { const L = OktoCampaign.level(n); if (!L.arena) ids.add(L.boss); } return ids.size === 12; }), '12 farklı mini canavar (ilk üç grup)');
    ok(await page.evaluate(() => { const ids = new Set(), big = new Set(); for (let n = 1; n <= 20; n++) { const L = OktoCampaign.level(n); (L.arena ? big : ids).add(L.boss); } return ids.size === 16 && big.size === 4 && OktoCampaign.level(16).groupName === 'Buzul Denizi' && OktoCampaign.level(20).boss === 'narval-big' && OktoCampaign.level(21).groupName === 'Güneşli Sular +1'; }), 's46: 4. grup Buzul Denizi (16–20): 16 mini ve 4 büyük canavar, ardından Güneşli Sular +1');
    ok(await page.evaluate(() => [1, 2, 3, 4, 7].map(n => OktoCampaign.migrate(n)).join()) === '1,6,11,16,16', 'eski klasik kayıt noktası taşınıyor (1→1, 2→6, 3→11, 4+→16)');
    ok(await page.evaluate(() => [1, 3, 4, 5, 8, 9, 12, 13].map(n => OktoCampaign.migrate44(n)).join()) === '1,3,4,6,9,11,14,16', 's44 kaydı aynı grup ve sıraya taşınıyor');
    ok(await page.evaluate(() => { const L = n => OktoCampaign.level(n); return L(1).zones[0] === 'reefs' && L(2).zones[0] === 'canyon' && L(3).zones[0] === 'akinti' && L(4).zones[0] === 'yosun' && L(6).env && L(5).intro && L(5).intro.title === 'DEV BALON BALIĞI' && L(10).intro && L(15).intro; }), 'her bölümün bölgeleri, su rengi ve sinematik yazısı tanımlı');
    // bölgeler karışık: her bölümde açık su arasında 2–3 farklı bölge; Yosun Ormanı ilk gruptan; derinlerde yeni bölgeler
    const Z = await page.evaluate(() => { const O = window.__okto, out = []; for (let n = 1; n <= 15; n++) { O.startGame(n); const t = O.plan.filter(p => p.type !== 'open'); out.push({ n, kinds: [...new Set(t.map(p => p.type))], segs: O.plan.map(p => p.type), first: t[0] && t[0].type }); } return out; });
    const zk = g => new Set(Z.slice(g * 5, g * 5 + 5).flatMap(z => z.kinds));
    ok(Z.every(z => z.kinds.length >= 2 && z.kinds.length <= 3), 'her bölümde 2–3 farklı bölge (' + Z.map(z => z.n + ':' + z.kinds.length).join(' ') + ')');
    ok(Z.every(z => z.segs[0] === 'open' && z.segs.every((t, i) => i === 0 || t === 'open' || z.segs[i - 1] === 'open')), 'bölgelerin arasında açık su (dinlenme) var');
    ok(Z.slice(0, 5).filter(z => z.kinds.includes('yosun')).length >= 2, `Yosun Ormanı ilk grupta (Güneşli Sular) görünüyor (${Z.slice(0, 5).filter(z => z.kinds.includes('yosun')).length} bölümde)`);
    ok(['baca', 'gemi', 'mayin'].every(k => !zk(0).has(k) && zk(1).has(k)) && ['magara', 'kacis'].every(k => !zk(0).has(k) && !zk(1).has(k) && zk(2).has(k)), 'derinlere indikçe bacalar, batık gemi, mayınlar; sonra mağara ve kaçış ekleniyor');
    const Z4 = await page.evaluate(() => { const O = window.__okto, out = []; for (let n = 16; n <= 20; n++) { O.startGame(n); out.push([...new Set(O.plan.filter(p => p.type !== 'open').map(p => p.type))]); } return out; });
    ok(Z4.every(k => k.length >= 2 && k.length <= 3) && ['sarkit', 'buzdag', 'kaygan', 'isik'].every(k => Z4.some(z => z.includes(k)) && !zk(0).has(k) && !zk(1).has(k) && !zk(2).has(k)), 'Buzul Denizi: her bölümde 2–3 bölge; buz sarkıtı, buzdağı, kaygan buz ve kuzey ışığı yalnızca bu grupta (' + Z4.map(z => z.join('+')).join(' · ') + ')');
    ok(await page.textContent('#ver').then(v => v.includes('TEST')), 'test etiketi görünüyor');
    // üç mini canavar sırayla: her biri saldırısını yapıyor ve yeniliyor
    await page.evaluate(() => window.__okto.startGame(1));
    let seen;
    for (const [n, kind, atk] of [[1, 'kestane', "O.entities.filter(e => e.type === 'spike').length > 8"], [2, 'yengec', "O.slams.some(s => s.kind === 'claw' && !s.warnOnly)"], [3, 'vatoz', 'O.boss.current'], [4, 'deniz-ati', "O.slams.some(s => s.kind === 'boomer')"]]) {
      await page.evaluate(n => { const O = window.__okto; O.depth = O.levelInfo(n).end - 1; }, n);
      const r = await page.evaluate(([atk]) => { const O = window.__okto, C = new Function('O', 'return ' + atk); let saw = false;
        for (let i = 0; i < 60 * 60 && O.state === 'play'; i++) { O.lives = 3; O.invuln = 5; O.step(1 / 60); if (O.boss && O.boss.phase === 'fight' && C(O)) { saw = true; break; } }
        return { saw, kind: O.boss && O.boss.kind }; }, [atk]);
      ok(r.saw && r.kind === kind, `${kind}: çıktı ve saldırısını yaptı`);
      seen = await run(page, 90, 2.2, 'clear');
      ok(await page.evaluate(() => window.__okto.state) === 'clear', `${kind}: yenildi`);
      if (n < 4) { await page.evaluate(() => window.__okto.startTransition()); await run(page, 4, 0); }
    }
    // 5. bölüm → sinematik → büyük canavar
    await page.evaluate(() => window.__okto.startTransition()); await run(page, 4, 0);
    ok(await page.evaluate(() => window.__okto.levelN) === 5, '5. bölüme (büyük canavar bölümü) geçildi');
    await page.evaluate(() => { const O = window.__okto; O.depth = O.levelInfo(5).end - 1; });
    seen = await run(page, 1, 0);
    ok(await page.evaluate(() => window.__okto.state) === 'cinema', 'sinematik giriş başladı');
    for (const [t, name] of [[0.8, 'a'], [2.2, 'b'], [3.6, 'c']]) { // sinematikten kareler
      await page.evaluate(t => { const O = window.__okto; while (O.cine && O.cine.t < t) O.step(1 / 60); O.draw(); }, t);
      await page.screenshot({ path: path.join(OUT, `5-sinematik-${name}.png`) });
    }
    await run(page, 3, 0);
    const bb = await page.evaluate(() => { const B = window.__okto.boss; return B && { kind: B.kind, big: B.big, hp: B.maxHp }; });
    ok(bb && bb.big && bb.kind === 'puffer-big', `büyük Dev Balon Balığı savaşı başladı (can ${bb && bb.hp})`);
    await page.evaluate(() => window.__okto.draw()); await page.screenshot({ path: path.join(OUT, '5-buyuk-canavar.png') });
    seen = await run(page, 120, 2.2, 'clear');
    ok(await page.evaluate(() => window.__okto.state) === 'clear', 'büyük canavar yenildi');
    ok((await page.textContent('#clTitle')).includes('Tamamlandı') && (await page.textContent('#clName')).includes('Kupa'), 'grup sonu kartı: kupa');
    await page.evaluate(() => window.__okto.startTransition()); await run(page, 4, 0);
    ok(await page.evaluate(() => [window.__okto.levelN, window.__okto.levelInfo(6).group].join()) === '6,2', '2. gruba geçildi');
    ok(await page.evaluate(() => localStorage.getItem('okto_profile')) === null, 'test adresinde hiçbir şey kaydedilmedi');
    ok(await page.evaluate(() => { const t = window.__okto.tlogText(); return t.includes('DİKENLİ KESTANE') && t.includes('DENİZ ATI') && t.includes('DEV BALON BALIĞI') && !t.includes('bitmedi'); }), 'test kaydı beş karşılaşmayı tuttu');
    ok(errors.length === 0, 'hata yok' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await close();
  }
  // 5a) 2. ve 3. grubun mini canavarları: her biri kendine özgü saldırısını yapıyor ve yenilebiliyor
  for (const [lv, id, cond] of [[6, 'baca-yengeci', "O.slams.some(s => s.kind === 'lava')"], [7, 'zirhli-balon', 'O.boss.roll'], [8, 'mayin-yengeci', "O.slams.some(s => s.kind === 'mine')"],
    [9, 'deniz-yildizi', "O.slams.some(s => s.kind === 'star' && s.st === 'go')"],
    [11, 'murekkepci', "O.slams.some(s => s.kind === 'dark')"], [12, 'hayalet-denizanasi', "O.slams.some(s => s.kind === 'ring')"], [13, 'iri-fener', 'O.boss.lureT > 0'],
    [14, 'kilic-baligi', "O.boss.zig && O.boss.zig.tele <= 0 && O.slams.some(s => s.kind === 'zigline')"],
    [16, 'mors', "O.slams.filter(s => s.kind === 'disk').length >= 2"], [17, 'penguen', "O.slams.filter(s => s.kind === 'peng' && s.t > s.warn).length >= 3"],
    [18, 'beluga', "O.slams.some(s => s.kind === 'song')"], [19, 'kristal', "O.slams.some(s => s.kind === 'arms' && s.t > s.warn)"]]) {
    const { page, errors, close } = await open(`?plan=grup&bolum=${lv}&boss=${id}`);
    const r = await page.evaluate(([cond]) => { const O = window.__okto, C = new Function('O', 'return ' + cond); O.startGame(); let saw = false, t = 0, nx = 0;
      for (let i = 0; i < 60 * 60 && !saw; i++) { O.lives = 3; O.invuln = 5; O.step(1 / 60); if (O.boss && O.boss.phase === 'fight' && C(O)) saw = true; }
      for (let i = 0; i < 60 * 120 && O.state === 'play'; i++) { O.lives = 3; O.invuln = 5; O.step(1 / 60); t += 1 / 60; if (O.boss && O.boss.phase === 'fight' && t > nx) { O.damageBoss(1); nx = t + 2; } }
      return { saw, state: O.state }; }, [cond]);
    ok(r.saw && r.state === 'clear' && errors.length === 0, `${id}: kendine özgü saldırı ve yenilme`);
    await close();
  }
  // 5c) büyük canavarlar: her biri 3 yeni saldırı (uyarılı) ve canın yarısında 2. aşama
  for (const [lv, id, kinds] of [[5, 'puffer-big', ['drop', 'hbub', 'wall']], [10, 'jelly-big', ['hzap', 'orb', 'zone']], [15, 'squid-big', ['tentacle', 'inkbomb', 'toptent']], [20, 'narval-big', ['horn', 'pike', 'blizzard']]]) {
    const { page, errors, close } = await open(`?plan=grup&bolum=${lv}`);
    const r = await page.evaluate((kinds) => { const O = window.__okto; O.startGame(); const seen = new Set(), warned = new Set(); let ph = null, t = 0, nx = 0;
      for (let i = 0; i < 60 * 240 && O.state !== 'clear'; i++) { O.lives = 3; O.invuln = 5; O.step(1 / 60); t += 1 / 60;
        for (const s of O.slams) { seen.add(s.kind); if (s.t < (s.warn || 0) || s.kind === 'hbub' || s.kind === 'inkbomb' || s.kind === 'blizzard') warned.add(s.kind); }
        if (O.boss && O.boss.ph) ph = O.boss.ph.name;
        if (seen.size >= 3 && O.boss && O.boss.phase === 'fight' && t > nx) { O.damageBoss(1); nx = t + 3; } }
      return { kinds: kinds.filter(k => seen.has(k)), warned: kinds.filter(k => warned.has(k)), ph, state: O.state }; }, kinds);
    ok(r.kinds.length === 3 && r.warned.length === 3, `${id}: 3 yeni saldırı, hepsi uyarılı (${r.kinds.join(', ')})`);
    ok(!!r.ph && r.state === 'clear' && errors.length === 0, `${id}: 2. aşamaya geçti ve yenildi`);
    await close();
  }
  // 5d) Alacakaranlık ve Karanlık Derinlikler baştan sona: 4 mini canavar → sinematik → büyük canavar → kupa kartı; test kaydı hepsini tutar
  for (const [first, group, names] of [[6, 'Alacakaranlık', ['BACA YENGECİ', 'ZIRHLI BALON BALIĞI', 'MAYIN YENGECİ', 'DEV DENİZ YILDIZI', 'ELEKTRİKLİ DENİZANASI']],
    [11, 'Karanlık Derinlikler', ['MAĞARA MÜREKKEPÇİSİ', 'HAYALET DENİZANASI', 'İRİ FENER BALIĞI', 'KILIÇ BALIĞI', 'DEV KALAMAR']],
    [16, 'Buzul Denizi', ['MORS', 'PENGUEN FİLOSU', 'BEYAZ BALİNA', 'KRİSTAL DENİZANASI', 'DEV NARVAL']]]) {
    const { page, errors, close } = await open(`?plan=grup&bolum=${first}`);
    const r = await page.evaluate(() => { const O = window.__okto; O.startGame(); const states = []; let cinema = false, t = 0, nx = 0, clears = 0;
      for (let i = 0; i < 60 * 1200 && clears < 5; i++) {
        if (O.state === 'play') { O.lives = 3; O.invuln = 5; }
        O.target.x = 195 + Math.sin(t * 0.7) * 110; O.target.y = 320 + Math.sin(t * 1.1) * 110; O.step(1 / 60); t += 1 / 60;
        if (O.state === 'cinema') cinema = true;
        if (O.boss && O.boss.phase === 'fight' && t > nx) { O.damageBoss(1); nx = t + 2.2; }
        if (O.state === 'clear') { clears++; states.push(document.getElementById('clTitle').textContent); if (clears < 5) O.startTransition(); for (let k = 0; k < 240 && O.state === 'transition'; k++) O.step(1 / 60); }
      }
      return { cinema, titles: states, log: O.tlogText(), card: document.getElementById('clName').textContent }; });
    ok(r.titles.length === 5 && r.titles[4].includes(group + ' Tamamlandı') && !r.titles.slice(0, 4).some(t => t.includes(group)) && r.card.includes('Kupa'), `${group}: 5 bölüm, son kart "${r.titles[4]}" ve kupa`);
    ok(r.cinema, `${group}: büyük canavardan önce sinematik giriş`);
    ok(names.every(n => r.log.includes(n)) && !r.log.includes('bitmedi'), `${group}: test kaydı 5 karşılaşmanın hepsini tutuyor`);
    ok(errors.length === 0, `${group}: hata yok` + (errors.length ? ': ' + errors.join(' / ') : ''));
    await close();
  }
  // 5e) 2. aşama ölçümü: canın yarısında başlar; saldırılar sıklaşır ve kalabalıklaşır (aynı saldırı 1. ve 2. aşamada karşılaştırılır)
  for (const [lv, id] of [[5, 'puffer-big'], [10, 'jelly-big'], [15, 'squid-big'], [20, 'narval-big']]) {
    const { page, close } = await open(`?plan=grup&bolum=${lv}`);
    const r = await page.evaluate(() => {
      const O = window.__okto; O.startGame();
      for (let i = 0; i < 60 * 60 && !(O.boss && O.boss.phase === 'fight'); i++) { O.lives = 3; O.invuln = 5; O.step(1 / 60); }
      const B = O.boss, measure = () => { // 3 saldırıyı izle: her saldırıda doğan saldırı parçası sayısı ve saldırılar arası süre
        const counts = {}, gaps = []; let lastFire = null, t = 0, prevSeq = B.seq, prev = new Set(O.slams);
        for (let i = 0; i < 60 * 40 && Object.keys(counts).length < 3; i++) { O.lives = 3; O.invuln = 5; O.step(1 / 60); t += 1 / 60;
          const fresh = O.slams.filter(x => !prev.has(x)); prev = new Set(O.slams);
          if (fresh.length) { const k = fresh[0].kind; if (!(k in counts) && B.seq !== prevSeq) { counts[k] = fresh.length + (k === 'tentacle' ? 0 : 0); if (lastFire != null) gaps.push(t - lastFire); lastFire = t; prevSeq = B.seq; } }
        }
        return { counts, gap: gaps.length ? gaps.reduce((a, b) => a + b) / gaps.length : 0 };
      };
      const p1 = measure(), hpBefore = B.hp, half = B.maxHp / 2;
      let phaseAt = null; while (B.hp > 0 && !B.ph) { B.stun = 0; B.phase = 'fight'; O.damageBoss(1); if (B.ph) phaseAt = B.hp; }
      B.stun = 0; B.seq = -1; B.attackT = 0.1;
      const p2 = measure();
      return { p1, p2, phaseAt, half, maxHp: B.maxHp };
    });
    const ks = Object.keys(r.p1.counts).filter(k => k in r.p2.counts), more = ks.filter(k => r.p2.counts[k] > r.p1.counts[k]);
    ok(r.phaseAt != null && r.phaseAt <= r.half && r.phaseAt > r.half - 1, `${id}: 2. aşama canın yarısında başladı (can ${r.phaseAt}/${r.maxHp})`);
    ok(more.length >= 2, `${id}: 2. aşamada saldırılar kalabalıklaştı (${ks.map(k => k + ' ' + r.p1.counts[k] + '→' + r.p2.counts[k]).join(', ')})`);
    ok(r.p2.gap > 0 && r.p2.gap < r.p1.gap, `${id}: 2. aşamada saldırılar sıklaştı (ortalama ${r.p1.gap.toFixed(1)} sn → ${r.p2.gap.toFixed(1)} sn)`);
    await close();
  }
  // 5b) büyük zafer ekranı ve dokunarak sinematiği geçme (gerçek döngüyle)
  {
    const { page, errors, close } = await open('?plan=grup&bolum=5&boss=ornek-buyuk', false);
    await page.evaluate(() => window.__okto.startGame()); await page.waitForTimeout(4000);
    ok(await page.evaluate(() => window.__okto.state) === 'cinema', 'gerçek döngüde sinematik');
    await page.waitForTimeout(800); await page.mouse.click(195, 500); await page.waitForTimeout(900);
    ok(await page.evaluate(() => window.__okto.state) === 'play', 'dokununca sinematik geçildi');
    await page.evaluate(() => { const O = window.__okto; O.boss.phase = 'fight'; O.boss.hp = 1; O.damageBoss(1); }); await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, '5-buyuk-zafer.png') });
    ok(await page.evaluate(() => !!window.__okto.victory), 'büyük zafer kutlaması');
    ok(errors.length === 0, 'hata yok' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await close();
  }

  // 6) beceri halkası denemesi (?beceri, gerçek döngü, fareyle)
  console.log('6. Beceri halkası (?beceri)');
  {
    { // açılma: başta yalnızca Mürekkep Yelpazesi; 1. bölüm sonunda İnci Atışı açılır
      const { page, errors, close } = await open('?beceri');
      ok(JSON.stringify(await page.evaluate(() => window.__okto.SK.state.equipped)) === '["inkFan"]', 'başta yalnızca Mürekkep Yelpazesi açık');
      await page.evaluate(() => { const O = window.__okto; O.startGame(1); O.depth = 148; });
      await page.evaluate(() => { const O = window.__okto; for (let i = 0; i < 1800 && !(O.boss && O.boss.phase === 'fight'); i++) { O.lives = 3; O.invuln = 5; O.step(1 / 60); } O.boss.hp = 1; O.damageBoss(1); });
      await run(page, 10, 0, 'clear'); await page.waitForTimeout(600);
      ok((await page.textContent('#clUnlock')).includes('İnci Atışı') && await page.isVisible('#clSkills'), 'bölüm sonunda İnci Atışı açıldı, Becerileri Değiştir düğmesi var');
      ok(errors.length === 0, 'hata yok');
      await close();
    }
    const { page, errors, close } = await open('?beceri&xp=900', false);
    ok(await page.evaluate(() => window.__okto.SK.ringStyle) === 'inci', 'test adresinde yeni inci kabarcık halkası');
    ok(JSON.stringify(await page.evaluate(() => window.__okto.SK.state.equipped)) === '["inkFan","pearlShot","shieldArcs"]', '900 puanda üç beceri açık ve kuşanılı');
    await page.evaluate(() => window.__okto.startGame(1)); await page.waitForTimeout(2500);
    const bb = await page.locator('#inkBtn').boundingBox(), bx = bb.x + bb.width / 2, by = bb.y + bb.height / 2;
    const SKs = () => page.evaluate(() => { const K = window.__okto.SK; return { sel: K.selected, ring: K.ringOpen, fx: K.state.fx.map(f => f.kind).join(','), cd: K.state.cd }; });
    await page.mouse.move(bx, by); await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); await page.waitForTimeout(150);
    let k = await SKs(); ok(k.fx.startsWith('ink') && k.cd.inkFan > 0, 'kısa dokunuş: Mürekkep Yelpazesi çalıştı (4 bulut)');
    await page.mouse.down(); await page.waitForTimeout(350); k = await SKs(); ok(k.ring, 'basılı tutunca halka açıldı');
    await page.mouse.move(bx - 70, by, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(100);
    k = await SKs(); ok(!k.ring && k.sel === 'pearlShot', 'sola sürükleyip bırakınca İnci Atışı seçildi');
    await page.mouse.move(bx, by); await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); await page.waitForTimeout(100);
    k = await SKs(); ok(k.fx.includes('pearl'), 'İnci Atışı 4 inci fırlattı');
    await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); await page.waitForTimeout(100);
    ok((await SKs()).cd.pearlShot > 2.5, 'bekleme süresi dolmadan tekrar çalışmıyor');
    const x0 = await page.evaluate(() => window.__okto.player.x);
    await page.mouse.move(150, 400); await page.mouse.down(); await page.mouse.move(60, 400, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(400);
    ok(await page.evaluate(() => window.__okto.player.x) < x0 - 40, 'halka kapanınca normal yüzme çalışıyor');
    ok(await page.evaluate(() => localStorage.getItem('okto_profile')) === null, 'test adresinde kayıt yok');
    ok(errors.length === 0, 'hata yok' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await close();
  }

  // 7) normal oyunda beceriler (s27) ve kayıt kodu
  console.log('7. Normal oyunda beceriler ve kayıt kodu');
  {
    const { page, errors, close } = await open('', false);
    ok(await page.isVisible('#skillBtn'), 'menüde Beceriler düğmesi');
    ok(await page.evaluate(() => !!window.__okto.SK), 'beceri sistemi normal oyunda açık');
    ok(await page.evaluate(() => window.__okto.SK.ringStyle) === 'inci', 'normal oyunda yeni inci kabarcık halkası');
    await page.evaluate(() => { const P = window.__okto.Profile.data; P.wallet = 123; P.palette = 'galaxy'; });
    const code = await page.evaluate(() => { document.getElementById('helpBtn').click(); document.getElementById('saveCopy').click(); return document.getElementById('saveBox').value; });
    ok(code.startsWith('OKTO-'), 'kayıt kodu üretildi');
    await page.evaluate(() => { const P = window.__okto.Profile.data; P.wallet = 0; P.palette = 'pink'; });
    await page.evaluate(c => { const b = document.getElementById('saveBox'); b.value = c; document.getElementById('saveLoad').click(); }, code);
    ok(await page.evaluate(() => { const P = window.__okto.Profile.data; return P.wallet === 123 && P.palette === 'galaxy'; }), 'kayıt kodu geri yüklendi (inci ve renk)');
    await page.evaluate(() => document.getElementById('helpClose').click());
    await page.evaluate(() => window.__okto.startGame(1)); await page.waitForTimeout(1500);
    const bb = await page.locator('#inkBtn').boundingBox();
    await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(150);
    ok(await page.evaluate(() => window.__okto.SK.state.fx.some(f => f.kind === 'ink')), 'beceri düğmesi çalışıyor');
    ok(errors.length === 0, 'hata yok' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await close();
  }
  { // 12 becerinin her biri düşmanlı bir sahnede hatasız çalışıyor
    const { page, errors, close } = await open('?beceri&xp=20000');
    const r = await page.evaluate(() => {
      const O = window.__okto, K = O.SK, out = [];
      for (const d of K.DEFS) {
        O.startGame(1); for (let i = 0; i < 60; i++) { O.lives = 3; O.invuln = 5; O.step(1 / 60); }
        const P = O.player; O.entities.length = 0;
        [[0, -90], [0, 90], [-90, 0], [90, 0], [-70, -70]].forEach(([dx, dy], i) => O.entities.push({ type: ['jelly', 'urchin', 'puffer', 'angler', 'jelly'][i], x: P.x + dx, y: P.y + dy, r: 16, t: 0, hue: 300, base: 14, puff: 0 }));
        if (d.needBig) P.bigT = 5;
        K.state.equipped = [d.id]; K.state.sel = 0; K.state.cd = {};
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
        const fired = (K.state.cd[d.id] || 0) > 0;
        for (let i = 0; i < 40; i++) { O.lives = 3; O.invuln = 5; O.step(1 / 60); } // en kısa sersemletme 0,8 sn
        const hit = O.entities.filter(e => ['jelly', 'urchin', 'puffer', 'angler'].includes(e.type)).filter(e => !e.stunned).length < 5;
        out.push(d.id + ':' + (fired ? 'ateş' : 'YOK') + (hit || d.id === 'shieldArcs' || d.id === 'lanternPulse' ? '' : ':etkisiz'));
      }
      return out;
    });
    ok(r.every(x => x.endsWith('ateş')), '12 beceri ateşlendi ve düşmanlara etki etti' + (r.every(x => x.endsWith('ateş')) ? '' : ': ' + r.join(' ')));
    ok(errors.length === 0, 'hata yok' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await close();
  }
  {
    const { page, close } = await open('?halka=klasik');
    ok(await page.evaluate(() => window.__okto.SK.ringStyle) === 'klasik', 'test adresi ?halka=klasik: eski halka görünümü');
    await close();
  }
  {
    const { page, close } = await open('?murekkep', false);
    ok(await page.evaluate(() => !window.__okto.SK) && !(await page.isVisible('#skillBtn')), 'test adresi ?murekkep: eski mürekkep düğmesi');
    await close();
  }
  {
    const { page, close } = await open('?plan=klasik&murekkep', false);
    ok(await page.evaluate(() => !window.__okto.SK && OktoCampaign.mode === 'klasik' && window.__okto.levelInfo(1).boss === 'puffer'), 'test adresi ?plan=klasik&murekkep: eski s21 oyunu (klasik düzen + mürekkep düğmesi)');
    await close();
  }

  // 8) bölüm haritası (grup düzeni, test adresi)
  console.log('8. Bölüm haritası (?plan=grup)');
  {
    const { page, errors, close } = await open('?plan=grup&bolum=1');
    // üç grubun haritası kendi renginde, yazılar ekrandan taşmıyor
    const r0 = await page.evaluate(() => { const out = []; for (let g = 0; g < 6; g++) { /* 3 grup + güçlenmiş tekrar turu */ const cv = document.createElement('canvas'); cv.width = 390; cv.height = 844;
        OktoMap.draw(cv.getContext('2d'), { W: 390, H: 844, FONT: 'Fredoka', time: 1, top: 47, group: g, unlocked: 2, current: 2 });
        const px = cv.getContext('2d').getImageData(195, 830, 1, 1).data; out.push({ col: px.slice(0, 3).join(), over: OktoMap.layout.texts.filter(t => t.x0 < 0 || t.x1 > 390 || t.y1 > 844).map(t => t.text), islands: OktoMap.layout.islands.length, texts: OktoMap.layout.texts.map(t => t.text) }); }
      return out; });
    ok(new Set(r0.map(x => x.col)).size === 4, 'dört grubun haritası farklı renkte');
    ok(r0.every(x => x.over.length === 0), 'harita yazıları iPhone 13 ekranından taşmıyor');
    ok(r0.every(x => x.islands === 5), 'her haritada 4 mini canavar adası + büyük canavar adası');
    ok(r0[2].texts.includes('Buzul Denizi') && r0[3].texts.includes('Buzul Denizi') && r0[3].texts.includes('Dev Narval') && r0[3].texts.includes('Güneşli Sular +1') && r0[4].texts.includes('Güneşli Sular +1') && r0[5].texts.includes('Alacakaranlık +1') && r0[4].col === r0[0].col, 'Buzul Denizi haritası (sonra Güneşli Sular +1); tekrar turu aynı renkte, taşma yok');
    ok(r0[0].texts.includes('Güneşli Sular') && r0[0].texts.includes('0–500 m') && r0[0].texts.includes('Resif Adacıkları') && r0[0].texts.includes('Yosun Ormanı') && r0[0].texts.includes('Dev Balon Balığı') && r0[0].texts.includes('500 m') && r0[0].texts.includes('Alacakaranlık'), 'Güneşli Sular haritası: başlık, derinlik, adalar, büyük canavar ve sonraki grup');
    // bölüm sonu → harita → Okto yüzer → Dal! → girdap → sonraki bölüm
    await page.evaluate(() => { const O = window.__okto; O.startGame(); O.depth = O.levelInfo(1).end - 1;
      for (let i = 0; i < 60 * 40 && O.state === 'play'; i++) { O.lives = 3; O.invuln = 5; O.step(1 / 60); if (O.boss && O.boss.phase === 'fight') { O.boss.hp = 1; O.damageBoss(1); } } for (let i = 0; i < 300 && O.state !== 'clear'; i++) O.step(1 / 60); });
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById('clearNext').click());
    const m1 = await page.evaluate(() => { const O = window.__okto, M = O.mapV; return { state: O.state, mode: M && M.mode, from: M && M.swim.from, to: M && M.swim.to, go: !document.getElementById('mapGo').classList.contains('hidden') }; });
    ok(m1.state === 'map' && m1.mode === 'progress' && m1.from === 1 && m1.to === 2 && !m1.go, 'bölüm sonu kartından sonra harita açıldı, Okto 1. adadan 2. adaya yüzüyor');
    await page.evaluate(() => { const O = window.__okto; for (let i = 0; i < 120; i++) O.step(1 / 60); });
    ok(await page.evaluate(() => !document.getElementById('mapGo').classList.contains('hidden')), 'yüzme bitince Dal! düğmesi çıktı');
    await page.evaluate(() => { document.getElementById('mapGo').click(); const O = window.__okto; for (let i = 0; i < 60 * 4 && O.state !== 'play'; i++) O.step(1 / 60); });
    ok(await page.evaluate(() => [window.__okto.state, window.__okto.levelN].join()) === 'play,2', 'Dal! ile girdaptan 2. bölüme geçildi');
    // menüden harita: kilitli ada başlatmaz, açık ada başlatır
    await page.evaluate(() => { const O = window.__okto; document.getElementById('pauseBtn').click(); document.getElementById('quitBtn').click(); });
    ok(await page.isVisible('#mapBtn'), 'menüde Harita düğmesi (grup düzeninde)');
    await page.evaluate(() => { document.getElementById('mapBtn').click(); window.__okto.draw(); });
    const isl = await page.evaluate(() => OktoMap.layout.islands);
    const lockd = isl.find(i => i.locked), open1 = isl.find(i => i.n === 1);
    await page.evaluate(([x, y]) => window.__okto.mapTap(x, y), [lockd.x, lockd.y]);
    ok(await page.evaluate(() => window.__okto.state) === 'map', 'kilitli adaya dokununca bölüm başlamadı');
    await page.evaluate(([x, y]) => window.__okto.mapTap(x, y), [open1.x, open1.y]);
    ok(await page.evaluate(() => [window.__okto.state, window.__okto.levelN].join()) === 'play,1', 'açık adaya dokununca o bölüm başladı');
    ok(errors.length === 0, 'hata yok' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await close();
  }
  { // iPhone 13 (çentik payı 47) ekranında harita yazıları ekran içinde, çentiğin altında ve düğmelerle çakışmıyor
    const { page, close } = await open('?plan=grup&bolum=2');
    await page.addStyleTag({ content: '#safeProbe{height:47px!important}' }); await page.evaluate(() => { for (let i = 0; i < 40; i++) window.__okto.step(1 / 60); });
    await page.evaluate(() => { window.__okto.Profile.data.gcheck = 20; window.__okto.openMap('menu'); }); // dört grubun haritası açık
    const bad = [], seenG = [];
    for (let g = 0; g < 4; g++) {
      seenG.push(await page.evaluate(() => window.__okto.mapV.group));
      bad.push(...await page.evaluate(() => { const O = window.__okto; O.draw(); const T = OktoMap.layout.texts, st = O.safeTop, out = [];
        const btn = ['mapClose', 'mapPrev', 'mapNext', 'mapGo'].map(id => document.getElementById(id)).filter(e => !e.classList.contains('hidden')).map(e => e.getBoundingClientRect());
        for (const t of T) { if (t.x0 < 0 || t.x1 > innerWidth || t.y1 > innerHeight || t.y0 < st) out.push('ekran dışı ' + t.text); for (const r of btn) if (t.x0 < r.right && t.x1 > r.left && t.y0 < r.bottom && t.y1 > r.top) out.push('düğmeyle çakışma ' + t.text); }
        return out; }));
      await page.screenshot({ path: path.join(OUT, `8-harita-${g + 1}.png`) });
      await page.evaluate(() => document.getElementById('mapNext').click());
    }
    ok(seenG.join() === '0,1,2,3', 'dört grubun haritası sırayla açıldı (' + seenG.join() + ')');
    ok(bad.length === 0, 'iPhone 13 ekranında (çentikli) 4 haritanın yazıları taşmıyor ve düğmelerle çakışmıyor' + (bad.length ? ': ' + bad.join(', ') : ''));
    await close();
  }
  { // klasik düzende (?plan=klasik) harita yok, bölüm sonu doğrudan girdaba gider
    const { page, close } = await open('?plan=klasik');
    ok(!(await page.isVisible('#mapBtn')), 'klasik düzende Harita düğmesi yok');
    await page.evaluate(() => { const O = window.__okto; O.startGame(1); O.depth = 148;
      for (let i = 0; i < 60 * 40 && O.state === 'play'; i++) { O.lives = 3; O.invuln = 5; O.step(1 / 60); if (O.boss && O.boss.phase === 'fight') { O.boss.hp = 1; O.damageBoss(1); } } for (let i = 0; i < 300 && O.state !== 'clear'; i++) O.step(1 / 60); });
    await page.waitForTimeout(500); await page.evaluate(() => document.getElementById('clearNext').click());
    ok(await page.evaluate(() => window.__okto.state) === 'transition', 'klasik düzende bölüm sonu kartından doğrudan girdaba');
    await close();
  }

  // 9) s44: normal oyun (parametresiz) grup düzeniyle
  console.log('9. Normal oyun yeni düzende (parametresiz)');
  {
    const { page, errors, close } = await open('', false);
    const r = await page.evaluate(() => ({ mode: OktoCampaign.mode, ver: document.getElementById('ver').textContent, test: window.__okto.TEST.on, L: [1, 6, 11, 16, 21].map(n => { const l = window.__okto.levelInfo(n); return [l.groupName, l.boss].join('/'); }) }));
    ok(r.mode === 'grup', 'parametresiz oyun grup düzeninde');
    ok(!r.test && !/TEST/.test(r.ver), `sağ altta TEST yazmıyor (${r.ver.trim()})`);
    ok(r.L.join() === 'Güneşli Sular/kestane,Alacakaranlık/baca-yengeci,Karanlık Derinlikler/murekkepci,Buzul Denizi/mors,Güneşli Sular +1/kestane', 'dört grup sırayla, sonra güçlenerek tekrar (Güneşli Sular +1)');
    ok(await page.evaluate(() => window.__okto.levelInfo(21).power > window.__okto.levelInfo(1).power && window.__okto.levelInfo(25).boss === 'puffer-big'), 'tekrar turunda canavarlar daha güçlü, büyük canavar yine geliyor');
    ok(await page.isVisible('#mapBtn'), 'menüde Harita düğmesi');
    const help = await page.evaluate(() => document.querySelector('#help .card').textContent);
    ok(/bölüm gruplarından/.test(help) && /harita/i.test(help) && /mini canavar/.test(help) && /büyük canavar/.test(help), 'Nasıl oynanır metni grupları, haritayı, mini ve büyük canavarları anlatıyor');
    // yardım paneli iPhone 13'te taşmıyor (panel içinde kayar), menü yazıları ekran içinde
    await page.evaluate(() => document.getElementById('helpBtn').click()); await page.waitForTimeout(300);
    const hv = await page.evaluate(() => { const h = document.getElementById('help'), b = h.getBoundingClientRect(), ov = [...h.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).length; return { ov, w: b.width <= innerWidth + 1, sw: document.documentElement.scrollWidth <= innerWidth }; });
    await page.screenshot({ path: path.join(OUT, '9-yardim.png') });
    ok(hv.ov === 0 && hv.w && hv.sw, 'yardım paneli iPhone 13 ekranında yana taşmıyor');
    await page.evaluate(() => document.getElementById('helpClose').click());
    // bölüm sonu → harita (parametresiz) ve kayıt noktası yeni numaralarla
    await page.evaluate(() => { const O = window.__okto; window.requestAnimationFrame = () => 0; O.startGame(1); O.depth = O.levelInfo(1).end - 1;
      for (let i = 0; i < 60 * 40 && O.state === 'play'; i++) { O.lives = 3; O.invuln = 5; O.step(1 / 60); if (O.boss && O.boss.phase === 'fight') { O.boss.hp = 1; O.damageBoss(1); } } for (let i = 0; i < 300 && O.state !== 'clear'; i++) O.step(1 / 60); });
    await page.waitForTimeout(500); await page.evaluate(() => document.getElementById('clearNext').click());
    ok(await page.evaluate(() => window.__okto.state === 'map' && window.__okto.mapV.mode === 'progress'), 'parametresiz oyunda bölüm sonu kartından sonra harita açıldı');
    const D = await page.evaluate(() => { const D = window.__okto.Profile.data; return { gcheck: D.gcheck, gstart: D.gstart, ls: JSON.parse(localStorage.getItem('okto_profile')).gstart }; });
    ok(D.gcheck === 2 && D.gstart === 2 && D.ls === 2, 'kayıt noktası yeni bölüm numarasıyla kaydedildi (bölüm 2)');
    await page.evaluate(() => { const O = window.__okto; for (let i = 0; i < 120; i++) O.step(1 / 60); document.getElementById('mapGo').click(); for (let i = 0; i < 60 * 4 && O.state !== 'play'; i++) O.step(1 / 60); document.getElementById('pauseBtn').click(); document.getElementById('quitBtn').click(); });
    const lp = await page.evaluate(() => { const b = document.getElementById('levelPick'); const t1 = b.textContent; b.click(); const t2 = b.textContent; b.click(); return [t1, t2, b.textContent]; });
    ok(/Bölüm 2 · Mercan Kanyonu/.test(lp[0]) && /Bölüm 1 · Resif Adacıkları/.test(lp[1]) && /Bölüm 2/.test(lp[2]), `menüdeki bölüm seçimi yeni numaralarla (${lp[0].trim()} → ${lp[1].trim()})`);
    // menü yazıları iPhone 13 ekranında taşmıyor
    const mo = await page.evaluate(() => [...document.querySelectorAll('#menu *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && e.offsetParent && (r.right > innerWidth + 1 || r.left < -1); }).map(e => e.id || e.className));
    await page.screenshot({ path: path.join(OUT, '9-menu.png') });
    ok(mo.length === 0, 'menü öğeleri iPhone 13 ekranından taşmıyor' + (mo.length ? ': ' + mo.join(', ') : ''));
    const ov = await page.evaluate(() => { const R = id => { const e = document.getElementById(id); return e && !e.classList.contains('hidden') ? e.getBoundingClientRect() : null; };
      const lp = R('levelPick'), P = OktoTitle.playRect, out = [];
      for (const id of ['skillBtn', 'mapBtn', 'shopBtn', 'missionBtn', 'diffBtn', 'helpBtn']) { const r = R(id); if (r && lp && lp.left < r.right && lp.right > r.left && lp.top < r.bottom + 22 && lp.bottom > r.top) out.push(id); } // +22: düğme yazısı
      if (P && lp && lp.top < P.y + P.h && lp.bottom > P.y) out.push('oyna');
      return out; });
    ok(ov.length === 0, 'bölüm seçimi düğmesi diğer menü düğmeleriyle çakışmıyor' + (ov.length ? ': ' + ov.join(', ') : ''));
    ok(errors.length === 0, 'hata yok' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await close();
  }
  { // eski (klasik) kayıt bir kez taşınıyor; inci, kostüm, beceri ve Kaşif Puanı korunuyor
    const old = { wallet: 777, best: 900, checkpoint: 3, startLevel: 2, palette: 'galaxy', accessory: 'crown', owned: { colors: ['pink', 'galaxy'], accessories: ['goggles', 'none', 'crown'] }, skills: { xp: 1600, equipped: ['inkFan', 'pearlShot', 'tentacleSlam'], seen: 4 } };
    for (const [cp, sl, wantC, wantS] of [[1, 1, 1, 1], [2, 2, 6, 6], [3, 2, 11, 6], [3, 3, 11, 11], [4, 4, 16, 16], [7, 1, 16, 1]]) {
      const { page, close } = await open('', true, Object.assign({}, old, { checkpoint: cp, startLevel: sl }));
      const r = await page.evaluate(() => { const D = window.__okto.Profile.data; return [D.gcheck, D.gstart, D.gmigrated, window.__okto.levelN || 0]; });
      ok(r[0] === wantC && r[1] === wantS && r[2] === true, `eski kayıt: klasik bölüm ${cp} (başlangıç ${sl}) → yeni açık ${r[0]}, başlangıç ${r[1]}`);
      await close();
    }
    const { page, errors, close } = await open('', true, old);
    const a = await page.evaluate(() => { const O = window.__okto, D = O.Profile.data; return { D: JSON.parse(JSON.stringify(D)), start: O.startLevel ? O.startLevel() : null, menu: document.getElementById('levelPick').textContent, xp: O.SK.state ? null : null }; });
    ok(a.D.wallet === 777 && a.D.palette === 'galaxy' && a.D.accessory === 'crown' && a.D.owned.colors.includes('galaxy') && a.D.skills.xp === 1600 && a.D.skills.equipped.join() === 'inkFan,pearlShot,tentacleSlam' && a.D.best === 900, 'inci, kostüm, beceri ve Kaşif Puanı korundu');
    ok(a.D.checkpoint === 3 && a.D.startLevel === 2, 'klasik kayıt alanlarına dokunulmadı');
    ok(/Bölüm 6 · Sıcak Bacalar/.test(a.menu), `menü taşınan bölümden başlatıyor (${a.menu.trim()})`);
    // yalnızca bir kez: oyuncu yeni düzende ilerledikten sonra yeniden açılınca taşıma tekrar yapılmaz
    await page.evaluate(() => { const D = window.__okto.Profile.data; D.gcheck = 6; D.gstart = 6; window.__okto.Profile.save(); });
    await page.reload(); await page.waitForTimeout(400);
    const b = await page.evaluate(() => { const D = window.__okto.Profile.data; return [D.gcheck, D.gstart]; });
    ok(b.join() === '6,6', 'taşıma yalnızca bir kez yapıldı (yeniden açılınca yeni ilerleme korunuyor)');
    // kayıt kodu: eski (s43) kodu yüklenince taşınıyor; yeni kod yeni ilerlemeyi taşıyor
    const oldCode = 'OKTO-' + Buffer.from(JSON.stringify({ wallet: 55, best: 10, checkpoint: 2, startLevel: 2, palette: 'galaxy', skills: { xp: 400, equipped: ['inkFan'], seen: 2 } })).toString('base64');
    const c = await page.evaluate(code => { document.getElementById('helpBtn').click(); document.getElementById('saveLoad').click(); const b = document.getElementById('saveBox'); b.value = code; document.getElementById('saveLoad').click(); const D = window.__okto.Profile.data; return [D.wallet, D.gcheck, D.gstart, D.gmigrated, D.skills.xp].join(); }, oldCode);
    ok(c === '55,6,6,true,400', `eski kayıt kodu yüklenince yeni düzene taşındı (${c})`);
    const c2 = await page.evaluate(() => { const D = window.__okto.Profile.data; D.gcheck = 10; D.gstart = 9; document.getElementById('saveCopy').click(); const code = document.getElementById('saveBox').value; D.gcheck = 1; D.gstart = 1; const b = document.getElementById('saveBox'); b.value = code; document.getElementById('saveLoad').click(); return [D.gcheck, D.gstart].join(); });
    ok(c2 === '10,9', 'yeni kayıt kodu yeni düzendeki ilerlemeyi taşıyor (tekrar taşınmıyor)');
    ok(errors.length === 0, 'hata yok' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await close();
  }
  { // s44 kaydı (grup başına 4 bölüm) yeni numaralara: aynı grup, aynı ilerleme; kupalar korunur; yalnızca bir kez
    for (const [gc, gs, wc, ws] of [[1, 1, 1, 1], [4, 2, 4, 2], [5, 5, 6, 6], [8, 6, 9, 7], [9, 9, 11, 11], [12, 10, 14, 12], [13, 13, 16, 16]]) {
      const { page, close } = await open('', true, { wallet: 9, checkpoint: 3, startLevel: 3, gcheck: gc, gstart: gs, gmigrated: true, trophies: { 'puffer-big': 2 }, skills: { xp: 900, equipped: ['inkFan'], seen: 2 } });
      const r = await page.evaluate(() => { const D = window.__okto.Profile.data; return [D.gcheck, D.gstart, D.gver, D.trophies['puffer-big'], D.skills.xp, D.wallet]; });
      ok(r.join() === [wc, ws, 45, 2, 900, 9].join(), `s44 kaydı: açık ${gc}, başlangıç ${gs} → ${r[0]}, ${r[1]} (kupalar, beceri, inci korundu)`);
      await close();
    }
    const { page, close } = await open('', true, { wallet: 9, gcheck: 5, gstart: 5, gmigrated: true });
    await page.reload(); await page.waitForTimeout(400);
    ok(await page.evaluate(() => { const D = window.__okto.Profile.data; return [D.gcheck, D.gstart].join(); }) === '6,6', 's44 kaydı yeniden açılınca ikinci kez taşınmıyor');
    const code44 = 'OKTO-' + Buffer.from(JSON.stringify({ wallet: 70, gcheck: 9, gstart: 9, gmigrated: true, trophies: { 'jelly-big': 1 } })).toString('base64');
    const c = await page.evaluate(code => { document.getElementById('helpBtn').click(); document.getElementById('saveLoad').click(); const b = document.getElementById('saveBox'); b.value = code; document.getElementById('saveLoad').click(); const D = window.__okto.Profile.data; return [D.wallet, D.gcheck, D.gstart, D.gver, D.trophies['jelly-big']].join(); }, code44);
    ok(c === '70,11,11,45,1', `s44 kayıt kodu yüklenince yeni düzene taşındı (${c})`);
    await close();
  }
  { // büyük canavar yenilince haritada yeni grup açılıyor (parametresiz oyun)
    const { page, errors, close } = await open('', true, { wallet: 0, gcheck: 5, gstart: 5, gmigrated: true, gver: 45 });
    await page.evaluate(() => { const O = window.__okto; O.startGame(5); O.depth = O.levelInfo(5).end - 1;
      for (let i = 0; i < 60 * 120 && O.state !== 'clear'; i++) { if (O.state === 'play') { O.lives = 3; O.invuln = 5; } O.step(1 / 60); if (O.boss && O.boss.phase === 'fight') { O.boss.hp = 1; O.damageBoss(1); } } });
    ok(await page.evaluate(() => window.__okto.state) === 'clear' && (await page.textContent('#clName')).includes('Kupa'), 'Dev Balon Balığı yenildi: kupa kartı');
    await page.evaluate(() => document.getElementById('clearNext').click());
    const m = await page.evaluate(() => { const O = window.__okto, M = O.mapV; O.draw(); return { st: O.state, g: M.group, fresh: M.fresh > 0, texts: OktoMap.layout.texts.map(t => t.text), unlocked: M.unlocked, isl: OktoMap.layout.islands.filter(i => !i.locked).map(i => i.n) }; });
    ok(m.st === 'map' && m.g === 1 && m.fresh && m.texts.includes('Alacakaranlık') && m.texts.includes('Yeni bölge açıldı!') && m.isl.join() === '6', 'haritada yeni grup (Alacakaranlık) açıldı, ilk adası açık');
    await page.evaluate(() => { const O = window.__okto; for (let i = 0; i < 60 * 4; i++) O.step(1 / 60); O.draw(); });
    await page.screenshot({ path: path.join(OUT, '9-yeni-grup.png') });
    await page.evaluate(() => { const O = window.__okto; document.getElementById('mapGo').click(); for (let i = 0; i < 60 * 4 && O.state !== 'play'; i++) O.step(1 / 60); });
    ok(await page.evaluate(() => [window.__okto.state, window.__okto.levelN, window.__okto.Profile.data.gcheck].join()) === 'play,6,6', 'Dal! ile Alacakaranlık 1. bölüm başladı, kayıt noktası 6');
    ok(errors.length === 0, 'hata yok' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await close();
  }

  await browser.close(); srv.close();
  console.log(`\n${passes} geçti, ${fails} kaldı`);
  process.exit(fails ? 1 : 0);
})();
