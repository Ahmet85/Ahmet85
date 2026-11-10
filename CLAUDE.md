# OKTO projesi: Claude için notlar

## Projenin amacı
**OKTO: Derinlerin Kaşifi**, çocuklara yönelik, dikey (9:16) bir mobil sualtı dalış oyunu. Sevimli ahtapot Okto
okyanusun derinliklerine dalar; inci toplar, düşmanlardan ve kayalıklardan kaçar, bölüm sonu canavarlarını yener.
Tarayıcıda çalışan bir PWA: iPhone'da Safari'den "Ana Ekrana Ekle" ile uygulama gibi kurulur, çevrimdışı da oynanır.
Tasarım brifi: `docs/BRIF.md` ("OKTO – UNDERWATER DESCENT", kullanıcının 19 referans görseliyle birlikte verdiği tarif).

## Kullanıcı ve çalışma şekli
- **Kullanıcının cihazı: iPhone 13** (390×844 nokta, 3x, çentik payı ~47 nokta, iOS Safari, ana ekrana eklenmiş PWA).
  Testleri önce bu boyutta yap (Playwright `devices['iPhone 13']`); oyun fare ve parmağı aynı işler, sürükleme testini fareyle yap.
- Kullanıcıyla **Türkçe** konuş; kod yorumları ve commit mesajları da Türkçe.
- Kullanıcı yazılımcı değil: adımları sade, numaralı ver; telefonda nasıl güncelleyeceğini her seferinde söyle.
- Yeni görsel fikirleri önce **GIF / PNG önizleme** olarak göster, onay alınca oyuna ekle.
- Kullanıcı "oku, anla, anlat, bekle" derse hiçbir şey çalıştırma; önce yorumla ve onay bekle.

## Yayın ve sürüm
- Dal: `claude/octopus-mobile-game-0is63u` → GitHub Pages: https://ahmet85.github.io/Ahmet85/
- Aynı dalda başka bir oturumun `ritim/` klasörü var; **ona dokunma**, push öncesi `git fetch` + `git rebase` yap.
- **Her yayında sürümü artır:** `index.html` içindeki tüm `?v=` ekleri, menüdeki `s<sürüm>` etiketi ve `sw.js` içindeki
  `okto-v<sürüm>` birlikte. Kullanıcı sağ alttaki `s<sürüm>` ile güncellemenin geldiğini kontrol ediyor. Son sürüm: **s25**.
- Telefonda güncelleme: uygulamayı kapat-aç (gerekirse iki kez). Açılış görseli/simge değişirse sil-yeniden kur gerekir.

## Alınan kararlar
- **Tüm grafikler ve sesler kodla üretilir** (Canvas 2D, Web Audio). Resim/ses dosyası yok (istisna: açılış görselleri
  `splash/`, ana ekran simgesi). Referans görseller sadece tasarım rehberi; oyuna resim olarak konmaz.
- **Kayalar sabittir**: yerinde durur, sallanmaz; dünya kaydıkça yukarı kayar. Çarpınca can gider, Okto geri seker.
- Kontrol: **göreli sürükleme** (parmak ekranın herhangi bir yerinde, hareket 1,5x). Okto dört yöne gider.
- Bölümler: 1) 0–150 m Güneşli Sular / Dev Balon Balığı, 2) 150–400 m Alacakaranlık / Elektrikli Denizanası,
  3) 400–700 m Karanlık Derinlikler / Dev Kalamar, sonra her 300 m'de sonsuz bölüm. Bölüm sonu: yıldızlı kart → girdap
  geçişi → yeni bölüm tanıtımı. Yanınca bölüm başından devam (kayıt noktası).
- Bölüm içi **bölge planı**: açık su + Resif Adacıkları / Mercan Kanyonu, araya sakin dinlenme parçaları.
- Tuvale çizilen yazılarda **emoji yok** (iPhone genişliğini ölçemiyor, yazı kayıyor). Duyurular elle ortalanır.
- Yanıp sönen efektler yumuşak tutulur (çocuk oyunu, ışığa hassasiyet).

## Canavar ve bölüm grubu altyapısı (s22)
- Kullanıcı kararı: sonsuz tekrar yerine **bölüm grupları**: her bölümde farklı ortam + mini canavar; 3 mini canavardan sonra
  sinematik girişli **büyük canavar**; büyük zafer kutlaması; sonraki grupta yeni ortamlar ve canavarlar.
- **Kullanıcı onay vermeden varsayılan düzen (klasik) ve mevcut 3 canavar değiştirilmez.** Grup düzeni yalnızca test adresinde.
- Görseller ve bölüm planı tasarım yapay zekâsından gelecek; teslim biçimi ve tanım alanları: `docs/BOSS-SISTEMI.md`.
- Test adresleri (hiçbir şey kaydetmez, sağ altta TEST yazar): `?boss=kimlik`, `?bolum=N`, `?plan=grup`; liste: `preview/boss-test.html`.
- s22 yeniden düzenlemesinde mevcut canavarlar eski s21 koduyla aynı rastgele sayılarla yan yana oynatıldı: 4 bölümde birebir aynı.

