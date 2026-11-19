const test = require('node:test');
const assert = require('node:assert/strict');
const RK = require('../core.js');
const D = require('../data.js');

const MON = '2026-11-16'; // Pazartesi
const box = (id, extra) => Object.assign({ id, em: '⭐', name: id, part: 'aksam', time: '20:00', kind: 'tap', days: [1, 2, 3, 4, 5, 6, 7], c: '#000' }, extra);

test('tarih yardımcıları', () => {
  assert.equal(RK.weekday(MON), 1);
  assert.equal(RK.weekday('2026-11-22'), 7);
  assert.equal(RK.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(RK.weekStart('2026-11-19'), MON);
});

test('günün kutuları: gün, bölüm ve saat sırası', () => {
  const s = RK.emptyState();
  s.boxes = [box('piyano', { days: [1] }), box('gitar', { days: [2] }), box('su', { part: 'gun', time: '' }), box('uyanis', { part: 'sabah', time: '06:30' }), box('tek', { once: '2026-11-17', days: [] })];
  assert.deepEqual(RK.boxesForDay(s, MON).map((b) => b.id), ['uyanis', 'su', 'piyano']);
  assert.deepEqual(RK.boxesForDay(s, '2026-11-17').map((b) => b.id), ['uyanis', 'su', 'gitar', 'tek']);
});

test('müzisyenin akşam programı tabloyla aynı', () => {
  const s = RK.emptyState();
  s.boxes = D.PACKS.aksamMuzik.boxes.map((b, i) => ({ ...b, id: 'b' + i }));
  const names = (d) => RK.boxesForDay(s, d).map((b) => `${b.time} ${b.name}`);
  assert.deepEqual(names('2026-11-16'), ['20:00 Piyano & teori', '21:00 15 dk piyano', '21:15 Arrange']);
  assert.deepEqual(names('2026-11-17'), ['20:00 Gitar repertuar', '21:00 15 dk piyano', '21:15 Teori · mix']);
  assert.deepEqual(names('2026-11-18'), ['20:00 Kayıt işleri', '21:00 15 dk piyano', '21:15 Mix · render']);
  assert.deepEqual(names('2026-11-19'), ['20:00 Video projeler', '21:00 15 dk piyano']);
  assert.deepEqual(names('2026-11-20'), ['20:00 Beste', '21:00 15 dk piyano', '21:15 Beste (devam)']);
  assert.deepEqual(names('2026-11-21'), ['20:00 Sosyal medya · içerik', '21:00 15 dk piyano']);
  assert.deepEqual(names('2026-11-22'), []);
});

test('müzik yolu bilinmeyen konulardan kurulur; bilinenler atlanır', () => {
  const p = RK.buildPath(D.PATHS.muzik, 'derin', { kulak: 'var', armoni: 'az', ritim: 'var', mix: 'yok', turler: 'yok', dogaclama: 'var' });
  const topics = [...new Set(p.steps.map((s) => s.topic))];
  assert.deepEqual(topics, ['Kayıt ve mix', 'Yeni türler', 'Armoni']); // hiç bilmediklerim önce
  assert.equal(p.steps.length, 15);
  assert.equal(p.steps[0].topic, 'Kayıt ve mix');
  assert.equal(p.steps[1].topic, 'Yeni türler'); // konular sırayla karışır
});

test('hayal edilen hobi: Başla yolu; deneme yolu 5 adım', () => {
  assert.equal(RK.buildPath(D.PATHS.eskrim, 'basla').steps.length, 12);
  assert.equal(RK.buildPath(D.PATHS.tenis, 'dene').steps.length, 5);
  const g = RK.genericPath('Seramik', 'basla', D.GENERIC);
  assert.ok(g.steps[0].t.includes('Seramik'));
});

test('her yol adımının küçültülmüş hâli var', () => {
  for (const def of Object.values(D.PATHS)) {
    const all = [...(def.basla || []), ...(def.derin || []), ...Object.values(def.topics || {}).flatMap((t) => t.steps)];
    assert.ok(all.length >= 8, def.key);
    for (const s of all) assert.ok(s.t && s.s && s.t !== s.s, def.key);
  }
});

test('gelişim kutuları: günde en fazla 1–2, tamamlanınca yol ilerler', () => {
  const s = RK.emptyState();
  s.profile = { minutes: 15, interests: [], dreams: [] };
  RK.addPath(s, RK.buildPath(D.PATHS.tenis, 'basla'), MON);
  RK.addPath(s, RK.buildPath(D.PATHS.eskrim, 'basla'), MON);
  RK.rollDay(s, MON);
  let g = RK.growthForDay(s, MON);
  assert.equal(g.length, 1); // 15 dk → günde tek gelişim kutusu
  assert.equal(g[0].path.key, 'tenis');
  assert.ok(RK.completeGrowth(s, MON, g[0].path.id));
  assert.equal(RK.growthForDay(s, MON)[0].done, true);
  assert.equal(RK.growthForDay(s, MON)[0].idx, 0); // bugün yapılan adım görünmeye devam eder
  assert.equal(RK.completeGrowth(s, MON, g[0].path.id), false); // aynı gün ikinci kez ilerlemez
  RK.rollDay(s, '2026-11-17');
  g = RK.growthForDay(s, '2026-11-17');
  assert.equal(g[0].path.key, 'eskrim'); // sıra diğer yola geçer
  s.profile.minutes = 30;
  delete s.log['2026-11-18'];
  RK.rollDay(s, '2026-11-18');
  assert.equal(RK.growthForDay(s, '2026-11-18').length, 2);
});

test('üç kez atlanan adım küçültülür, yapılınca normale döner', () => {
  const s = RK.emptyState();
  s.profile = { minutes: 15 };
  RK.addPath(s, RK.buildPath(D.PATHS.eskrim, 'basla'), MON);
  let d = MON;
  for (let i = 0; i < 3; i++) { RK.rollDay(s, d); d = RK.addDays(d, 1); }
  RK.rollDay(s, d);
  const g = RK.growthForDay(s, d)[0];
  assert.equal(g.small, true);
  assert.equal(g.text, D.PATHS.eskrim.basla[0].s);
  RK.completeGrowth(s, d, g.path.id);
  assert.equal(s.paths[0].small, false);
  assert.equal(s.paths[0].idx, 1);
});

test('gün özeti: atlanan kutu sayılmaz, gelişim kutusu sayılır', () => {
  const s = RK.emptyState();
  s.profile = { minutes: 15 };
  s.boxes = [box('a'), box('b'), box('c')];
  RK.addPath(s, RK.buildPath(D.PATHS.tenis, 'basla'), MON);
  RK.rollDay(s, MON);
  RK.setEntry(s, MON, 'a', { s: 'done' });
  RK.setEntry(s, MON, 'b', { s: 'skip' });
  assert.deepEqual(RK.daySummary(s, MON), { total: 3, done: 1, ratio: 1 / 3, complete: false });
  RK.setEntry(s, MON, 'c', { s: 'done' });
  RK.completeGrowth(s, MON, s.paths[0].id);
  assert.equal(RK.daySummary(s, MON).complete, true);
});

test('seri ve geri dönüş', () => {
  const s = RK.emptyState();
  s.boxes = [box('a')];
  for (const d of ['2026-11-10', '2026-11-11', '2026-11-16']) RK.setEntry(s, d, 'a', { s: 'done' });
  assert.deepEqual(RK.streak(s, MON), { days: 1, comeback: true });
  RK.setEntry(s, '2026-11-15', 'a', { s: 'done' });
  assert.deepEqual(RK.streak(s, MON), { days: 2, comeback: false });
  assert.equal(RK.boxStreak(s, s.boxes[0], MON), 2);
});

test('keşfet önerileri: zaten ilgilenilenler önerilmez', () => {
  const sug = RK.suggestions({ interests: [{ key: 'muzik' }], dreams: ['tenis', 'eskrim'] }, D.SUGGEST, D.PATHS);
  assert.equal(sug.length, 3);
  assert.ok(sug.includes('dans'));
  assert.ok(!sug.includes('tenis') && !sug.includes('muzik'));
});

test('her açılışta farklı söz', () => {
  const s = RK.emptyState();
  let prev = -1;
  for (let i = 0; i < 50; i++) { const q = RK.nextQuote(s, D.QUOTES.length); assert.notEqual(q, prev); prev = q; }
  assert.ok(D.QUOTES.length >= 25);
});

// ---- Gün gün ayarlama ----
const SAT = '2026-11-21', THU = '2026-11-19';
function weekState() {
  const s = RK.emptyState();
  s.boxes = D.PACKS.hafta.boxes.map((b, i) => ({ ...b, days: [...b.days], id: 'h' + i }));
  return s;
}
const line = (s, d) => RK.boxesForDay(s, d).map((b) => `${b.time} ${b.name}`);

test('dengeli hafta paketi tabloyla aynı (Pazartesi ve Pazar)', () => {
  const s = weekState();
  assert.deepEqual(line(s, MON), ['06:30 Uyanış · S N', '07:00 Güç antrenmanı', '07:45 Planlama & kahve', '08:15 Kahvaltı', '09:00 Mesai', '12:30 Yemek · Ö N', '13:30 Mesai (öğleden sonra)', '15:34 İkindi', '17:00 Mola · yürüyüş', '18:00 Serbest',
    '19:00 Akşam yemeği · A N', '20:00 Piyano & teori', '21:00 15 dk piyano', '21:15 Arrange', '21:45 Y N · ekran kapanır', '22:00 Okuma', '23:00 Uyku']);
  assert.deepEqual(line(s, '2026-11-22'), ['06:30 Uyanış · S N', '07:00 Dinlenme', '07:45 Planlama & kahve', '08:15 Kahvaltı', '09:00 Aile', '12:30 Aile yemeği · Ö N', '13:30 Serbest', '15:34 İkindi',
    '19:00 Akşam yemeği · A N', '20:00 Karne & haftalık plan', '21:45 Y N · ekran kapanır', '22:00 Okuma', '23:00 Uyku']);
  assert.ok(line(s, THU).includes('21:15 Serbest') && line(s, THU).includes('20:00 Video projeler'));
});

test('yalnızca bu gün: o tarih değişir, diğer haftalar ve asıl kutu aynı kalır', () => {
  const s = weekState();
  const video = RK.boxesForDay(s, THU).find((b) => b.name === 'Video projeler');
  RK.editBox(s, video.id, { name: 'Beste', em: '🎼' }, 'day', THU);
  assert.ok(line(s, THU).includes('20:00 Beste') && !line(s, THU).includes('20:00 Video projeler'));
  assert.equal(RK.boxesForDay(s, THU).find((b) => b.id === video.id).dayOnly, true);
  assert.ok(line(s, '2026-11-26').includes('20:00 Video projeler'));
  assert.equal(s.boxes.find((b) => b.id === video.id).name, 'Video projeler');
});

test('her hafta o gün: çok günlü kutu yalnızca o gün için bölünür, geçmiş kayıt taşınır', () => {
  const s = weekState();
  const piano = s.boxes.find((b) => b.name === '15 dk piyano');
  RK.setEntry(s, '2026-11-14', piano.id, { s: 'done' }); // geçen Cumartesi
  const copy = RK.editBox(s, piano.id, { name: 'Gitar 15 dk', em: '🎸' }, 'wd', SAT);
  assert.ok(line(s, SAT).includes('21:00 Gitar 15 dk') && !line(s, SAT).includes('21:00 15 dk piyano'));
  assert.ok(line(s, '2026-11-28').includes('21:00 Gitar 15 dk')); // sonraki Cumartesi de
  assert.ok(line(s, MON).includes('21:00 15 dk piyano')); // diğer günler aynı
  assert.deepEqual(piano.days, [1, 2, 3, 4, 5]);
  assert.equal(RK.entry(s, '2026-11-14', copy.id).s, 'done');
});

test('tüm günler ve saat değişimi sıralamayı günceller', () => {
  const s = weekState();
  const okuma = s.boxes.find((b) => b.name === 'Okuma');
  RK.editBox(s, okuma.id, { time: '07:30', part: 'sabah' }, 'all', MON);
  assert.equal(line(s, MON)[2], '07:30 Okuma');
  assert.equal(line(s, SAT)[2], '07:30 Okuma');
});

test('kaldırma: yalnızca bu gün, her hafta o gün, tamamen', () => {
  const s = weekState();
  const ikindi = s.boxes.find((b) => b.name === 'İkindi');
  RK.removeBox(s, ikindi.id, 'day', THU);
  assert.ok(!line(s, THU).includes('15:34 İkindi') && line(s, '2026-11-20').includes('15:34 İkindi'));
  RK.removeBox(s, ikindi.id, 'wd', SAT);
  assert.ok(!line(s, SAT).includes('15:34 İkindi') && !line(s, '2026-11-28').includes('15:34 İkindi') && line(s, MON).includes('15:34 İkindi'));
  RK.removeBox(s, ikindi.id, 'all', MON);
  assert.ok(!line(s, MON).includes('15:34 İkindi'));
});
