/* OKTO bölüm düzeni (kampanya). game.js bölüm bilgisini buradan alır: OktoCampaign.level(n).

   İki düzen var:
   - 'klasik' (VARSAYILAN, s21 ile birebir aynı): 3 bölüm + her 300 m'de tekrar eden sonsuz bölüm.
   - 'grup' (TASLAK, yalnızca test adresinde açılır: ?plan=grup): bölüm grupları. Her grupta 3 bölüm, her bölümün sonunda
     mini canavar; ardından kısa bir "arena" bölümü, sinematik giriş ve BÜYÜK canavar. Sonraki grupta yeni ortamlar.
     Buradaki grup verileri yer tutucudur; kullanıcının bölüm planı ve görselleri gelince doldurulacak.
     Kullanıcı onay vermeden varsayılan düzen değiştirilmez.

   level(n) şunları döndürür:
   { n, name, start, end, tier, boss, news }                         ← her iki düzende
   { group, groupName, slot, arena, power, zones, env, intro }       ← yalnızca grup düzeninde
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

// ---------- Grup düzeni (TASLAK, yer tutucu veriler) ----------
// Her grup: 3 bölüm (mini canavarlı) + 1 arena (büyük canavar). len: bölüm uzunluğu (m).
// Kullanıcının bölüm planı (s30 pilot). Her bölümde tek bir ortam (özel bölge) baştan sona sürer.
const GROUPS = [
  {
    name: 'Güneşli Sular',
    stages: [
      { name: 'Resif Adacıkları', len: 40, tier: 1, boss: 'kestane', zones: ['reefs'], news: 'Mini canavar: Dikenli Kestane' },
      { name: 'Mercan Kanyonu', len: 40, tier: 1, boss: 'yengec', zones: ['canyon'], news: 'Mini canavar: Resif Yengeci' },
      { name: 'Güçlü Akıntı', len: 40, tier: 1, boss: 'vatoz', zones: ['akinti'], news: 'Mini canavar: Akıntı Vatozu' },
    ],
    arena: { name: 'Balon Balığı Yuvası', len: 30, tier: 1, boss: 'puffer-big', news: 'Büyük canavar yaklaşıyor!',
      intro: { title: 'DEV BALON BALIĞI', sub: 'Güneşli Suların bekçisi uyandı', color: '#ffd36b' } },
  },
  {
    name: 'Alacakaranlık',
    stages: [
      { name: 'Sıcak Bacalar', len: 75, tier: 2, boss: 'baca-yengeci', zones: ['baca'], env: { water: ['#3f6f9a', '#14304f'] }, news: 'Mini canavar: Baca Yengeci' },
      { name: 'Batık Gemi', len: 75, tier: 2, boss: 'zirhli-balon', zones: ['gemi'], env: { water: ['#2f5f86', '#0f2740'] }, news: 'Mini canavar: Zırhlı Balon Balığı' },
      { name: 'Mayın Tarlası', len: 75, tier: 2, boss: 'mayin-yengeci', zones: ['mayin'], env: { water: ['#2a5070', '#0c2036'] }, news: 'Mini canavar: Mayın Yengeci' },
    ],
    arena: { name: 'Fırtına Çukuru', len: 25, tier: 2, boss: 'jelly-big', env: { water: ['#253f6a', '#0a1630'] }, news: 'Büyük canavar yaklaşıyor!',
      intro: { title: 'ELEKTRİKLİ DENİZANASI', sub: 'Alacakaranlığın şimşeği', color: '#c7a8ff' } },
  },
  {
    name: 'Karanlık Derinlikler',
    stages: [
      { name: 'Karanlık Mağara', len: 90, tier: 3, boss: 'murekkepci', zones: ['magara'], news: 'Mini canavar: Mağara Mürekkepçisi' },
      { name: 'Yosun Geçidi', len: 90, tier: 3, boss: 'hayalet-denizanasi', zones: ['yosun'], news: 'Mini canavar: Hayalet Denizanası' },
      { name: 'Fener Balığı Kaçışı', len: 90, tier: 3, boss: 'iri-fener', zones: ['kacis'], news: 'Mini canavar: İri Fener Balığı' },
    ],
    arena: { name: 'Kalamar İni', len: 30, tier: 3, boss: 'squid-big', news: 'Büyük canavar yaklaşıyor!',
      intro: { title: 'DEV KALAMAR', sub: 'Derinlerin hükümdarı', color: '#ff9ab0' } },
  },
];
const PER_GROUP = 4; // 3 bölüm + 1 arena
function grouped(n) {
  const gi = Math.floor((n - 1) / PER_GROUP), slot = (n - 1) % PER_GROUP;
  const G = GROUPS[gi % GROUPS.length], loop = Math.floor(gi / GROUPS.length); // gruplar bitince daha güçlü tekrar
  let start = 0; // başlangıç derinliği: önceki bütün bölümlerin uzunlukları
  for (let k = 1; k < n; k++) { const gk = Math.floor((k - 1) / PER_GROUP), sk = (k - 1) % PER_GROUP, Gk = GROUPS[gk % GROUPS.length]; start += (sk < 3 ? Gk.stages[sk] : Gk.arena).len; }
  const st = slot < 3 ? G.stages[slot] : G.arena;
  return {
    n, name: st.name, start, end: start + st.len, tier: st.tier, boss: st.boss, news: st.news || '',
    group: gi + 1, groupName: G.name + (loop ? ` +${loop}` : ''), slot, arena: slot === 3,
    power: 1 + gi + loop * 2, // canavar gücü: grup başına bir kademe
    zones: slot < 3 ? st.zones : [], env: st.env || null, intro: st.intro || null,
  };
}

// Eski (klasik) kayıt noktasını grup düzenine taşı: aynı derinlikten devam edilir
// klasik 1 (0 m) → grup bölümü 1 · klasik 2 (150 m) → 5 · klasik 3 (400 m) → 9 · klasik 4+ (700 m+) → 13
function migrate(classicLevel) { const n = Math.max(1, classicLevel | 0); return n <= 1 ? 1 : n === 2 ? 5 : n === 3 ? 9 : 13; }
let mode = 'klasik';
window.OktoCampaign = {
  CLASSIC, GROUPS, PER_GROUP, migrate,
  get mode() { return mode; },
  setMode(m) { mode = m === 'grup' ? 'grup' : 'klasik'; },
  level: n => (mode === 'grup' ? grouped(n) : classic(n)),
};
})();
