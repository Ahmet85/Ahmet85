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
const Z1 = ['reefs', 'canyon', 'akinti', 'yosun'], Z2 = Z1.concat(['baca', 'gemi', 'mayin']), Z3 = Z2.concat(['magara', 'kacis']);
const GROUPS = [
  {
    name: 'Örnek Grup 1',
    stages: [
      { name: 'Güneşli Sular', len: 150, tier: 1, boss: 'puffer', zones: Z1, news: 'Mini canavar: Dev Balon Balığı' },
      { name: 'Mercan Bahçesi', len: 170, tier: 1, boss: 'jelly', zones: Z1, env: { water: ['#46d6d0', '#0d6f8a'] }, news: 'Mini canavar: Elektrikli Denizanası' },
      { name: 'Alacakaranlık', len: 190, tier: 2, boss: 'ornek-mini', zones: Z2, news: 'Mini canavar: Örnek Mini Canavar' },
    ],
    arena: { name: 'Taht Mağarası', len: 60, tier: 2, boss: 'ornek-buyuk', env: { water: ['#2a3f8f', '#0a0f33'] }, news: 'Büyük canavar yaklaşıyor!',
      intro: { title: 'ÖRNEK BÜYÜK CANAVAR', sub: 'Derinlerin hükümdarı uyandı', color: '#ffd36b' } },
  },
  {
    name: 'Örnek Grup 2',
    stages: [
      { name: 'Batık Şehir', len: 200, tier: 2, boss: 'squid', zones: Z2, env: { water: ['#3a6f9a', '#0b2240'] }, news: 'Mini canavar: Dev Kalamar' },
      { name: 'Sıcak Bacalar Vadisi', len: 220, tier: 3, boss: 'puffer', zones: Z3, env: { water: ['#5a3a6a', '#1a0a20'] }, news: 'Mini canavar: Dev Balon Balığı' },
      { name: 'Işıksız Uçurum', len: 240, tier: 3, boss: 'jelly', zones: Z3, news: 'Mini canavar: Elektrikli Denizanası' },
    ],
    arena: { name: 'Kraliyet Çukuru', len: 60, tier: 3, boss: 'ornek-buyuk', env: { water: ['#3a0f3f', '#050010'] }, news: 'Büyük canavar yaklaşıyor!',
      intro: { title: 'ÖRNEK BÜYÜK CANAVAR', sub: 'Bu kez daha güçlü', color: '#ff9ad0' } },
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
    power: 1 + gi * 2 + slot + loop * 2, zones: slot < 3 ? st.zones : [], env: st.env || null, intro: st.intro || null,
  };
}

let mode = 'klasik';
window.OktoCampaign = {
  CLASSIC, GROUPS, PER_GROUP,
  get mode() { return mode; },
  setMode(m) { mode = m === 'grup' ? 'grup' : 'klasik'; },
  level: n => (mode === 'grup' ? grouped(n) : classic(n)),
};
})();
