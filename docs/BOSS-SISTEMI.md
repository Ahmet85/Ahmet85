# OKTO canavar ve bölüm grubu altyapısı (s22)

Bu belge, yeni canavarları tasarlayan yapay zekâ ve oyun geliştirme için ortak başvuru.
Durum: **altyapı hazır, varsayılan oyun değişmedi.** Yeni düzen yalnızca test adresinde açılır.

## 0. Kullanıcının bölüm planı (s31) ve pilot durumu
| Grup | Ortam → mini canavar | Büyük canavar | Durum |
|---|---|---|---|
| Güneşli Sular · 0–150 m | Resif Adacıkları → Dikenli Kestane · Mercan Kanyonu → Resif Yengeci · Güçlü Akıntı → Akıntı Vatozu | Dev Balon Balığı | **Pilot hazır** (test adresi); s32'de çizimler PNG'lere göre yenilendi (`docs/canavarlar/`) |
| Alacakaranlık · 150–400 m | Sıcak Bacalar → Baca Yengeci · Batık Gemi → Zırhlı Balon Balığı · Mayın Tarlası → Mayın Yengeci | Elektrikli Denizanası | Plan işlendi; s33'te üç mini canavar PNG'lere göre çizildi, saldırıları geçici (tanım bekleniyor) |
| Karanlık Derinlikler · 400–700 m | Karanlık Mağara → Mağara Mürekkepçisi · Yosun Geçidi → Hayalet Denizanası · Fener Balığı Kaçışı → İri Fener Balığı | Dev Kalamar | Plan işlendi; Hayalet Denizanası ve İri Fener Balığı çizildi, **Mağara Mürekkepçisi görseli eksik**; saldırılar geçici |

Bölüm uzunlukları: 1. grup 40+40+40 m + 30 m arena; 2. grup 75×3 + 25; 3. grup 90×3 + 30. Her bölümde tek ortam baştan sona sürer.

Pilot mini canavarlar:
- **Dikenli Kestane** (`kestane`): sağa sola salınır; turuncu noktaları 0,9 sn parlar → 12+ dikenli halka.
- **Resif Yengeci** (`yengec`): yan duvarda, Okto'nun hizasına kayar; kıskacını kaldırır ve koridorda 1 sn yatay uyarı şeridi (oklarla) → kıskaç kenardan kenara süpürür; bazen karşı duvara geçer.
- **Akıntı Vatozu** (`vatoz`): kanatlarını 0,8 sn toplar → 1,6 sn yan akıntı Okto'yu sürükler → 1,8 sn **açık**: her vuruş +1 hasar ("Çift vuruş!"); arada nişanlı mürekkep lekeleri.
- **Dev Balon Balığı** büyük canavar olarak (`puffer-big`): aynı saldırılar, can 7, daha büyük, sinematik girişli.

Eski kayıt taşıma (`OktoCampaign.migrate`): klasik bölüm 1 → grup 1, 2 (150 m) → 5, 3 (400 m) → 9, 4+ (700 m+) → 13.
Test kaydı: test adresinde bölüm kartı ve oyun sonunda kopyalanabilir özet (karşılaşma süreleri, isabet, hasar, beceri kullanımı, açılma derinliği).

## 1. Bölüm düzeni (`campaign.js`)
- `klasik` (varsayılan, s21 ile aynı): 3 bölüm + her 300 m'de tekrar eden sonsuz bölüm.
- `grup` (taslak): her grupta **3 bölüm** (her birinin sonunda mini canavar) + **1 arena** (kısa sakin dalış →
  sinematik giriş → büyük canavar). Gruplar bitince daha güçlü olarak baştan tekrar eder.
- Her bölüm için tanımlanabilenler:

| Alan | Anlamı | Örnek |
|---|---|---|
| `name` | Bölüm adı | `'Mercan Bahçesi'` |
| `len` | Uzunluk (metre) | `170` |
| `tier` | Düşman ve ses kademesi (1–3) | `2` |
| `boss` | Bölüm sonu canavarının kimliği | `'puffer'` |
| `zones` | Açılan özel bölgeler | `['reefs','akinti','yosun']` |
| `env.water` | Ortamın su rengi (üst, alt) | `['#46d6d0', '#0d6f8a']` |
| `intro` | (arena) sinematik başlık, alt yazı, renk | `{ title, sub, color }` |

