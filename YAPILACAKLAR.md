# 🐙 Okto: Yapılacaklar Listesi

Oyun yayında: https://ahmet85.github.io/Ahmet85/ (GitHub Pages, dal: `claude/octopus-mobile-game-0is63u`)

## Sıradaki işler
- [x] **Müzik:** Kodla üretilen müzikler kalıyor (kullanıcı kararı); kendi dosyası şimdilik iptal. İstenirse `music/README.md`.
- [ ] **Kol fırlatma yerine yeni bir hareket:** karar verilecek (fikirler: hızlı atılma/dash, mürekkep kalkanı, kabarcık tuzağı).
- [ ] Oyunu gerçek telefonda deneyip zorluk ayarı (dev kalamar canı, düşman sıklığı, mağaza fiyatları).

## Bölge fikirleri (konsept: preview/concepts.html)
Her bölüm rastgele birleşen bölgelerden oluşsun, araya sakin "dinlenme" parçaları girsin:
1. Kayalık Geçit (çarpınca can gider) · 2. Güçlü Akıntı · 3. Karanlık Mağara · 4. Batık Gemi (gizli oda)
5. Sıcak Bacalar (uyarılı püskürme) · 6. Yosun Ormanı (yavaşlatır, saklar) · 7. Mayın Tarlası (mürekkeple zincirleme patlatma)
8. Kaçış Sahnesi (dev canlı kovalar)
9. Resif Adacıkları ✅ (s13) · 10. Mercan Kanyonu ✅ (s13): kullanıcının 19 referans görseline göre, `reef.js`
Tüm bölgeler oyunda ✅ (s19, `zones.js`)

## Fikir havuzu
- App Store / Google Play için Capacitor ile paketleme
- Yeni kostümler (şapkalar, desenler), başarımlar/rozetler

## Tamamlananlar
- [x] Oyunun ilk sürümü (inci, balık, düşmanlar, mürekkep, güçlendirmeler, PWA)
- [x] GitHub Pages ile yayın, iPhone ana ekranına ekleme
- [x] Animasyonlu açılış ekranı: muzip pembe Okto, sualtı sahnesi, OKTO başlığı (`title.js`)
- [x] Geçici açılış müziği (kodla üretilmiş marimba ezgisi, `music.js`); "Müziği aç" / sessiz düğmesi
- [x] Oyun içi Okto açılıştakiyle aynı karakter (`okto.js`), göreli parmak kontrolü
- [x] Işık Midyesi: yenince ışık bombası, ekrandaki tüm düşmanları yok eder
- [x] Derinliğe göre 3 ses kademesi (Güneşli Sular / Alacakaranlık / Karanlık Derinlikler)
- [x] Dalgıç sesleri: nefes alma tıslaması + kabarcıklı nefes verme döngüsü, yüzerken kabarcık sesleri
- [x] İnci mağazası: 7 renk, 7 aksesuar; inciler cüzdanda birikir
- [x] Günlük görevler (her gün 3 görev) + günlük giriş hediyesi (seri büyür)
- [x] Bölüm sistemi: Bölüm 1 (0–150 m) Dev Balon Balığı · Bölüm 2 (150–400 m) Elektrikli Denizanası · Bölüm 3 (400–700 m) Dev Kalamar · sonra her 300 m sonsuz bölümler
- [x] Bölüm sonu: yıldızlı özet kartı (inci hedefi, az hasar), bölüm ödülü, girdap geçiş animasyonu, yeni bölüm tanıtımı
- [x] Açılış ekranında etkileşim: Okto'ya dokununca tepkiler, gözleriyle parmağı izler, balıklar kaçar ve Okto güler
- [x] Hediye kutuları ve Altın Karides: 6 sn Dev Okto (dokunulmaz, düşmanları ezer, canavara çarparak hasar verir)
- [x] Kayıt noktası: yanınca bölüm başından devam; menüde "Bölüm N'den başla" seçici

## Notlar
- Sürüm numarası menünün sağ alt köşesinde (ör. `s11`). Her güncellemede `index.html` içindeki `?v=` ve `sw.js` içindeki `okto-v` birlikte artırılır.
- iPhone açılış görselleri `splash/` klasöründe; `preview/splash-gen.html` ile yeniden üretilebilir.
