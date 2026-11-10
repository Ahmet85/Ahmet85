/* OKTO gerileme testleri: her yayından önce çalıştır →  node tests/regress.js
   (Playwright gerekir; sunucuyu kendisi açar. Ekran görüntüleri tests/out/ klasörüne düşer, git'e girmez.)
   Kontrol edilenler:
   1. Açılış ve oyun: konsolda hata yok, HUD öğeleri yerinde
   2. Klasik düzen (s21) bölüm tablosu değişmemiş
   3. Üç mevcut canavar: giriş → savaş → yenilme → bölüm kartı → girdap → sonraki bölüm
   4. Resif kuralı: ekranda en fazla 3 çarpışılabilir kaya, koridor açık
   5. Yeni altyapı (?plan=grup): grup verisi, mini canavar aşaması, sinematik giriş, büyük canavar aşamaları, büyük zafer
   6. Test adresi hiçbir şey kaydetmiyor */
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
  async function open(q = '', manual = true) {
    const ctx = await browser.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript(m => {
      let seed = 777; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      if (m) window.requestAnimationFrame = () => 0; // döngüyü test elle sürer (kararlı sonuç)
    }, manual);
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
  console.log('2. Klasik bölüm düzeni (s21)');
  {
    const { page, close } = await open();
    const L = await page.evaluate(() => [1, 2, 3, 4, 5, 6, 7].map(n => { const l = window.__okto.levelInfo(n); return [l.name, l.start, l.end, l.tier, l.boss].join('/'); }));
    const want = ['Güneşli Sular/0/150/1/puffer', 'Alacakaranlık Bölgesi/150/400/2/jelly', 'Karanlık Derinlikler/400/700/3/squid',
      'Sonsuz Derinlik 1/700/1000/3/puffer', 'Sonsuz Derinlik 2/1000/1300/3/jelly', 'Sonsuz Derinlik 3/1300/1600/3/squid', 'Sonsuz Derinlik 4/1600/1900/3/puffer'];
    ok(JSON.stringify(L) === JSON.stringify(want), 'bölüm adları, derinlikler ve canavarlar aynı');
    ok(await page.evaluate(() => OktoCampaign.mode) === 'klasik', 'varsayılan düzen klasik');
    await close();
  }

  // 3) üç canavar baştan sona
  console.log('3. Mevcut canavarlar');
  for (const [lv, kind, hp] of [[1, 'puffer', 3], [2, 'jelly', 4], [3, 'squid', 5]]) {
    const { page, errors, close } = await open();
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
    const { page, close } = await open();
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
    const G = await page.evaluate(() => [1, 2, 3, 4, 5].map(n => { const l = window.__okto.levelInfo(n); return { n, boss: l.boss, arena: l.arena, group: l.group, start: l.start, end: l.end }; }));
    ok(G[3].arena && G[3].boss === 'ornek-buyuk' && G[4].group === 2 && G[4].start === G[3].end, 'grup: 3 bölüm + arena, sonra 2. grup');
    ok(await page.textContent('#ver').then(v => v.includes('TEST')), 'test etiketi görünüyor');
    // mini canavar aşaması
    await page.evaluate(() => window.__okto.startGame(3));
    await page.evaluate(() => { const O = window.__okto; O.depth = O.levelInfo(3).end - 1; });
    let seen = await run(page, 60, 2.2, 'clear');
    ok(seen.phases.includes('Hızlandı!'), 'mini canavar canı yarıya inince aşama değiştirdi');
    ok(await page.evaluate(() => window.__okto.state) === 'clear', 'mini canavar yenildi');
    // arena → sinematik → büyük canavar
    await page.evaluate(() => window.__okto.startTransition()); await run(page, 4, 0);
    ok(await page.evaluate(() => window.__okto.levelN) === 4, 'arena bölümüne geçildi');
    await page.evaluate(() => { const O = window.__okto; O.depth = O.levelInfo(4).end - 1; });
    seen = await run(page, 1, 0);
    ok(await page.evaluate(() => window.__okto.state) === 'cinema', 'sinematik giriş başladı');
    for (const [t, name] of [[0.8, 'a'], [2.2, 'b'], [3.6, 'c']]) { // sinematikten kareler
      await page.evaluate(t => { const O = window.__okto; while (O.cine && O.cine.t < t) O.step(1 / 60); O.draw(); }, t);
      await page.screenshot({ path: path.join(OUT, `5-sinematik-${name}.png`) });
    }
    await run(page, 3, 0);
    const bb = await page.evaluate(() => { const B = window.__okto.boss; return B && { kind: B.kind, big: B.big, hp: B.maxHp }; });
    ok(bb && bb.big && bb.kind === 'ornek-buyuk', `büyük canavar savaşı başladı (can ${bb && bb.hp})`);
    await page.evaluate(() => window.__okto.draw()); await page.screenshot({ path: path.join(OUT, '5-buyuk-canavar.png') });
    seen = await run(page, 120, 2.2, 'clear');
    ok(seen.phases.includes('Öfkelendi!') && seen.phases.includes('Son güç!'), 'büyük canavar 3 aşamadan geçti');
    ok(await page.evaluate(() => window.__okto.state) === 'clear', 'büyük canavar yenildi');
    ok((await page.textContent('#clTitle')).includes('Tamamlandı') && (await page.textContent('#clName')).includes('Kupa'), 'grup sonu kartı: kupa');
    await page.evaluate(() => window.__okto.startTransition()); await run(page, 4, 0);
    ok(await page.evaluate(() => [window.__okto.levelN, window.__okto.levelInfo(5).group].join()) === '5,2', '2. gruba geçildi');
    ok(await page.evaluate(() => localStorage.getItem('okto_profile')) === null, 'test adresinde hiçbir şey kaydedilmedi');
    ok(errors.length === 0, 'hata yok' + (errors.length ? ': ' + errors.join(' / ') : ''));
    await close();
  }
  // 5b) büyük zafer ekranı ve dokunarak sinematiği geçme (gerçek döngüyle)
  {
    const { page, errors, close } = await open('?plan=grup&bolum=4&boss=ornek-buyuk', false);
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

  await browser.close(); srv.close();
  console.log(`\n${passes} geçti, ${fails} kaldı`);
  process.exit(fails ? 1 : 0);
})();
