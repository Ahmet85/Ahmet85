# Okto'yu App Store ve Google Play'e koymak

Oyun şu an bir web uygulaması (PWA). **Capacitor** aynı kodu gerçek bir iOS / Android uygulamasına sarar.
Projede gerekli ayarlar hazır: `package.json`, `capacitor.config.json`, `scripts/build-www.js`.

## Gerekenler
| | iPhone (App Store) | Android (Google Play) |
|---|---|---|
| Bilgisayar | Mac + **Xcode** (App Store'dan ücretsiz) | Mac veya Windows + **Android Studio** (ücretsiz) |
| Hesap | Apple Developer Program: **yıllık 99 $** | Google Play Console: **tek seferlik 25 $** |
| Diğer | Node.js (nodejs.org) | Node.js |

## Adımlar (Mac'te, Terminal'de)
1. Projeyi indir: `git clone https://github.com/Ahmet85/Ahmet85.git okto && cd okto && git checkout claude/octopus-mobile-game-0is63u`
   (İstersen bu klasörü `/Volumes/8TB WD/CLAUDE ÇALIŞMALARI/OKTO` içine koy.)
2. Paketleri kur: `npm install`
3. Platformları bir kez ekle: `npx cap add ios` ve/veya `npx cap add android`
4. iPhone için: `npm run ios` → Xcode açılır → üstte cihazını seç → ▶ ile telefonda dene →
   Product → Archive → App Store Connect'e yükle.
5. Android için: `npm run android` → Android Studio açılır → Build → Generate Signed Bundle → Play Console'a yükle.
6. Oyunda her değişiklikten sonra: `npm run cap:sync`

## Mağaza için hazırlanacaklar
- Uygulama simgesi (1024×1024 PNG): `assets/png` içindeki Okto görsellerinden üretilebilir.
- Ekran görüntüleri: iPhone 6,7" ve 6,5" boyutları; oyundan alınır.
- Açıklama, yaş derecesi (çocuklara yönelik: **4+**), gizlilik politikası (oyun veri toplamaz; kayıtlar sadece cihazda).
