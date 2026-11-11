/* OKTO bölüm düzeni (kampanya). game.js bölüm bilgisini buradan alır: OktoCampaign.level(n).

   İki düzen var:
   - 'grup' (s44'ten beri asıl oyun, kullanıcı onayladı): bölüm grupları. Her grupta 3 bölüm, her bölümün sonunda
     mini canavar (1–4), 5. bölümün sonunda sinematik giriş ve BÜYÜK canavar (s45). Üç gruptan sonra güçlenerek tekrar.
   - 'klasik' (s21 ile birebir aynı, yalnızca test adresinde: ?plan=klasik): 3 bölüm + her 300 m'de tekrar eden sonsuz bölüm.

   level(n) şunları döndürür:
   { n, name, start, end, tier, boss, news }                         ← her iki düzende
   { group, groupName, slot, arena, power, zones, env, intro, dd, vis } ← yalnızca grup düzeninde (arena: büyük canavarlı 5. bölüm)
     power: canavar gücü (klasikte bölüm numarası), zones: bu bölümde açılan özel bölgeler,
     env: { water: [üst renk, alt renk], tint } ortam renkleri, intro: büyük canavar sinematiği ayarları */
(() => {
'use strict';

// ---------- Klasik düzen (s21) ----------
const CLASSIC = [
  { name: 'Güneşli Sular', start: 0, end: 150, tier: 1, boss: 'puffer', news: '🪼 Denizanaları ve 🐡 balon balıklarına dikkat!' },
  { name: 'Alacakaranlık Bölgesi', start: 150, end: 400, tier: 2, boss: 'jelly', news: '🦈 Köpekbalıkları geliyor: kırmızı ❗ uyarısına bak!' },
  { name: 'Karanlık Derinlikler', start: 400, end: 700, tier: 3, boss: 'squid', news: '🏮 Fener balıkları seni takip ediyor!' },
];
function classic(n) {
  if (n <= CLASSIC.length) return Object.assign({ n }, CLASSIC[n - 1]);
  const start = 700 + (n - 4) * 300;
  return { n, name: `Sonsuz Derinlik ${n - 3}`, start, end: start + 300, tier: 3, boss: ['puffer', 'jelly', 'squid'][(n - 4) % 3], news: '💪 Canavarlar artık daha güçlü!' };
}

// ---------- Grup düzeni (s45: grup başına 5 bölüm) ----------
// 1–4. bölümlerin sonunda mini canavar, 5. bölümün sonunda sinematik girişli BÜYÜK canavar.
// zones: bölümde açık su arasında karışık gelen özel bölgeler (ilki bölümün adını veren bölge, aynısı arka arkaya gelmez).
// Grup içinde zorluk ve su rengi eski klasik bölümün derinliğine göre ilerler (dd: klasik eşdeğer derinlik aralığı),
// böylece bölümler uzasa da Güneşli Sular aydınlık ve kolay kalır.
const GROUPS = [
  {
    name: 'Güneşli Sular', len: 100, dd: [0, 150],
    stages: [
      { name: 'Resif Adacıkları', tier: 1, boss: 'kestane', zones: ['reefs', 'yosun', 'canyon'], news: 'Mini canavar: Dikenli Kestane' },
      { name: 'Mercan Kanyonu', tier: 1, boss: 'yengec', zones: ['canyon', 'akinti', 'reefs'], news: 'Mini canavar: Resif Yengeci' },
      { name: 'Güçlü Akıntı', tier: 1, boss: 'vatoz', zones: ['akinti', 'yosun', 'reefs'], news: 'Mini canavar: Akıntı Vatozu' },
      { name: 'Yosun Ormanı', tier: 1, boss: 'deniz-ati', zones: ['yosun', 'canyon', 'akinti'], news: 'Mini canavar: Deniz Atı' },
      { name: 'Balon Balığı Yuvası', tier: 1, boss: 'puffer-big', big: true, zones: ['reefs', 'akinti', 'yosun', 'canyon'], news: 'Büyük canavar yaklaşıyor!',
        intro: { title: 'DEV BALON BALIĞI', sub: 'Güneşli Suların bekçisi uyandı', color: '#ffd36b' } },
    ],
  },
  {
    name: 'Alacakaranlık', len: 150, dd: [150, 400],
    stages: [
      { name: 'Sıcak Bacalar', tier: 2, boss: 'baca-yengeci', zones: ['baca', 'reefs', 'yosun'], env: { water: ['#3f6f9a', '#14304f'] }, news: 'Mini canavar: Baca Yengeci' },
      { name: 'Batık Gemi', tier: 2, boss: 'zirhli-balon', zones: ['gemi', 'canyon', 'akinti'], env: { water: ['#2f5f86', '#0f2740'] }, news: 'Mini canavar: Zırhlı Balon Balığı' },
      { name: 'Mayın Tarlası', tier: 2, boss: 'mayin-yengeci', zones: ['mayin', 'baca', 'yosun'], env: { water: ['#2a5070', '#0c2036'] }, news: 'Mini canavar: Mayın Yengeci' },
      { name: 'Yıldız Resifi', tier: 2, boss: 'deniz-yildizi', zones: ['reefs', 'gemi', 'mayin'], env: { water: ['#2c4f78', '#0c1f38'] }, news: 'Mini canavar: Dev Deniz Yıldızı' },
      { name: 'Fırtına Çukuru', tier: 2, boss: 'jelly-big', big: true, zones: ['baca', 'gemi', 'mayin', 'canyon'], env: { water: ['#253f6a', '#0a1630'] }, news: 'Büyük canavar yaklaşıyor!',
        intro: { title: 'ELEKTRİKLİ DENİZANASI', sub: 'Alacakaranlığın şimşeği', color: '#c7a8ff' } },
    ],
  },
  {
    name: 'Karanlık Derinlikler', len: 200, dd: [400, 700],
    stages: [
      { name: 'Karanlık Mağara', tier: 3, boss: 'murekkepci', zones: ['magara', 'yosun', 'canyon'], news: 'Mini canavar: Mağara Mürekkepçisi' },
      { name: 'Yosun Geçidi', tier: 3, boss: 'hayalet-denizanasi', zones: ['yosun', 'magara', 'akinti'], news: 'Mini canavar: Hayalet Denizanası' },
      { name: 'Fener Balığı Kaçışı', tier: 3, boss: 'iri-fener', zones: ['kacis', 'mayin', 'reefs'], news: 'Mini canavar: İri Fener Balığı' },
      { name: 'Uçurum Kenarı', tier: 3, boss: 'kilic-baligi', zones: ['canyon', 'kacis', 'baca'], news: 'Mini canavar: Kılıç Balığı' },
      { name: 'Kalamar İni', tier: 3, boss: 'squid-big', big: true, zones: ['magara', 'kacis', 'gemi', 'yosun'], news: 'Büyük canavar yaklaşıyor!',
        intro: { title: 'DEV KALAMAR', sub: 'Derinlerin hükümdarı', color: '#ff9ab0' } },
    ],
  },
];
const PER_GROUP = 5; // 4 mini canavarlı bölüm + 1 büyük canavarlı bölüm
const groupLen = G => G.len * PER_GROUP;
function grouped(n) {
  const gi = Math.floor((n - 1) / PER_GROUP), slot = (n - 1) % PER_GROUP;
  const G = GROUPS[gi % GROUPS.length], loop = Math.floor(gi / GROUPS.length); // gruplar bitince daha güçlü tekrar
  let start = 0; // başlangıç derinliği: önceki bütün grupların ve bu gruptaki önceki bölümlerin uzunlukları
  for (let k = 0; k < gi; k++) start += groupLen(GROUPS[k % GROUPS.length]);
  start += slot * G.len;
  const st = G.stages[slot], f0 = slot / PER_GROUP, f1 = (slot + 1) / PER_GROUP;
  const vis = [G.dd[0] + (G.dd[1] - G.dd[0]) * f0, G.dd[0] + (G.dd[1] - G.dd[0]) * f1]; // su rengi için klasik eşdeğer derinlik
  const dd = vis.map(v => v + loop * 300); // zorluk için: tekrar turunda daha hızlı ve kalabalık
  return {
    n, name: st.name, start, end: start + G.len, tier: st.tier, boss: st.boss, news: st.news || '',
    group: gi + 1, groupName: G.name + (loop ? ` +${loop}` : ''), slot, arena: !!st.big,
    power: 1 + gi + loop * 2, // canavar gücü: grup başına bir kademe
    zones: st.zones, env: st.env || null, intro: st.intro || null, dd, vis,
  };
}

// Eski kayıtları s45 grup düzenine taşı (aynı derinlik / aynı ilerleme):
// klasik 1 (0 m) → 1 · klasik 2 (150 m) → 6 (Alacakaranlık) · klasik 3 (400 m) → 11 (Karanlık D.) · klasik 4+ → 16 (Güneşli Sular +1)
function migrate(classicLevel) { const n = Math.max(1, classicLevel | 0); return n <= 1 ? 1 : n === 2 ? 6 : n === 3 ? 11 : 16; }
// s44 (grup başına 4 bölüm: 3 mini + arena) numarası → s45: aynı grup, aynı sıra (s44 arenası → yeni 4. mini canavar bölümü)
function migrate44(n) { n = Math.max(1, n | 0); return n + Math.floor((n - 1) / 4); }
let mode = 'klasik'; // game.js açılışta ayarlar (parametresiz: grup)
window.OktoCampaign = {
  CLASSIC, GROUPS, PER_GROUP, migrate, migrate44,
  get mode() { return mode; },
  setMode(m) { mode = m === 'grup' ? 'grup' : 'klasik'; },
  level: n => (mode === 'grup' ? grouped(n) : classic(n)),
};
})();
