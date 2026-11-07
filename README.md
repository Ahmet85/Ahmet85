# 🐙 OKTO: Derinlerin Kaşifi

Sevimli ahtapot **Okto** ile okyanusun derinliklerine dalış yaptığın, mobil öncelikli bir HTML5 oyunu.
Kurulum gerektirmez: telefon tarayıcısında açılır, "Ana ekrana ekle" ile uygulama gibi çalışır (PWA, çevrimdışı da oynanır).

## Nasıl oynanır
| Kontrol | Mobil | Masaüstü |
|---|---|---|
| Hareket | Parmağını ekranda sürükle | Fare / ok tuşları / WASD |
| Mürekkep | Sağ alttaki 💧 düğmesi | Boşluk |
| Duraklat | Sağ üstteki II | P / Esc |

- ⚪ **İnci**: +10 puan. Art arda topladıkça **kombo çarpanı** artar (x2, x3, ...).
- 🐟 **Küçük balık**: +25 puan.
- 🪼 Denizanası, deniz kestanesi, 🐡 balon balığı (40 m+), 🦈 köpekbalığı (120 m+, önce ❗ uyarısı gelir), fener balığı (250 m+) **can götürür**.
- 💧 **Mürekkep** (7 sn'de dolar): etraftaki düşmanları sersemletir, onlar zararsız hale gelir ve bonus puan kazanırsın.
- 🛡️ Kalkan baloncuğu (10 sn), ⭐ deniz yıldızı (mürekkebi anında doldurur), ❤️ can.
- Derinlere indikçe okyanus kararır, hız ve tehlike artar, derin sularda plankton parıldamaya başlar.
- En yüksek skor cihazda saklanır.

## Çalıştırma
```bash
python3 -m http.server 8000
# tarayıcıda: http://localhost:8000
```
Telefonda denemek için aynı Wi‑Fi'daki bilgisayarın IP'siyle açın ya da GitHub Pages'e yayınlayın.

## Dosyalar
- `index.html`: ekranlar (menü, duraklatma, oyun sonu) ve stil
- `game.js`: oyun motoru, çizimler (tüm grafikler kodla çiziliyor, harici görsel yok), sesler (WebAudio)
- `manifest.json`, `sw.js`, `icon.svg`: PWA / çevrimdışı destek

## Sonraki adımlar (fikirler)
- Capacitor ile Android/iOS mağaza uygulamasına paketleme
- Okto için kostüm/renk mağazası (incilerle satın alma)
- Görevler, günlük ödüller, boss (dev kalamar) bölümleri