## 2. Canavar tanımı (`boss-ai.js`)
Var olan saldırıları kullanan bir canavar **yalnızca tanımla** eklenir:

```js
OktoBossAI.register({
  id: 'mercan-yengeci', name: 'MERCAN YENGECİ', size: 'mini',   // 'mini' | 'big'
  hp: 4, r: 58, restY: 135, color: '#ffb38a',                  // can, yarıçap, dinlenme yüksekliği, vuruş rengi
  contact: 0.85, contactY: 0.2,                                // gövde çarpışma dairesi (saldırılardan ayrı)
  move: { type: 'follow', speed: 0.8, bob: 6 },                // sway | follow | hover
  attacks: [{ id: 'aimed', w: 2, count: 3 }, { id: 'dash', w: 1 }],
  phases: [{ below: 0.5, name: 'Öfkelendi!', rate: 0.8,       // canın yarısında yeni aşama
             attacks: [{ id: 'aimed', w: 1, count: 4 }, { id: 'tentacle', w: 1 }] }],
});
```

Saldırı kütüphanesi: `spikeFan` (yelpaze diken), `dash` (uyarılı hamle), `zap` (yıldırım sütunu), `minions` (yavru çağırma),
`aimed` (nişanlı mermi), `tentacle` (alttan darbe). Her saldırının uyarısı var (çocuk oyunu: önce gösterilir, sonra vurur).
**Tamamen yeni bir saldırı türü kod ister** (kütüphaneye eklenir, sonra her canavar kullanabilir).

Çarpışma: daireler (gövde, mermiler) ve dikey şeritler (yıldırım, dokunaç). Hareket ekran koordinatlarında; savaşta dünya durur.

## 3. Görsel teslim biçimi (önerilen)
Her canavar için bir paket:
1. **Saydam PNG, 1024 px** (mümkünse gövde, gözler, kollar ayrı katmanlarda) — kodla yeniden çizim için model.
2. İsteğe bağlı ifade görselleri: normal, kızgın, sersemlemiş.
3. **Tanım** (metin veya JSON): yukarıdaki alanlar + renk paleti + zayıf nokta + aşama fikri.

Sprite sheet gerekmez; animasyon kodla verilir. Projede kural: oyundaki grafikler kodla çizilir (görsel dosyası
kullanılması ayrı bir karar olur, kullanıcı onayı gerekir).

## 4. Büyük canavar sahnesi (`cinema.js`)
- **Sinematik giriş (~5 sn, dokununca geçilir):** su kararır → akıntılar → dipte girdap → aşağıdan ışık huzmeleri →
  karanlık silüet yükselir → ışıkla görünür → isim kartı; sinema şeritleri; gümbürtü ve yükselen ses; savaşta özel müzik (`boss`).
- **Büyük zafer:** dönen altın ışınlar, konfeti, kupa, fanfar; 30 inci; 3 kat puan; kupa profile kaydedilir;
  kartta "Grup Tamamlandı · Kupa kazandın".
- Yanıp sönme yok, ışıklar yumuşak açılır.

## 5. Deneme ve güvenlik
- Test odası: `preview/boss-test.html` (tüm canavarlar ve sinematik bağlantıları). Test adresi hiçbir şey kaydetmez.
- `node tests/regress.js`: 41 kontrol (konsol hatası, HUD, klasik tablo, 3 canavar baştan sona, resif kuralı, grup düzeni,
  aşamalar, sinematik, büyük zafer).
- Yedek: `yedek/s21/` (oynanabilir) ve git geçmişi (commit 14e5d5f).

## 6. Sırada (kullanıcı onayıyla)
1. Kullanıcının bölüm planı ve canavar görselleri → `campaign.js` grupları ve `boss-ai.js` tanımları.
2. Her yeni canavarın önce önizlemesi (PNG/GIF), onaydan sonra oyuna.
3. Onaydan sonra varsayılan düzenin `grup` yapılması (eski kayıt noktalarının taşınması o zaman planlanacak).
