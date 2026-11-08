# Ritim — Proje Tarifi (sürüm 3)

Bu belge "Ritim" uygulamasının tek ve güncel tarifidir. Önceki tarif ile ChatGPT'de hazırlanan "Ürün yönü ve geliştirme talepleri" metni birleştirildi; çelişen noktalarda o metin esas alındı.
Herhangi bir yapay zekâ kodlama aracı ya da geliştirici bu belgeyi tek başına okuyup işe başlayabilmelidir.
Proje sahibi Türkçe konuşur ve yazılımcı değildir: teknik kararları sen ver, ona sade Türkçe açıkla, büyük kararlardan önce onay al.

---

## 1. Ürün özeti ve ilkeler
Ritim; kişisel, samimi bir **hayat ajandası ve nazik bir yaşam koçu**dur. Kişi gününü gün → hafta → ay → yıl olarak planlar; uygulama "şimdi ne yapmalıyım?" sorusunu cevaplar, yapılanları takip eder, haftalık karne çıkarır.

İlkeler:
1. **Global ürün, ilk dil Türkçe.** Farklı ülke ve yaşam düzenlerine uygun; altyapı baştan çeviriye hazır.
2. **Kişiden bağımsız.** Öğrenci, vardiyalı çalışan, ebeveyn, serbest çalışan, emekli… herkes kod değişikliği gerekmeden kendi düzenini kurar. Kimseye "ideal gün" dayatılmaz.
3. **Kontrol kullanıcıda.** Uygulama önerir; programı onaysız değiştirmez. Her yeniden planlama önce önizlenir, onaylanır, sonra geri alınabilir.
4. **Suçlamayan, sıcak dil.** Ertelemek, atlamak, kısa sürüm yapmak ya da planı bilinçli değiştirmek başarısızlık değildir. Seri bozulunca ceza hissi yok; ara sonrası geri dönüş kutlanır.
5. **Program gerçek hayata uyar.** Esneklik, kısa sürümler ve "Günüm değişti" bu yüzden çekirdek özelliktir.
6. **Geçişler ve animasyonlar ürünün kimliğidir.** Akıcı, yumuşak, keyifli; ama her zaman kapatılabilir.
7. **Sade arayüz.** Karmaşık tablo yok; temel kullanım basit, ayrıntılı ayarlar "ayrıntılar" altında.
8. **Cihazda çalışır.** İlk aşamada öneriler cihazdaki basit kurallarla üretilir; yapay zekâ veya sunucu zorunlu değildir.

## 2. Teknik tercih
- Telefona "Ana ekrana ekle" ile kurulabilen, çevrimdışı çalışan web uygulaması (PWA); telefon, tablet, bilgisayar.
- Önerilen yapı: Vite + React + TypeScript; animasyon için Framer Motion (veya eşdeğeri); tarih/tekrar işlemleri için güvenilir bir kütüphane (ör. Temporal polyfill veya date-fns-tz + rrule). Daha sade bir yol varsa öner.
- Veriler cihazda (IndexedDB). Tarayıcıdan kalıcı depolama izni iste; JSON yedekle/geri yükle zorunlu (yerel veri kaybına karşı).
- Hesap, sunucu ve cihazlar arası senkron sonraki fazda. Kişisel veri cihazdan izinsiz çıkmaz; analitik yok (ileride yalnızca açık rıza ile).
- Proje klasörü: /Volumes/8TB WD/CLAUDE ÇALIŞMALARI/Ritim. Proje dosyaları Mac'in iç diskine bırakılmaz (Node.js gibi araçlar Mac'e kurulabilir).

## 3. Dil, bölge ve zaman (i18n)
- Tüm arayüz metinleri tek bir çeviri kaynağında (ör. `locales/tr.json`); kodun içine dağınık metin yazılmaz. Çoğul ve değişkenli metinler çeviri sistemine uygun (ör. ICU mesaj biçimi).
- Tarih/saat biçimi, saat dilimi, haftanın ilk günü ve 12/24 saat gösterimi kullanıcı/bölge ayarından gelir; hiçbiri tek ülkeye sabitlenmez. Varsayılanlar cihaz diline/bölgesine göre.
- Yaz saati geçişleri ve saat dilimi değişikliği (seyahat) doğru işlenir; bloklar "yerel saat" olarak saklanır.
- Sağdan sola diller için düzen bozulmayacak şekilde mantıksal CSS (margin-inline vb.) kullan.

