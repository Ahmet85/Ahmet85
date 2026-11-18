# Ritim (kutucuklar ve koç)

Günlük görevlerin dokununca dolan kutucuklar olduğu, kişiyi tanıyıp ona özel küçük adımlar veren yaşam koçu.
Gider Defteri'nin sade tasarımını temel alır. Kurulum gerektirmeyen, çevrimdışı çalışan PWA; veriler yalnızca telefonda durur.

Yayın: https://ahmet85.github.io/Ahmet85/ritim-kutu/

| Dosya | Görevi |
|---|---|
| `core.js` | Mantık: günün kutuları, koçun yolları, seri (arayüzden bağımsız, testli) |
| `data.js` | Özlü sözler, hazır yollar (müzik, tenis, eskrim, balık…), kutu paketleri |
| `app.js` | Ekranlar: açılış sahnesi, tanışma, Bugün, Hafta, Koç, Ayarlar |
| `styles.css` | Tasarım (açık / koyu) |
| `sw.js` | Çevrimdışı çalışma. Yeni sürümde `CACHE` adını ve `?v=` sayılarını artır |

Test: `node --test tests/core.test.js`
Yayınlama: `../ritim-kutu/deploy.sh`

Eski, takvim ağırlıklı sürüm `../ritim/` klasöründe duruyor.
