# Okto müzikleri

Oyunda iki yerde müzik çalar. Kendi müziğini koymak için dosyayı bu klasöre şu adla ekle:

| Dosya | Nerede çalar |
|---|---|
| `acilis.mp3` | Açılış ekranı (menü) |
| `oyun.mp3` | Oyun sırasında (tüm kademeler) |

Dosyayı ekledikten sonra `music.js` başındaki `HAS_CUSTOM` satırında ilgili değeri `true` yap
(Claude'a "müziğimi ekledim" demen yeterli). Böylece dosya yokken tarayıcı boşuna arayıp hata yazmaz.

Dosya yoksa `music.js` içindeki kodla üretilen müzikler çalar: açılış marimbası ve oyun içinde
3 kademe (Güneşli Sular: neşeli marimba, Alacakaranlık: yankılı çanlar, Karanlık Derinlikler: bas ve sonar).