## 4. Veri modeli (kişiden bağımsız)
- **Profil:** bir cihazda birden çok profil; her biri kendi kategorileri, programı, hedefleri, notları, ayarları. Profiller arası isteğe bağlı PIN.
- **Kategori:** ad, renk, ikon; tamamen kullanıcı tanımlı. Yeni profil birkaç önerilen kategoriyle ya da boş başlayabilir.
- **Rutin blok (tekrarlayan şablon):** başlık, kategori, başlangıç saati, süre, tekrar kuralı (her gün, hafta içi, belirli günler, iki haftada bir, tarih aralığı…), isteğe bağlı çalışma/proje bağlantısı.
  - Esneklik bilgileri: saat **sabit mi esnek mi**, **öncelik** (düşük/orta/yüksek), **kısaltılabilir mi**, **başka güne taşınabilir mi**, **korunan zaman mı** (uyku, dinlenme, aile — otomatik daraltılmaz).
  - İsteğe bağlı **kısa sürümler** (bkz. 8).
- **Oluşum (occurrence):** bir rutinin belirli bir tarihteki örneği. Tek tarihlik istisnalar (taşındı, atlandı, süresi değişti) şablonu bozmadan burada saklanır.
- **Etkinlik / randevu (tek seferlik):** başlık, tarih, başlangıç–bitiş, isteğe bağlı açıklama ve konum; çok günlü olabilir.
- **Tarihli görev:** saati olmayabilen tek seferlik iş (son ödeme günü, doğum günü).
- **Gece yarısını aşan bloklar** (ör. 22:00–06:00 vardiya) ve günden güne değişen programlar desteklenir.
- **Durumlar:** planlandı · tamamlandı · kısa sürüm tamamlandı · ertelendi · atlandı (bilinçli) · iptal. Gerçekleşen süre ayrı tutulur.
- **Çalışma/proje:** "Gitar repertuarı", "Biyoloji dersi", "Kitap: X" gibi; bloklar buna bağlanır, "Kaldığım yer" notları buraya yazılır.
- **Hatırlatma:** bir bloğa/oluşuma/etkinliğe bağlı; kaynak değişince otomatik güncellenir, silinince silinir. Çift veya sahipsiz hatırlatma kalmaz.
- **İşlem geçmişi:** her değişiklik geri alınabilir (en azından son işlemler).

## 5. Örnek profil (yalnızca geliştirme ve deneme için)
"Ahmet" profili uygulamayı denemek için kullanılan **örnek veridir**; yeni kullanıcıların varsayılanı DEĞİLDİR. Ayarlar > Geliştirici bölümünden "Örnek profili yükle" ile eklenir. Müzik çalışmaları, mesai saatleri ve ibadet vakitleri yalnızca bu profile aittir.

Ahmet — hafta içi (Pzt–Cum):
- 06:30–07:00 Uyanış · S N
- 07:00–07:45 Hareket: Pzt güç · Sal yürüyüş · Çar güç · Per esneme/mobilite · Cum güç (kısa sürüm: 15 dk yürüyüş → 5 dk esneme)
- 07:45–08:15 Planlama & kahve · 08:15–09:00 Kahvaltı
- 09:00–12:30 Mesai (sabit) · 12:30–13:30 Yemek · Ö N · 13:30–17:00 Mesai (sabit; 15:34 İkindi kısa ara)
- 17:00–18:00 Mola · yürüyüş · 18:00–19:00 Serbest · 19:00–20:00 Akşam yemeği · A N
- 20:00–21:00 Akşam odağı: Pzt piyano & teori · Sal gitar repertuar · Çar kayıt işleri · Per video projeler · Cum beste (esnek, taşınabilir, kısa sürümlü)
- 21:00–21:15 15 dk piyano · 21:15–21:45 Pzt arrange · Sal teori/mix · Çar mix/render · Per serbest · Cum beste
- 21:45–22:00 Y N · ekranlar kapanır · 22:00–23:00 Okuma · 23:00 Uyku (korunan)
Cumartesi: aynı sabah; 09:00–12:30 aile, 12:30 aile yemeği · Ö N, 13:30–18:30 serbest, 18:30 arkadaşlar, 19:00 akşam yemeği · A N, 20:00 sosyal medya/içerik, 21:00 15 dk piyano, 21:45 Y N, 22:00 okuma, 23:00 uyku.
Pazar: aynı sabah (hareket yerine dinlenme); 09:00–12:30 aile, 12:30 aile yemeği · Ö N, 13:30–19:00 serbest, 19:00 akşam yemeği · A N, 20:00 karne & haftalık plan, 21:45 Y N, 22:00 okuma, 23:00 uyku.
(S N, Ö N, A N, Y N bu profile ait namaz vakitleridir.)