## Beceri halkası (s24, DENEME: yalnızca `?beceri`)
- Kullanıcı isteği: 12 beceri, oyuncu 3'ünü kuşanır; menüden ve bölüm geçişinde ("Becerileri Değiştir") değiştirilir; seçim kayıtlı kalır.
- Sağ altta tek düğme: basılı tut → Okto çevresinde halka (oyun 0,4 hızına yavaşlar), sürükle yukarı/sola/sağa → dilim, bırak → seçilir;
  kısa dokun → seçili beceri çalışır. Her becerinin kendi bekleme süresi var. Yönlü beceriler 4 yöne aynı anda yayılır.
- `skills.js`: 12 tanım; çalışan 3'ü: Mürekkep Yelpazesi (6 sn), İnci Atışı (3,5 sn, canavara vurur), Kalkan Açılımı (10 sn, 4 yay mermi durdurur).
- **Açılma (s25, kullanıcı fikri bana bıraktı):** tek "Kaşif Puanı" çubuğu; dalışta kazanılan her puan birikir (canavar yenmek
  çok puan verir). Eşikler: Mürekkep 0 · İnci 300 · Kalkan 800 · Dokunaç 1500 · Akıntı 2400 · Kabarcık 3500 · Fener 5000 ·
  Kanca 6500 · Işık 8500 · Dönen 11000 · Girdap 14000 · Dev Okto Darbesi 18000. Açılan beceri boş yuvaya kendiliğinden girer.
- Menüde "Beceriler" paneli (kuşan/çıkar, kilitli olanlar ve eşikleri), bölüm kartında "Becerileri Değiştir", seçim profilde kayıtlı.
  Test adresinde `?beceri&xp=900` ile başlangıç puanı verilir (test adresi kaydetmez).
- Normal oyun değişmedi (mürekkep düğmesi duruyor). Sırada: kalan 9 beceri, kullanıcı onayıyla normal oyuna geçiş.

## iPhone'a özgü dersler (tekrar yaşama)
- **Ekran ölçümüyle oynama**: basit `innerWidth/innerHeight` + `resize` olayı kalsın. Periyodik yeniden boyutlandırma ve
  "gerçek ekran yüksekliği" denemeleri titreme ve kaymaya yol açtı.
- En alttaki ana ekran çubuğu şeridi oyuna verilmiyor; rengi **hesaplanarak** (`updateEdge`) sahne zeminine eşitlenir.
  Ekrandan piksel okuma yöntemi (inci, yıldırım geçince) şeridi boyuyordu, bırakıldı.
- Çentik payı (`safeTop`) ilk açılışta geç gelebilir: gizli `#safeProbe` kutusundan yarım saniyede bir okunur.
- Arka plana geçerken **AudioContext'i askıya alma** (bip sesi yaptı): müziği kısa sönümle durdur, dönünce yeniden başlat.
- Sarsıntı (`shake`) her durumda sönmeli; yalnızca oyun ve girdap sırasında uygulanır (yoksa ölünce ekran titrer).
- Oyun döngüsü korumalı: hata olsa da `requestAnimationFrame` devam eder; son hata duraklatma ekranında görünür.
- Service worker önce ağı dener (`no-cache`), ağ yoksa önbellek.

