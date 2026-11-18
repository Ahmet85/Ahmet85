// Ritim içeriği: özlü sözler, koçun hazır yolları, kutu paketleri.
// Her adım: t = günün görevi, s = aynı adımın küçültülmüş hâli (üst üste
// atlanırsa koç bunu önerir).
(function (root) {
  // Sözler Bahçesi'nden, bu uygulamanın ruhuna uyanlar
  const QUOTES = [
    ['Yıpranmak paslanmaktan iyidir.', 'Bishop Cumberland'],
    ['Önemli olan yere düşüp düşmemen değil, tekrar ayağa kalkıp kalkmamandır.', 'Vince Lombardi'],
    ['Ya bir yol bul, ya bir yol aç, ya da yoldan çekil.', 'Konfüçyüs'],
    ['Öğretmek, iki defa öğrenmek demektir.', 'J. Joubert'],
    ['Yaşadığımız her an kendi hakkını ister.', 'Goethe'],
    ['Rüyaları gerçekleştirmenin en kısa yolu uyanmaktır.', 'Emerson'],
    ['Kaptanın ustalığı deniz durgunken anlaşılmaz.', 'Lukianos'],
    ['Umutla yolculuk etmek, varmaktan çok daha güzeldir.', 'R. L. Stevenson'],
    ['Peşlerinden gidecek cesaretiniz varsa, bütün rüyalar gerçek olabilir.', 'Walt Disney'],
    ['Bir şeyi ezberlemek, bilmek demek değildir.', 'Montaigne'],
    ['Metodu olan topal, metotsuz koşandan daha çabuk ilerler.', 'Francis Bacon'],
    ['Daha iyi olmaya çalışmayan, iyi olarak da kalamaz.', 'Oliver Cromwell'],
    ['Dehanın onda biri hayal gücü, onda dokuzu alın teridir.', 'Anonim'],
    ['Dinlemesini bilenler, ülkeleri fethetmesini bilenlerden daha büyüktürler.', 'Franklin'],
    ['Elmas nasıl yontulmadan mükemmelleşmezse, insan da acı çekmeden olgunlaşmaz.', 'Konfüçyüs'],
    ['Geleceği satın alabilecek tek şey bugündür.', 'Samuel Johnson'],
    ['Gideceğiniz yeri bilmiyorsanız, vardığınız yerin önemi yoktur.', 'Peter F. Drucker'],
    ['Kendine hâkim olan, başkalarına da hâkim olur.', 'Konfüçyüs'],
    ['Herkes evinin önünü süpürürse sokaklar temiz olur.', 'Konfüçyüs'],
    ['Herkes insanlığı değiştirmeyi düşünür. Ama kimse önce kendisini değiştirmeyi düşünmez.', 'Victor Hugo'],
    ['İlim aşağıdakileri yükseltir, cahillik yüksektekileri alçaltır.', 'Sokrates'],
    ['İnandığınız gibi yaşamazsanız, yaşadığınız gibi inanmaya başlarsınız.', 'Hz. Ömer (r.a.)'],
    ['İnsan ancak yüreğiyle baktığı zaman gerçeği görebilir.', 'Exupéry'],
    ['İyi görüneceğine, iyi ol.', 'Sallust'],
    ['Karanlığa küfretmektense, küçük bir ışık yakın.', 'André Gide'],
    ['Kaybedilmiş günlerin en kötüsü, bir defacık olsun gülmeden geçirilenidir.', 'Chamfort'],
    ['Kıyıyı gözden kaybetmeye cesaret etmedikçe insan yeni okyanuslar keşfedemez.', 'André Gide'],
    ['Kitaplardan önce kendimizi okumaya çalışalım.', 'Mevlânâ'],
    ['Yüzünü güneşe çeviren insan, gölge görmez.', 'Helen Keller'],
  ];

  const COLORS = { namaz: '#0d9488', hareket: '#2563eb', rutin: '#7c3aed', yemek: '#d97706', mesai: '#16a34a', muzik: '#e11d48', dinlen: '#475569', su: '#0284c7', altin: '#b8860b' };
  const S = (t, s) => ({ t, s });

  // ---- Koçun yolları ----
  const PATHS = {
    muzik: {
      key: 'muzik', name: 'Müzik', em: '🎹', c: COLORS.muzik,
      // Müzisyen için: bilmediğin konulardan kurulan "Derinleş" yolu
      topics: {
        kulak: { name: 'Kulak eğitimi', steps: [
          S('Bir şarkının ilk iki ölçüsünü enstrümansız mırıldan, sonra enstrümanda bul.', 'Bir şarkının tek bir notasını enstrümanda bul.'),
          S('10 dakika aralık çalış: iki nota çal, aralığı adını söyleyerek tahmin et (2’li, 3’lü, 5’li).', 'Yalnızca 3’lü ve 5’li aralığı 5’er kez dinle.'),
          S('Sevdiğin bir parçanın bas yürüyüşünü kulaktan çıkar (ilk 8 ölçü).', 'Parçanın yalnızca ilk bas notasını bul.'),
          S('Bir melodiyi dinle ve notalarını yazmadan önce solfej heceleriyle söyle.', 'Melodinin yalnızca ilk cümlesini söyle.'),
          S('Majör, minör, eksik ve artık akorları karışık çal; gözün kapalı tanı.', 'Yalnızca majör ile minörü ayırt et.'),
        ] },
        armoni: { name: 'Armoni', steps: [
          S('Bildiğin bir şarkının akorlarını derece olarak yaz (I, IV, V, vi…).', 'Şarkının yalnızca ilk iki akorunun derecesini yaz.'),
          S('Aynı şarkıda bir akoru vekiliyle değiştir (ör. IV yerine ii) ve farkı dinle.', 'Tek bir akoru 7’li yap ve dinle.'),
          S('ii–V–I kalıbını üç farklı tonda çal.', 'ii–V–I’i tek tonda, yavaşça çal.'),
          S('Bir melodiye iki farklı akor yürüyüşü yaz; hangisi daha çok duygu taşıyor, not et.', 'Melodinin tek ölçüsüne farklı bir akor dene.'),
          S('Ödünç akor dene: majör tonda minörden bir akor (ör. iv) kullan.', 'Majör bir şarkıda IV’ü minör çal ve dinle.'),
        ] },
        ritim: { name: 'Ritim', steps: [
          S('Metronomu 60’a kur; 5 dakika yalnızca 2 ve 4’te alkış tut.', 'Metronomla 1 dakika 2 ve 4’te alkış tut.'),
          S('Türk müziğinden bir aksak usul seç (9/8 ya da 7/8) ve 10 dakika elle vur.', '9/8’i “2+2+2+3” sayarak 2 dakika vur.'),
          S('Bildiğin bir parçayı metronom yarı hızdayken çal; boşlukları sen doldur.', 'Parçanın yalnızca nakaratını yarı hızda çal.'),
          S('Üçleme üzerine ikilik (3’e 2) poliritmi: sağ el 3, sol el 2.', 'Önce yalnızca dizine vurarak 3’e 2’yi dene.'),
          S('Kendini 1 dakika kaydet, metronomla karşılaştır: nerede acele ediyorsun?', '30 saniye kaydet ve yalnızca dinle.'),
        ] },
        mix: { name: 'Kayıt ve mix', steps: [
          S('Sevdiğin bir kaydı referans al: bas, vokal ve davulun ses seviyelerini kâğıda çiz.', 'Referans kayıtta yalnızca vokalin nerede durduğunu dinle.'),
          S('Bir kanalda yalnızca EQ ile “kes”: 200–400 Hz arasını tara, çamuru bul ve azalt.', 'Tek bir kanalda alt kesim (high-pass) filtresi dene.'),
          S('Kompresörü abartarak dinle (oran 8:1), sonra normale çek; ne değişti, yaz.', 'Kompresörü açıp kapatıp yalnızca farkı dinle.'),
          S('Aynı mix’i telefonda, kulaklıkta ve arabada dinle; üç not al.', 'Mix’i yalnızca telefon hoparlöründe dinle.'),
          S('Bir projede reverb’i gönderme (send) kanalından kullan; hepsini aynı odaya koy.', 'Tek bir enstrümana kısa bir oda reverb’ü ekle.'),
        ] },
        turler: { name: 'Yeni türler', steps: [
          S('Hiç dinlemediğin bir türden bir parça dinle; seni şaşırtan üç şeyi not et.', 'Yeni bir türden bir parçanın ilk dakikasını dinle.'),
          S('O türden kısa bir ritim ya da cümle kalıbını kendi enstrümanında taklit et.', 'Kalıbı yalnızca mırıldan.'),
          S('Bir Türk makamı seç (Hicaz, Uşşak, Rast); dizisini çal ve bir seyir dene.', 'Makamın dizisini bir kez inici, bir kez çıkıcı çal.'),
          S('Caz standartlarından birinin temasını öğren (ör. Autumn Leaves ilk 8 ölçü).', 'Temayı yalnızca dinle ve eşlik ederek mırıldan.'),
          S('Bir film müziğini dinle: hangi enstrüman hangi duyguyu taşıyor, yaz.', 'Bir sahne müziğini gözün kapalı dinle.'),
        ] },
        dogaclama: { name: 'Doğaçlama ve beste', steps: [
          S('Tek akor üzerinde 5 dakika doğaçla; yalnızca üç nota kullan.', 'Tek akor üzerinde 1 dakika, iki notayla çal.'),
          S('Dört ölçülük bir motif yaz; sonra onu tersinden ve yarı hızda çal.', 'İki ölçülük bir motif mırıldan ve telefona kaydet.'),
          S('Soru–cevap: iki ölçü soru çal, iki ölçü cevap ver. 10 kez.', 'Soru–cevabı 3 kez dene.'),
          S('Bugünün duygusunu 30 saniyelik bir ezgiyle anlat ve kaydet.', '10 saniyelik bir fikir kaydet.'),
          S('Eski bir fikir kaydını aç; ona B bölümü yaz.', 'Eski bir fikir kaydını yalnızca dinle, bir cümle not al.'),
        ] },
      },
      basla: [
        S('Hangi enstrümanı çalmak istediğine karar ver; üç kısa video izle.', 'Tek bir video izle.'),
        S('Yakınında bir kurs ya da öğretmen araştır; iki seçenek not et.', 'Yalnızca bir arama yap, bir isim not et.'),
        S('Bir deneme dersi için ara ya da mesaj at.', 'Arayacağın numarayı bul ve kaydet.'),
        S('Ödünç ya da kiralık enstrüman bul; satın almak için acele etme.', 'Bir tanıdığına “enstrümanın var mı” diye sor.'),
        S('İlk dersini al ya da ilk 15 dakikalık çalışmanı yap.', '5 dakika yalnızca ses çıkar, keyfini çıkar.'),
        S('Üç gün üst üste 10’ar dakika çalış.', 'Bugün 5 dakika çalış.'),
        S('İlk basit ezgini baştan sona çal ve kaydet.', 'Ezginin ilk cümlesini çal.'),
        S('Bir ay sonraki hedefini yaz: hangi parçayı çalmak istiyorsun?', 'Sevdiğin bir parçayı “hedef” diye not et.'),
      ],
    },
    tenis: {
      key: 'tenis', name: 'Tenis', em: '🎾', c: '#65a30d',
      basla: [
        S('10 dakikalık bir “yeni başlayanlar için tenis” videosu izle.', 'Videonun yalnızca ilk 3 dakikasını izle.'),
        S('Şehrindeki tenis kortlarını ve kulüplerini araştır; iki tanesini not et.', 'Haritada “tenis kortu” ara, birini kaydet.'),
        S('Bir kulübü ara ya da yaz: deneme dersi var mı, fiyatı ne?', 'Yalnızca telefon numarasını bul ve kaydet.'),
        S('Raket satın alma; kulüpten ya da bir arkadaştan ödünç raket ayarla.', 'Bir tanıdığına “raketin var mı” diye sor.'),
        S('Rahat bir spor ayakkabı ve kıyafet hazırla; çantanı kapının önüne koy.', 'Ayakkabını çıkar, görünür bir yere koy.'),
        S('Deneme dersine yazıl ve takvime gün koy.', 'Uygun olduğun iki günü not et.'),
        S('İlk dersine git. Tek hedef: topa vurmanın tadını çıkarmak.', 'Korta git ve 10 dakika izle.'),
        S('Evde duvar önünde 5 dakika gölge vuruş: forehand ve backhand.', '10 kez gölge forehand yap.'),
        S('Hazırlık hareketi: 10 dakika bilek, omuz ve bacak esnetme.', '3 dakika omuz ve bilek çevir.'),
        S('İkinci derse yazıl; öğretmenine tek bir soru hazırla.', 'Sormak istediğin soruyu not et.'),
        S('Bir profesyonel maçın 15 dakikasını izle; ayak hareketlerine bak.', 'Maçtan 5 dakika izle.'),
        S('Haftada bir gün tenis için sabit bir saat belirle ve kutusunu ekle.', 'Sana uyan günü seç.'),
      ],
      derin: [
        S('Servisini 20 top at ve kaydet; top atışının yüksekliğine bak.', '10 servis at.'),
        S('Duvara karşı 10 dakika yalnızca backhand çalış.', '5 dakika duvar çalış.'),
        S('Ayak çalışması: split step ile 3 dakikalık üç set.', 'Tek set split step yap.'),
        S('Bir maçını ya da antrenmanını kaydet; üç tekrar eden hatayı yaz.', 'Bir tek hatanı not et.'),
        S('Voleyi geliştirmek için filede 15 dakika çalış.', '5 dakika vole çalış.'),
        S('Senden biraz iyi biriyle maç ayarla.', 'Kiminle oynayabileceğini düşün, mesaj at.'),
        S('Kondisyon: 20 dakikalık aralıklı koşu.', '10 dakika tempolu yürüyüş.'),
        S('İkinci servisine topspin ekle; 20 deneme.', '10 deneme yap.'),
      ],
    },
    eskrim: {
      key: 'eskrim', name: 'Eskrim', em: '🤺', c: '#4f46e5',
      basla: [
        S('10 dakikalık bir eskrim tanıtım videosu izle: flöre, epe, kılıç farkı ne?', 'Yalnızca 3 dakika izle.'),
        S('Hangi silah sana yakın geldi? Bir cümleyle neden, not et.', 'Sadece adını not et.'),
        S('Şehrindeki eskrim kulüplerini araştır (federasyon sitesi ve harita).', 'Haritada “eskrim” ara, birini kaydet.'),
        S('Bir kulübü ara: yetişkin başlangıç grubu var mı, deneme dersi ne zaman?', 'Yalnızca numarayı bul ve kaydet.'),
        S('Malzeme alma; kulüpler ilk derslerde maske ve silah verir. Bunu teyit et.', 'Soracağın soruyu not et.'),
        S('Temel duruşu (gard) aynada 5 dakika dene: dizler kırık, ağırlık ortada.', '1 dakika gard duruşu.'),
        S('Evde 5 dakika ileri–geri adım (marş ve rompe) çalış.', '10 adım ileri, 10 adım geri.'),
        S('Deneme dersine yazıl ve takvime gün koy.', 'Uygun iki günü not et.'),
        S('İlk dersine git. Tek hedef: merak etmek ve eğlenmek.', 'Salona git ve bir antrenmanı izle.'),
        S('Bacaklar için: 3 set 10 hamle (lunge), yavaş ve dengeli.', 'Tek set 6 hamle.'),
        S('Bir olimpiyat maçının 10 dakikasını izle; puan nasıl alınıyor, anla.', '3 dakika izle.'),
        S('Haftada bir gün eskrim için sabit saat belirle ve kutusunu ekle.', 'Sana uyan günü seç.'),
      ],
      derin: [
        S('Mesafe çalışması: hedefe 20 hamle, her biri tam uzanışla.', '10 hamle.'),
        S('Parad–ripost kalıbını bir partnerle 15 dakika çalış.', 'Hareketi aynada 10 kez yap.'),
        S('Bir maçını kaydet; kaybettiğin üç dokunuşun nedenini yaz.', 'Tek bir dokunuşu incele.'),
        S('Ayak çalışması: 3 dakikalık üç set, tempo değiştirerek.', 'Tek set.'),
        S('Senden deneyimli biriyle 5 dokunuşluk maç yap.', 'Antrenörden bir tavsiye iste.'),
        S('Kondisyon: 15 dakika ip atlama ve çömelme.', '5 dakika ip atla.'),
      ],
    },
    balik: {
      key: 'balik', name: 'Balık tutma', em: '🎣', c: '#0891b2',
      basla: [
        S('Yakınında balık tutulabilen iki yer araştır (iskele, göl, kıyı).', 'Bir yer adı not et.'),
        S('Yeni başlayan için gereken en sade takımı öğren: olta, misina, iğne, kurşun.', 'Bir tanıtım videosu izle.'),
        S('Bir balıkçı malzemecisine uğra; “yeni başlıyorum” de, tavsiye iste.', 'En yakın malzemeciyi haritada bul.'),
        S('Temel bir iğne düğümü öğren ve 5 kez bağla.', 'Düğümü bir kez bağla.'),
        S('Bölgendeki av yasaklarını ve boy sınırlarını oku.', 'Yasak dönemleri gösteren sayfayı kaydet.'),
        S('Deneyimli biriyle ya da tek başına ilk kez oltayı at; 1 saat yeter.', 'Kıyıya git, balık tutanları izle.'),
        S('İlk gününü yaz: saat, hava, yem, sonuç.', 'Tek cümle not al.'),
        S('Bir sonraki gidiş için gün belirle ve kutusunu ekle.', 'Uygun günü seç.'),
      ],
      derin: [
        S('Yeni bir düğüm öğren (ör. FG ya da Palomar) ve 10 kez bağla.', 'Düğümü 3 kez bağla.'),
        S('Av günlüğü tut: saat, hava, rüzgâr, yem, derinlik, sonuç.', 'Son avından üç şeyi yaz.'),
        S('Hiç denemediğin bir teknik seç (spin, LRF, surf) ve bir video izle.', 'Tekniğin adını ve neden merak ettiğini yaz.'),
        S('Hedef balığın mevsimini ve beslenme saatlerini araştır.', 'Bir kaynak oku, tek bilgi not et.'),
        S('Takım bakımı: makineni temizle, misinayı kontrol et, iğneleri bile.', 'Yalnızca misinayı kontrol et.'),
        S('Yeni bir mera keşfet: haritada derinlik ve akıntıya bak, gidip gör.', 'Haritada bir yer işaretle.'),
        S('Yapay yem ya da kendi takımını hazırla.', 'Bir takım şeması çiz.'),
        S('Tut–bırak dene: bir balığı zarar vermeden geri bırak.', 'Doğru bırakma yöntemini oku.'),
        S('Bir ustayla konuş ya da bir foruma soru yaz.', 'Soracağın soruyu not et.'),
        S('Avını kendin temizle ve yeni bir tarifle pişir.', 'Bir tarif seç.'),
      ],
    },
    kosu: { key: 'kosu', name: 'Koşu ve yürüyüş', em: '🏃', c: COLORS.hareket, basla: [
      S('Rahat bir ayakkabı hazırla ve 15 dakika tempolu yürü.', '5 dakika yürü.'),
      S('1 dakika koş, 2 dakika yürü; 6 tekrar.', '3 tekrar yap.'),
      S('Yakınında düz ve güvenli bir parkur bul.', 'Haritada bir yer seç.'),
      S('2 dakika koş, 2 dakika yürü; 5 tekrar.', '3 tekrar yap.'),
      S('Koşudan sonra 5 dakika baldır ve kalça esnet.', '2 dakika esne.'),
      S('Durmadan 10 dakika yavaş koş.', '5 dakika koş.'),
      S('Haftalık üç gün seç ve kutusunu ekle.', 'Tek gün seç.'),
      S('Durmadan 20 dakika koş; hız önemli değil.', '12 dakika koş.'),
    ] },
    okuma: { key: 'okuma', name: 'Okuma', em: '📖', c: COLORS.dinlen, basla: [
      S('Okumak istediğin üç kitabı yaz; birini seç.', 'Tek bir kitap adı yaz.'),
      S('Kitabı yastığının yanına koy; bu akşam 10 sayfa oku.', '2 sayfa oku.'),
      S('Okurken bir cümlenin altını çiz ve nedenini yaz.', 'Bir cümlenin altını çiz.'),
      S('Telefonu başka odaya bırakıp 20 dakika oku.', '10 dakika oku.'),
      S('Okuduğunu birine iki cümleyle anlat.', 'Kendine tek cümleyle özetle.'),
      S('Bitirince sıradaki kitabı seç; arada boşluk bırakma.', 'Sıradaki kitabı not et.'),
      S('Farklı bir türden kısa bir kitap dene.', 'Bir öykü oku.'),
      S('Ayda kaç kitap istediğine karar ver ve kutusunu ekle.', 'Günlük sayfa hedefi koy.'),
    ] },
    dil: { key: 'dil', name: 'Yabancı dil', em: '🗣️', c: '#9333ea', basla: [
      S('Hangi dili, ne için öğrenmek istiyorsun? Tek cümle yaz.', 'Dilin adını yaz.'),
      S('Günlük hayattan 10 kelime öğren ve sesli söyle.', '5 kelime öğren.'),
      S('O dilde bir şarkı dinle; anladığın üç kelimeyi yaz.', 'Şarkıyı bir kez dinle.'),
      S('Kendini tanıtan beş cümle yaz ve sesli oku.', 'İki cümle yaz.'),
      S('Altyazılı kısa bir video izle; bir cümleyi tekrar et.', '3 dakika izle.'),
      S('Bir konuşma partneri ya da kurs araştır.', 'Bir seçenek not et.'),
      S('Telefonundaki bir uygulamanın dilini o dile çevir.', 'Bir uygulamada 5 dakika alıştırma yap.'),
      S('Bir hafta boyunca her gün 10 dakika: kutusunu ekle.', 'Günde 5 dakika hedefi koy.'),
    ] },
    resim: { key: 'resim', name: 'Resim ve çizim', em: '🎨', c: '#db2777', basla: [
      S('Bir kalem ve kâğıtla önündeki bir nesneyi 10 dakika çiz.', '3 dakika karala.'),
      S('Yalnızca çizgilerle (gölgesiz) elini çiz.', 'Tek parmağını çiz.'),
      S('Işık ve gölge: bir yumurtayı ya da topu gölgeleriyle çiz.', 'Bir daire çiz, tek gölge koy.'),
      S('Bir ressamın işine 5 dakika bak; neyi sevdiğini yaz.', 'Bir tabloya 1 dakika bak.'),
      S('Dışarıda 15 dakika eskiz yap.', 'Pencereden gördüğünü 5 dakika çiz.'),
      S('Renk dene: üç renkle küçük bir çalışma.', 'İki rengi karıştır.'),
      S('Bir atölye ya da çevrim içi ders araştır.', 'Bir video ders izle.'),
      S('Çizdiklerinden birini duvara as.', 'En sevdiğin çizimi seç.'),
    ] },
    yemek: { key: 'yemek', name: 'Yemek yapma', em: '🍳', c: COLORS.yemek, basla: [
      S('Hiç yapmadığın bir tarif seç ve malzemeleri yaz.', 'Bir tarif adı not et.'),
      S('Bıçak tekniği: bir soğanı doğru şekilde doğramayı öğren.', 'Kısa bir video izle.'),
      S('Tarifi yap; tadına bak, bir şeyi değiştirirdim de.', 'Tarifin yarısını hazırla.'),
      S('Temel bir sos öğren (domates sosu ya da beşamel).', 'Sosun tarifini oku.'),
      S('Başka bir mutfaktan bir yemek dene.', 'Bir baharat tanı ve kokla.'),
      S('Sevdiğin birine yemek yap.', 'Kimi davet edeceğini düşün.'),
      S('Hamur işi dene: ekmek ya da poğaça.', 'Tarifi oku ve malzemeleri hazırla.'),
      S('Haftada bir “yeni tarif günü” kutusu ekle.', 'Günü seç.'),
    ] },
    yuzme: { key: 'yuzme', name: 'Yüzme', em: '🏊', c: COLORS.su, basla: [
      S('Yakınındaki havuzları ve seans saatlerini araştır.', 'Bir havuz adı not et.'),
      S('Bone, gözlük ve mayonu hazırla.', 'Eksik olanı not et.'),
      S('Bir seansa git; 20 dakika suda kal, nefes çalış.', 'Havuza git ve fiyat sor.'),
      S('Suda nefes verme: 10 kez yüzünü suya koyup üfle.', '5 kez dene.'),
      S('Bir yetişkin kursu ya da özel ders araştır.', 'Bir seçenek not et.'),
      S('Tahta ile 4 boy ayak vuruşu.', '2 boy.'),
      S('Durmadan bir boy serbest yüz.', 'Yarım boy yüz.'),
      S('Haftada iki gün seç ve kutusunu ekle.', 'Tek gün seç.'),
    ] },
    fotograf: { key: 'fotograf', name: 'Fotoğraf', em: '📷', c: '#0f766e', basla: [
      S('Telefonla bugün yalnızca ışığa dikkat ederek 10 kare çek.', '3 kare çek.'),
      S('Üçler kuralını öğren ve 5 kare dene.', '2 kare dene.'),
      S('Aynı nesneyi beş farklı açıdan çek.', 'İki açıdan çek.'),
      S('Altın saatte (gün batımı) 15 dakika çekim yap.', 'Gün batımında tek kare çek.'),
      S('En iyi üç kareni seç; neden iyi olduklarını yaz.', 'Tek kare seç.'),
      S('Bir fotoğrafçının işine bak ve bir karesini taklit et.', 'Beğendiğin bir kareyi kaydet.'),
      S('Bir kareni düzenle: kırp, ışığı ayarla.', 'Yalnızca kırp.'),
      S('Bir temayla (kapılar, eller, gölgeler) bir haftalık seri başlat.', 'Temanı seç.'),
    ] },
    yazi: { key: 'yazi', name: 'Yazı yazma', em: '✍️', c: '#57534e', basla: [
      S('10 dakika durmadan yaz; konu serbest, silmek yok.', '3 dakika yaz.'),
      S('Bugün gördüğün bir anı beş cümleyle anlat.', 'İki cümle yaz.'),
      S('Sevdiğin bir yazarın bir paragrafını elle kopyala.', 'Tek cümlesini kopyala.'),
      S('Bir anını diyalogla yaz.', 'Üç satırlık bir diyalog yaz.'),
      S('Dünkü yazını oku ve bir cümleyi daha iyi yaz.', 'Bir kelimeyi değiştir.'),
      S('Kısa bir öykü fikri bul: kim, ne istiyor, engel ne?', 'Tek cümlelik fikir yaz.'),
      S('Yazdığın bir şeyi birine okut.', 'Kime okutacağını düşün.'),
      S('Sabah ya da akşam 10 dakikalık yazı kutusu ekle.', 'Saatini seç.'),
    ] },
    bahce: { key: 'bahce', name: 'Bahçe ve bitki', em: '🌱', c: '#15803d', basla: [
      S('Evinin ışığına uygun kolay bir bitki araştır.', 'Bir bitki adı not et.'),
      S('Bir saksı, toprak ve bir bitki ya da tohum al.', 'Nereden alacağını bul.'),
      S('Bitkiyi dik; sulama sıklığını bir kâğıda yaz.', 'Saksının yerini seç.'),
      S('Mutfak için fesleğen ya da nane ek.', 'Bir tohum paketi al.'),
      S('Bitkinin yapraklarına bak: sararma, zararlı var mı?', 'Toprağı parmağınla yokla.'),
      S('Bir bitkiyi çelikle çoğaltmayı dene.', 'Nasıl yapıldığını izle.'),
      S('Kompost ya da gübreleme hakkında kısa bir yazı oku.', 'Tek bir ipucu not et.'),
      S('Haftalık bakım kutusu ekle.', 'Günü seç.'),
    ] },
    satranc: { key: 'satranc', name: 'Satranç', em: '♟️', c: '#334155', basla: [
      S('Taşların hareketlerini bir videoyla tazele.', '3 dakika izle.'),
      S('Çevrim içi bir hesapla üç bulmaca çöz.', 'Bir bulmaca çöz.'),
      S('Bir açılış seç (İtalyan ya da Londra) ve ilk beş hamlesini öğren.', 'İlk iki hamleyi öğren.'),
      S('10 dakikalık bir oyun oyna.', '5 dakikalık bir oyun oyna.'),
      S('Kaybettiğin bir oyunu analiz et: hangi hamlede döndü?', 'Tek bir hatanı bul.'),
      S('Temel mat kalıplarını çalış: şah–vezir matı.', 'Bir mat kalıbını izle.'),
      S('Gerçek tahtada biriyle oyna.', 'Kiminle oynayabileceğini düşün.'),
      S('Günde üç bulmaca kutusu ekle.', 'Günde bir bulmaca hedefi koy.'),
    ] },
    dans: { key: 'dans', name: 'Dans', em: '💃', c: '#c026d3', basla: [
      S('Hangi dans seni çekiyor? Üç kısa video izle.', 'Tek video izle.'),
      S('Evde bir şarkı boyunca kimse izlemiyormuş gibi dans et.', '1 dakika dans et.'),
      S('Temel bir adımı videodan öğren.', 'Adımı yalnızca izle.'),
      S('Yakınında bir kurs ya da deneme dersi araştır.', 'Bir stüdyo adı not et.'),
      S('Deneme dersine yazıl.', 'Uygun günü not et.'),
      S('İlk dersine git.', 'Stüdyoya uğra ve bilgi al.'),
      S('Öğrendiğin adımı müzikle 10 dakika tekrar et.', '3 dakika tekrar et.'),
      S('Haftalık ders kutusu ekle.', 'Günü seç.'),
    ] },
    meditasyon: { key: 'meditasyon', name: 'Nefes ve sakinlik', em: '🧘', c: '#0d9488', basla: [
      S('3 dakika yalnızca nefesini say: 4 al, 6 ver.', '1 dakika nefesini say.'),
      S('Sabah telefona bakmadan önce 2 dakika sessiz otur.', '5 derin nefes al.'),
      S('10 dakikalık rehberli bir meditasyon dinle.', '3 dakika dinle.'),
      S('Yürürken 5 dakika yalnızca adımlarını hisset.', '1 dakika adımlarına dikkat et.'),
      S('Bugün minnet duyduğun üç şeyi yaz.', 'Bir şey yaz.'),
      S('Gergin bir anda kutu nefesi dene: 4-4-4-4.', 'Üç tur kutu nefesi.'),
      S('Yatmadan önce bedeni tarama (body scan) dene.', 'Omuzlarını bilerek gevşet.'),
      S('Günlük 5 dakikalık sakinlik kutusu ekle.', 'Saatini seç.'),
    ] },
    okculuk: { key: 'okculuk', name: 'Okçuluk', em: '🏹', c: '#b45309', basla: [
      S('Geleneksel ve olimpik okçuluk farkını anlatan bir video izle.', '3 dakika izle.'),
      S('Şehrindeki okçuluk kulüplerini ve okçu tekkelerini araştır.', 'Bir yer adı not et.'),
      S('Bir kulübü ara: deneme atışı var mı?', 'Numarayı bul ve kaydet.'),
      S('Omuz ve sırt için lastikle 3 set çekiş yap.', 'Tek set yap.'),
      S('Deneme atışına git.', 'Salonu ziyaret et.'),
      S('Duruş ve çekiş sırasını aynada tekrar et.', 'Duruşu 1 dakika dene.'),
      S('İkinci derse yazıl.', 'Uygun günü not et.'),
      S('Haftalık atış kutusu ekle.', 'Günü seç.'),
    ] },
  };

  // Listede olmayan ilgi alanları için genel yol ({x} = alanın adı)
  const GENERIC = {
    basla: [
      S('{x} hakkında 10 dakikalık bir tanıtım videosu izle.', '{x} hakkında 3 dakika izle.'),
      S('{x} için gereken en sade başlangıcı araştır: ne lazım, ne lazım değil?', 'Tek bir kaynak oku.'),
      S('Yakınında {x} yapılan bir yer, kurs ya da topluluk bul.', 'Bir isim not et.'),
      S('Birini ara ya da yaz: yeni başlayan biri nasıl başlar?', 'Soracağın soruyu not et.'),
      S('İlk denemeyi yap: 15 dakika, tek hedef tadına bakmak.', '5 dakika dene.'),
      S('Nasıl geçti? Üç cümle yaz: ne sevdin, ne zorladı?', 'Tek cümle yaz.'),
      S('İkinci denemeyi takvime koy.', 'Uygun günü seç.'),
      S('{x} için haftalık bir kutu ekle.', 'Günü seç.'),
    ],
    derin: [
      S('{x} konusunda en iyi olduğun ve en zayıf olduğun şeyi yaz.', 'Yalnızca zayıf yanını yaz.'),
      S('Zayıf yanın için 15 dakikalık tek bir alıştırma bul ve yap.', '5 dakika çalış.'),
      S('{x} alanında hayran olduğun birinin çalışmasını incele; bir şeyi taklit et.', 'Yalnızca izle, bir not al.'),
      S('Hiç denemediğin bir tekniği ya da yaklaşımı dene.', 'Tekniğin adını ve nedenini yaz.'),
      S('Kendini kaydet ya da işini birine göster; bir geri bildirim al.', 'Kime göstereceğini düşün.'),
      S('{x} hakkında bir kitap bölümü ya da uzun bir yazı oku.', 'Kısa bir yazı oku.'),
      S('Öğrendiğin bir şeyi birine anlat ya da öğret.', 'Kendine sesli anlat.'),
      S('Üç ay sonrası için somut bir hedef yaz.', 'Bir hedef cümlesi yaz.'),
    ],
  };

  // Karakter kartına göre "Keşfet" önerileri
  const SUGGEST = {
    muzik: ['dans', 'yazi', 'meditasyon'], tenis: ['kosu', 'yuzme', 'okculuk'], eskrim: ['okculuk', 'satranc', 'dans'],
    balik: ['fotograf', 'yemek', 'bahce'], kosu: ['yuzme', 'tenis', 'meditasyon'], okuma: ['yazi', 'dil', 'satranc'],
    dil: ['okuma', 'yazi', 'yemek'], resim: ['fotograf', 'yazi', 'bahce'], yemek: ['bahce', 'fotograf', 'dil'],
    yuzme: ['kosu', 'meditasyon', 'tenis'], fotograf: ['resim', 'yazi', 'balik'], yazi: ['okuma', 'fotograf', 'dil'],
    bahce: ['yemek', 'fotograf', 'meditasyon'], satranc: ['okuma', 'eskrim', 'dil'], dans: ['muzik', 'meditasyon', 'yuzme'],
    meditasyon: ['yazi', 'bahce', 'okuma'], okculuk: ['eskrim', 'meditasyon', 'satranc'],
  };

  const B = (em, name, part, time, c, extra) => Object.assign({ em, name, part, time, c, kind: 'tap', days: [1, 2, 3, 4, 5, 6, 7] }, extra || {});
  const WD = [1, 2, 3, 4, 5];
  const PACKS = {
    namaz: { name: 'Namaz vakitleri', em: '🙏', desc: 'Beş vakit kutusu. Saatleri kendi şehrine göre düzenleyebilirsin.', boxes: [
      B('🙏', 'Sabah namazı', 'sabah', '06:30', COLORS.namaz), B('🙏', 'Öğle namazı', 'gun', '13:00', COLORS.namaz), B('🙏', 'İkindi namazı', 'gun', '15:34', COLORS.namaz),
      B('🙏', 'Akşam namazı', 'aksam', '19:00', COLORS.namaz), B('🙏', 'Yatsı namazı', 'aksam', '21:45', COLORS.namaz),
    ] },
    sabah: { name: 'Sağlıklı sabah', em: '🌅', desc: 'Su, hareket, plan ve kahvaltı.', boxes: [
      B('💧', 'Su', 'gun', '', COLORS.su, { kind: 'count', goal: 8 }), B('🤸', 'Esneme', 'sabah', '07:00', COLORS.hareket, { kind: 'timer', mins: 5 }),
      B('☕', 'Günü planla', 'sabah', '07:45', COLORS.rutin), B('🍳', 'Kahvaltı', 'sabah', '08:15', COLORS.yemek),
    ] },
    aksamMuzik: { name: 'Müzisyenin akşam programı', em: '🎼', desc: 'Hafta içi her akşam bir odak çalışması, 15 dakika piyano ve ikinci oturum.', boxes: [
      B('🎹', 'Piyano & teori', 'aksam', '20:00', COLORS.muzik, { days: [1], short: 'Tek bir alt işi bitir' }),
      B('🎸', 'Gitar repertuar', 'aksam', '20:00', COLORS.muzik, { days: [2], short: 'Tek bir parçayı çal' }),
      B('🎙️', 'Kayıt işleri', 'aksam', '20:00', COLORS.muzik, { days: [3], short: 'Tek bir kanalı kaydet' }),
      B('🎬', 'Video projeler', 'aksam', '20:00', COLORS.muzik, { days: [4], short: 'Tek bir sahneyi kes' }),
      B('🎼', 'Beste', 'aksam', '20:00', COLORS.muzik, { days: [5], short: '10 dakika fikir kaydet' }),
      B('📱', 'Sosyal medya · içerik', 'aksam', '20:00', COLORS.muzik, { days: [6], short: 'Tek bir gönderi hazırla' }),
      B('🎹', '15 dk piyano', 'aksam', '21:00', COLORS.muzik, { days: [1, 2, 3, 4, 5, 6], kind: 'timer', mins: 15 }),
      B('🎛️', 'Arrange', 'aksam', '21:15', COLORS.muzik, { days: [1] }),
      B('🎚️', 'Teori · mix', 'aksam', '21:15', COLORS.muzik, { days: [2] }),
      B('💿', 'Mix · render', 'aksam', '21:15', COLORS.muzik, { days: [3] }),
      B('🎼', 'Beste (devam)', 'aksam', '21:15', COLORS.muzik, { days: [5] }),
    ] },
    gun: { name: 'Çalışan günü', em: '💼', desc: 'Hafta içi mesai, öğle yemeği, mola yürüyüşü.', boxes: [
      B('💼', 'Mesai', 'gun', '09:00', COLORS.mesai, { days: WD }), B('🍽️', 'Öğle yemeği', 'gun', '12:30', COLORS.yemek, { days: WD }),
      B('🚶', 'Mola · yürüyüş', 'gun', '17:00', COLORS.hareket, { days: WD, short: '10 dk yürüyüş' }),
    ] },
    aksam: { name: 'Sakin akşam', em: '🌙', desc: 'Akşam yemeği, ekransız okuma ve düzenli uyku.', boxes: [
      B('🍽️', 'Akşam yemeği', 'aksam', '19:00', COLORS.yemek), B('📖', 'Okuma', 'aksam', '22:00', COLORS.dinlen, { short: '5 sayfa' }),
      B('🌙', 'Uyku', 'aksam', '23:00', COLORS.dinlen),
    ] },
    ev: { name: 'Ev işleri', em: '🧹', desc: 'Haftaya yayılmış küçük işler.', boxes: [
      B('🧺', 'Çamaşır', 'gun', '', COLORS.rutin, { days: [6] }), B('🧹', 'Toparlanma', 'aksam', '', COLORS.rutin, { days: [1, 4] }), B('🛒', 'Alışveriş', 'gun', '', COLORS.rutin, { days: [6] }),
    ] },
  };

  const BLOCKERS = [['vakit', '⏳ Vaktim yok'], ['nereden', '🧭 Nereden başlayacağımı bilmiyorum'], ['para', '💰 Pahalı geliyor'], ['cesaret', '🫣 Çekiniyorum'], ['erteliyorum', '🛋️ Hep erteliyorum']];
  const LEVELS = [['yeni', 'Yeni başladım'], ['yillar', 'Yıllardır yapıyorum'], ['meslek', 'Mesleğim']];
  const EMOJIS = ['💧', '💊', '📖', '🏃', '🧘', '🎸', '🎹', '🧹', '📞', '🛒', '✍️', '🌱', '🙏', '🍎', '💤', '⭐', '💼', '🍽️', '🚶', '🎾', '🤺', '🎣', '🎨', '📷'];
  const TILE_COLORS = ['#2563eb', '#16a34a', '#e11d48', '#d97706', '#7c3aed', '#0d9488', '#0284c7', '#475569'];

  const api = { QUOTES, COLORS, PATHS, GENERIC, SUGGEST, PACKS, BLOCKERS, LEVELS, EMOJIS, TILE_COLORS };
  root.RKData = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