## 6. Görünümler (Gün → Hafta → Ay → Yıl)
Tek zaman ekseninde yakınlaşma/uzaklaşma; "kamera yaklaşıyor/uzaklaşıyor" hissi (iki parmakla kıstırma + düğmeler).
1. **Bugün:** tarih, el yazısı selam, ayın teması; büyük "ŞİMDİ" kartı (aktif blok ya da randevu, saat aralığı, kalan süre, "Tamamladım" / "Kısa sürümü yap" / "Bugün olmadı"); varsa "Kaldığım yer" notu; "Sırada" listesi; o günün tarihli görevleri; kolay ulaşılan **"Günüm değişti"** düğmesi.
2. **Hafta:** dikte 7 günlük sade şerit görünümü; **telefon yan çevrilince büyük haftalık tabloya etkileyici geçiş** (şeritler kâğıt gibi açılır). Bilgisayar/tablette tablo varsayılan. Düzenleme ve sürükleme bkz. 7 ve 12.
3. **Ay:** sade takvim; günlerde kategori renk noktaları, tamamlama oranı, randevu ve tarihli görev işaretleri; ayın teması ve hedefleri.
4. **Yıl:** 12 ay kartı; ay temaları, yıl hedeflerine katkı; etkinlik olan günler anlaşılır biçimde işaretli.
Her değişiklik tüm görünümlere anında yansır.

## 7. Randevu ekleme ve çakışma yönetimi
- Gün veya Hafta görünümünde bir saate dokununca o aralığa **randevu / etkinlik / tek seferlik görev** eklenir: başlık, tarih, başlangıç–bitiş; açıklama ve konum isteğe bağlı.
- Kaydedince: "Hatırlatma eklemek ister misin?" → Hayır · Tam vaktinde · 15 dk önce · 30 dk önce · Özel. Zorunlu değil.
- Randevu Gün/Hafta/Ay'da hemen görünür, Yıl'da o günün etkinlikli olduğu anlaşılır; vakti gelince "ŞİMDİ" kartına geçer.
- **Çakışma:** aynı saatte bir blok varsa sessizce silinmez, tamamlanmış sayılmaz. Örnek: "Bu saatte piyano çalışman var. Nasıl düzenleyelim?" seçenekleri:
  - Başka saate taşı (yalnızca boş ve uygun saatler önerilir; yeni çakışma yaratılmaz),
  - Uygun bir güne ertele,
  - Yalnızca bugün atla,
  - Çakışmayı bilerek koru.
  Uygun yer yoksa açıkça söylenir. Önce önizleme, sonra onay, ardından "Geri al".
- Tekrarlayan bloklarda varsayılan: **yalnızca o tarih** değişir. "Sonraki tüm tekrarlar" ayrı ve açık bir seçimdir.
- Randevu düzenlenir/iptal edilirse bağlı hatırlatmalar da güncellenir/silinir.
- Akış her tür etkinlik için aynıdır: sinema, doktor, ders, iş görüşmesi, aile buluşması…

