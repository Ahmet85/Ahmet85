# 🐙 OKTO: Derinlerin Kaşifi

Sevimli ahtapot **Okto** ile okyanusun derinliklerine dalış yaptığın, mobil öncelikli bir HTML5 oyunu.
Kurulum gerektirmez: telefon tarayıcısında açılır, "Ana ekrana ekle" ile uygulama gibi çalışır (PWA, çevrimdışı da oynanır).

## Nasıl oynanır
| Kontrol | Mobil | Masaüstü |
|---|---|---|
| Hareket | Parmağını ekranın herhangi bir yerinde kaydır (Okto aynı yöne kayar) | Fareyle sürükle / ok tuşları / WASD |
| Mürekkep | Sağ alttaki 💧 düğmesi | Boşluk |
| Duraklat | Sağ üstteki II | P / Esc |

- ⚪ **İnci**: +10 puan. Art arda topladıkça **kombo çarpanı** artar (x2, x3, ...).
- 🐟 **Küçük balık**: +25 puan.
- 🪼 Denizanası, deniz kestanesi, 🐡 balon balığı (40 m+), 🦈 köpekbalığı (120 m+, önce ❗ uyarısı gelir), fener balığı (250 m+) **can götürür**.
- 💧 **Mürekkep** (7 sn'de dolar): etraftaki düşmanları sersemletir, onlar zararsız hale gelir ve bonus puan kazanırsın.
- 🛡️ Kalkan baloncuğu (10 sn), ⭐ deniz yıldızı (mürekkebi anında doldurur), ❤️ can.
- Derinlere indikçe okyanus kararır, hız ve tehlike artar, derin sularda plankton parıldamaya başlar.
- ✨ **Işık Midyesi**: yenince ışık bombası patlar, ekrandaki tüm düşmanlar yok olur.
- 🎚️ **3 ses kademesi**: bölüm derinleştikçe deniz kararır, ses efektleri değişir (yankılı, derin); dalgıç gibi nefes ve kabarcık sesleri.
- 🏁 **Bölümler**: 1) Güneşli Sular 0–150 m, 2) Alacakaranlık Bölgesi 150–400 m, 3) Karanlık Derinlikler 400–700 m, sonra her 300 m'de bir sonsuz bölüm.
- 👾 **Bölüm sonu canavarları**: 🐡 Dev Balon Balığı (diken yağmuru, yukarı hamle), ⚡ Elektrikli Denizanası (uyarılı yıldırım sütunları, yavru denizanaları), 🦑 Dev Kalamar (mürekkep lekeleri, dokunaç darbesi). Mürekkep düğmesi canavara güdümlü mürekkep topu atar; ışık bombası 2 hasar verir.
- ⭐ **Bölüm sonu kartı**: 1–3 yıldız (bölümü bitirmek, inci hedefi, en fazla 1 hasar) ve inci ödülü; ardından girdaba dalış animasyonu ile yeni bölüm.
- 💾 **Kayıt noktası**: yanınca ulaştığın bölümün başından devam edersin; menüden başlangıç bölümünü seçebilirsin.
- 🛍️ **Mağaza**: toplanan inciler cüzdanda birikir; renk ve aksesuar (gözlük, çiçek, fiyonk, güneş gözlüğü, korsan şapkası, taç) alınır.
- 📋 **Günlük görevler**: her gün 3 yeni görev ve büyüyen günlük giriş hediyesi.
- En yüksek skor, cüzdan ve kostümler cihazda saklanır.

## Çalıştırma
```bash
python3 -m http.server 8000
# tarayıcıda: http://localhost:8000
```
Telefonda denemek için aynı Wi‑Fi'daki bilgisayarın IP'siyle açın ya da GitHub Pages'e yayınlayın.

## Dosyalar
- `index.html`: ekranlar (menü, duraklatma, oyun sonu) ve stil
- `game.js`: oyun motoru, düşmanlar, dev kalamar, mağaza ve görevler, sesler (WebAudio)
- `okto.js`: Okto karakteri çizimi, renkler ve aksesuarlar
- `title.js`: animasyonlu açılış ekranı
- `music.js`: açılış müziği (`music/acilis.mp3` varsa o çalınır)
- `manifest.json`, `sw.js`, `icon.svg`: PWA / çevrimdışı destek

## Sonraki adımlar (fikirler)
- Capacitor ile Android/iOS mağaza uygulamasına paketleme
- Okto için kostüm/renk mağazası (incilerle satın alma)
- Görevler, günlük ödüller, boss (dev kalamar) bölümleri