## Dosya yapısı
| Dosya | Görevi |
|---|---|
| `index.html` | Ekranlar (menü, yardım, mağaza, görevler, duraklatma, bölüm kartı, oyun sonu), stiller, açılış görseli bağlantıları |
| `game.js` | Oyun motoru: girdi, sesler (3 kademe, dalgıç nefesi), düşmanlar, bölümler, canavarlar, resif dünyası entegrasyonu, hediye/Dev Okto, mağaza ve görevler, HUD |
| `okto.js` | Okto karakter çizimi; ifadeler; 7 renk ve 7 aksesuar (`OktoChar.CATALOG`) |
| `zones.js` | 7 özel bölgenin mantığı ve çizimleri (akıntı, mağara karanlığı, batık gemi, bacalar, yosun, mayınlar, kovalayan fener balığı) |
| `enemies.js` | Düşman ve toplanabilir çizimleri |
| `bosses.js` | Canavar çizimleri (`DRAWERS`; çizimi olmayan canavar için geçici çizim) ve saldırı çizimleri |
| `boss-ai.js` | Canavar sistemi: tanımlar (`OktoBossAI.register`), ortak saldırı kütüphanesi, can eşiğiyle aşamalar, büyük/mini |
| `campaign.js` | Bölüm düzeni: `klasik` (varsayılan, s21) ve `grup` (3 bölüm + mini canavar, sonra büyük canavar; TASLAK) |
| `cinema.js` | Büyük canavar sinematik girişi ve büyük zafer kutlaması |
| `skills.js` | Beceri halkası denemesi: 12 beceri tanımı, halka girdisi, 3 çalışan beceri, düğme ve halka çizimi |
| `tests/regress.js` | Gerileme testleri (`node tests/regress.js`): her yayından önce çalıştır |
| `yedek/s21/` | Yeni altyapıdan önceki s21'in oynanabilir yedeği (dokunma) |
| `assets/` | Varlık listesi (`assets/README.md`) ve saydam PNG kopyaları (`assets/png`, `tools/export-assets.js` ile üretilir) |
| `reef.js` | Resif varlıkları (yosunlu/sivri/mağaralı ada, kanyon çıkıntısı), kanyon duvarı, uzak silüetler, ön plan mercanları, deniz tabanı |
| `title.js` | Animasyonlu, dokunmaya tepki veren açılış ekranı |
| `music.js` | Kodla üretilen açılış ve oyun içi müzikler (kullanıcı onayladı, kendi dosyası şimdilik iptal) |
| `sw.js`, `manifest.json` | Çevrimdışı çalışma ve kurulum |
| `splash/`, `apple-touch-icon.png`, `icon.svg` | iPhone açılış görselleri ve simgeler |
| `fonts/` | Fredoka yazı tipi (OFL) |
| `preview/` | Deneme sayfaları: `concepts.html` (bölge konsept panosu), `splash-gen.html`, `reef-test.html`, `title.html` |
| `docs/BRIF.md` | Tasarım brifi |
| `docs/MAGAZA.md`, `package.json`, `capacitor.config.json`, `scripts/` | Mağaza paketleme (Capacitor) |
| `docs/REFERANSLAR.md` | 19 referansın tek tek değerlendirmesi ve sahneleri (`docs/referanslar/`) |
| `YAPILACAKLAR.md` | Yapılacaklar ve fikir havuzu |

## Brif karşılaştırması ve eksikler (s21)
**Tamam:** dikey dalış, aşağıdan gelen engeller, derinlikle kararan su, Okto ve kostümleri, Dev Balon Balığı ve büyük mor
denizanası, askıda resifler (yosun, mercan, deniz yıldızı, mağara), yanlardan uzanan kayalıklar (dekor + küçük çarpışılabilir
çıkıntı, koridor açık), ekranda en fazla 3 resif, sevimli 2D stil, kabarcık ve parıltılar, 3 katmanlı parallax, HUD'un tüm öğeleri.

**Brifden farklı ama kullanıcı onayladı (aynen kalacak):**
- Okto dört yöne gider (brif: sağa-sola).
- Varlıklar ayrı resim dosyası değil, kodla çizilen modüller.
- Normal oyundaki küçük denizanaları pembe-mor (sadece canavarın yavruları mavi).
- Girdap geçişinde ekran bir an tamamen kararır.

**Karar: boyutlar bölüm bölüm değişir (s17'de uygulandı):** resif adacıkları ve kanyon çıkıntıları sabit oranda olmasın;
bazı bölümlerde/bölgelerde küçük (brifteki %12–18), bazılarında büyük olsun. Öneri: Bölüm 1 küçük ve seyrek, ilerledikçe
karışık boyutlar; bölge içinde de küçük-büyük karışımı.

**Eksik (kullanıcıya hatırlat, sonra konuşulacak):**
- [x] Varlıklar ayrı dosyalarda (s20): okto.js, enemies.js, bosses.js, reef.js, zones.js, title.js + 44 PNG (`assets/png`)
- [x] 19 referans tasarımın her biri için ayrı sahne ve değerlendirme: `docs/REFERANSLAR.md`, `docs/referanslar/`
- [x] Bölgeler (s19, `zones.js`): Güçlü Akıntı, Karanlık Mağara, Batık Gemi (gizli oda), Sıcak Bacalar, Yosun Ormanı, Mayın Tarlası, Kaçış Sahnesi. Bölüm 1: resif/kanyon/akıntı/yosun; Bölüm 2: + baca/gemi/mayın; Bölüm 3+: + mağara/kaçış
- [x] Oyun içi müzik: 3 kademe, kodla üretilir (s18); `music/oyun.mp3` konursa o çalar
- [x] Yıldızlı büyük bölüm ilerleme çubuğu (s17) · [x] zorluk ayarı: menüde Kolay / Normal / Zor (s17)
- [x] App Store / Google Play paketleme hazırlığı (Capacitor 6): `package.json`, `capacitor.config.json`, `scripts/build-www.js`, adım adım `docs/MAGAZA.md` (Android projesi oluşturma test edildi). Mağazaya yükleme kullanıcının Apple/Google hesabıyla yapılır.