## 8. Blokların kısa sürümleri
- Kullanıcı uygun bloklara isteğe bağlı kısa alternatifler tanımlar. Örnekler: Öğrenme 45 dk ders → 15 dk tekrar → 5 dk notlara bakma; Hareket 45 dk egzersiz → 15 dk yürüyüş → 5 dk esneme; Üretim 60 dk proje → tek bir alt işi bitir → sonraki adımı hazırla.
- Yoğun günlerde ve "Günüm değişti" akışında önerilir. Tamamlanınca başarı kutlaması verilir; raporda gerçekleşen süre doğru gösterilir.
- Randevular ve süresi/saati önemli yükümlülükler için kendiliğinden kısa sürüm oluşturulmaz. Bu ayarlar blok ayrıntılarındadır; temel kullanım sade kalır.

## 9. "Günüm değişti" (yeniden planlama)
- Bugün ekranındaki düğme → neden seç ("İş uzadı", "Yorgunum", "Acil iş çıktı", "Diğer") → isteğe bağlı "şu saatten sonra müsaitim".
- Uygulama kalan gün için gerçekçi bir düzen önerir: sabit randevular korunur; esnek bloklar kaydırılır, kısaltılabilenler kısa sürüme düşer, taşınabilenler başka güne önerilir; düşük öncelikliler atlanır. **Korunan zamanlar (uyku, dinlenme, aile vb.) sıkıştırılmaz.**
- Öneri önizlemede gösterilir; kullanıcı tek tek değiştirebilir, onaylar, sonra geri alabilir.
- "Yorgunum" seçilince ton daha yumuşak, öneri daha hafif olur (enerji modu bu akışın parçası).

## 10. "Kaldığım yer" notları
- Bir çalışma tamamlanınca isteğe bağlı kısa devam notu: "Üçüncü bölüm bitti, sırada alıştırmalar var."
- Not, bloğa bağlı **çalışma/projeye** kaydedilir (kategoriye değil); aynı kategorideki farklı çalışmaların notları karışmaz.
- Aynı çalışmanın sonraki oturumunda (ŞİMDİ kartında ve blok ayrıntılarında) gösterilir; geçmiş notlar listelenebilir.

## 11. Karne ve koçluk
- Pazar (ya da kullanıcının seçtiği gün) karnesi: tamamlama halkası, **planlanan ve gerçekleşen süreler**, kategori bazında ilerleme, en verimli gün, **sık ertelenen bloklar**, uygulanabilir öneriler.
- Durumlar ayrı gösterilir: tamamlandı · kısa sürüm · ertelendi · atlandı · bilinçli değişiklik. Bilinçli plan değişikliği başarısızlık sayılmaz.
- Öneriler gözleme dayanır ve dayanağı gösterilir: "Perşembe akşamı çalışman son 3 haftada 2 kez ertelendi. Cumartesi öğleden sonrayı denemek ister misin?" Yeterli veri yoksa (ör. 2 haftadan az) kesin yorum yapılmaz.
- Seri bozulunca ceza hissi yok; aradan sonra geri dönüş kutlanır.
- Koç dili kısa, sıcak, cesaretlendirici; yargılamaz.

## 12. Haftalık tabloda sürükle-bırak ve düzenleme
- Uzun basma → taşıma başlar; normal dokunma → ayrıntılar; kaydırırken yanlışlıkla taşıma olmaz. Bilgisayarda fareyle aynı işlem.
- Blok aynı günde başka saate ya da başka güne taşınabilir; taşırken hedef gün ve saat açıkça gösterilir; blok parmağı yumuşak animasyonla izler, bırakılacak alan belirginleşir.
- Bırakınca başlangıç ve bitiş güncellenir, süre korunur. Süre değiştirme bloğun kenarından ayrı bir hareketle.
- Çakışmada seçenek sunulur (bkz. 7); hiçbir blok kendiliğinden silinmez veya kaydırılmaz.
- Tekrarlayanlarda varsayılan yalnızca o tarih; sonraki tekrarlar ayrı seçim.
- Bağlı hatırlatmalar yeni saate göre güncellenir; diğer görünümler anında yansıtır.
- İşlemden sonra kısa süreli "Geri al".
- Sürükleyemeyenler için ayrıntılarda "Gün ve saati değiştir".
- Dik ve yatay haftalık görünümlerde desteklenir. Düzenleme modunda satır (saat) ekleme/silme, metin, kategori ve renk değişikliği.

## 13. Hedefler ve tarihli görevler
- Yıl hedefi (1–3) → aylık temalar → haftalık bloklar zinciri. Ay hedefi: tema + 2–4 ölçülebilir hedef. İlerleme karneye ve Yıl görünümüne yansır.
- Tarihli görevler (doğum günü, son ödeme, konser) tekrarlayan programdan ayrı tutulur, tüm görünümlerde görünür.

## 14. Alarmlı hatırlatmalar
- Tatlı, sevimli, başarı hissi veren; emir değil dostça dürtme.
- Her blokta, oluşumda, etkinlikte ve tarihli görevde isteğe bağlı; varsayılan kapalı. Bir rutinin tüm tekrarlarına tek dokunuşla eklenebilir.
- Zamanlama: tam vaktinde, 5/10/15/30 dk önce, özel; tarihli görevlerde 1 gün önce.
- Bildirim metni samimi (emoji yerine uygulama ikonları): "Gitar saatin geldi, parmaklar ısınsın mı?"
- Bildirim düğmeleri: "Başladım", "5 dk ertele", "Bugün olmadı".
- Yumuşak alarm sesleri (küçük çan, marimba…), sessiz/titreşim seçeneği, sessiz saatler.
- Başarı anı: kart "mühürlenir", hafif parıltı, kısa neşeli ses; gün tamamlanınca daha büyük kutlama; seri ve geri dönüş rozetleri. Abartısız, kapatılabilir.
- Teknik: kapalı uygulamada güvenilir alarm için sunucu tabanlı Web Push gerekir (iPhone'da ana ekrana eklenmiş PWA, iOS 16.4+). MVP'de alarmlı .ics dışa aktarma (VALARM) yedek yol olarak sunulsun; Web Push sunucusu ve ileride yerel uygulama sarmalayıcısı (ör. Capacitor) seçeneklerini proje sahibine sade dille açıkla ve seçtir. Bildirim izni ilk ihtiyaç anında, nedeniyle birlikte istenir.

## 15. Ayarlar
- Profil yönetimi; dil (şimdilik Türkçe), bölge, saat dilimi, haftanın ilk günü, 12/24 saat.
- Alarmlar: ses seçimi, seviye, sessiz saatler, kutlamaları aç/kapa.
- Ses: sekme ve ekran geçişlerinde yumuşak sesler (kâğıt çevirme, ahşap tık); aç/kapa, seviye; telefon sessizdeyken çalmaz.
- Renk modelleri (hepsi sıcak ve samimi): Krem Ajanda (varsayılan), Kil, Zeytin, Bal, Gece Kahvesi (koyu); otomatik gece modu.
- Yazı tipi modelleri: Samimi (Nunito + Caveat, varsayılan), Defter (Lora + Caveat), Yuvarlak (Quicksand + Caveat); yazı boyutu. Seçilen fontların hedef dillerin karakterlerini desteklediğinden emin ol.
- Hareket: "Animasyonları azalt" (sistem ayarına da uyar).
- Dışa aktarma: .ics, A4 yatay yazdırma, JSON yedek/geri yükle. Geliştirici: "Örnek profili yükle".

## 16. Tasarım dili (varsayılan: Krem Ajanda)
- Zemin `#F6F0E4`, kart `#FBF7EE`, kenar `#E6DCC8`, metin `#2E2A24`, ikincil `#6B6257`.
- Önerilen başlangıç kategori renkleri (açık zemin / koyu yazı / vurgu) — kullanıcı değiştirebilir:
  Yeşil `#DDE7D9`/`#3A5536`/`#6F8A6A` · Kiremit `#F3DFD3`/`#8A3C1E`/`#C2643F` · Hardal `#F5E6C4`/`#6E5110`/`#D9A93F` · Mavi `#DCE4F0`/`#2F4A73`/`#7A93B8` · Lacivert `#E1E4EC`/`#2F3B57`/`#3E4C6B` · Bej `#EDE3D1`/`#4A4136`/`#C9BB9F`.
- Gece Kahvesi: zemin `#221D19`, kart `#2E2722`, metin `#F3EBDD`, ikincil `#B8AC98`, vurgu `#E08A62`; siyah yok.
- Yuvarlak köşeler (kart 24px, satır 16px, düğme 14px), yumuşak gölgeler, ince çizgili ikonlar, emoji yok.
- Erişilebilirlik: dokunma hedefi ≥ 44px, kontrast ≥ 4.5:1, ekran okuyucu etiketleri, her sürükleme işleminin dokunarak yapılabilen alternatifi; renk tek başına anlam taşımaz.
- Görsel taslaklar Claude'daki "Ritim — İlk Ekranlar" tasarım alanında (Bugün, Hafta, Karne, Haftalık tablo, Dengeli hafta) — örnek profil verisiyle.

## 17. Geçiş ve animasyon kuralları
- Yakınlaşma = ayrıntıya inmek, uzaklaşma = büyük resme çıkmak.
- 250–450 ms, yumuşak/yaylanmalı; 60 fps hedef; takılma yok.
- Örnekler: tamamlanan kart "mühürlenir"; ertelenen blok kâğıt gibi kayarak yeni yerine gider; yan çevirmede hafta tablosu açılır; ay → yıl geçişinde günler küçülüp ay kartlarına dönüşür; sürüklenen blok parmağı yumuşakça izler.
- Ses ve titreşim animasyonla eşzamanlı, abartısız; "Animasyonları azalt" açıkken sade geçişler.

## 18. Görseller ve sesler
- Şimdilik görsel dosya yok: arayüz renk, yazı ve kodla çizilen ikonlarla yapılır. `assets/` altında görsel ve ses için isimlendirilmiş boş yuvalar bırak.
- Uygulama ikonu, karşılama illüstrasyonları, alarm ve geçiş sesleri iskelet çalıştıktan sonra eklenecek (sesleri proje sahibi kendi stüdyosunda kaydedebilir).

## 19. Uygulama sırası
Mevcut çalışan özellikleri koruyarak:
1. **Temel:** kişiden bağımsız veri modeli (profil, kategori, rutin + oluşum + istisna, etkinlik, durumlar, esneklik alanları, çalışma/proje, hatırlatma, işlem geçmişi), çeviriye hazır Türkçe arayüz, bölge/saat ayarları, yedekleme, örnek profil yükleme.
2. **Görünümler:** Bugün, Hafta (dik + yan çevirme geçişi), Ay, Yıl — sade sürümleri ve aralarındaki geçişler.
3. **Randevu ekleme**, görünümlere yansıtma, hatırlatma teklifi ve çakışma yönetimi.
4. **Haftalık tabloda sürükle-bırak**, süre değiştirme, "Geri al", "Gün ve saati değiştir".
5. **"Günüm değişti"** ve blokların kısa sürümleri.
6. **"Kaldığım yer"** notları.
7. **Alarmlar** (bildirim yolu kararıyla birlikte) ve başarı kutlamaları.
8. **Karne:** gerçekleşen veriye dayalı öneriler.
9. **Ayarlar** (renk/yazı modelleri, sesler, hareket) ve dışa aktarma (.ics, A4).
Sonraki fazlar: hedef zinciri ayrıntıları, vakte/gün doğumuna göre kayan bloklar (kullanıcı isterse), şablon kütüphanesi ve yaşam tarzı seçimli karşılama, ortak (aile/çift) bloklar, cihaz takvimini içe aktarma, hesap ve senkron, yeni diller.

## 20. Çalışma şekli
- Önce mevcut projeyi (varsa) bu tarif açısından incele; yoksa sıfırdan kur.
- Yapılacakları ve önemli kararları 5–6 maddelik sade Türkçe bir planla açıkla; onay al; küçük adımlarla uygula.
- Her adımda uygulamayı çalıştır ve telefonda açılacak adresi ver (aynı Wi-Fi'de yerel ağ adresi).
- Çakışma, tekrar istisnası, gece yarısını aşan blok, yaz saati ve yeniden planlama kuralları için otomatik testler yaz.
- Git kullan, anlamlı commit'ler at. Sırları/şifreleri dosyalara yazma.
