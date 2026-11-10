# OKTO varlıkları

Oyundaki tüm görseller **kodla çizilir**; her varlığın kodu ayrı bir dosyadadır:

| Dosya | Varlıklar |
|---|---|
| `okto.js` | Okto: 7 renk, 7 aksesuar, ifadeler |
| `enemies.js` | Düşmanlar ve toplanabilirler: denizanası, deniz kestanesi, balon balığı, fener balığı, köpekbalığı, balık, inci, deniz yıldızı, kalp, kalkan, ışık midyesi, hediye, altın karides, mürekkep lekesi, diken |
| `bosses.js` | Bölüm sonu canavarları (Dev Balon Balığı, Elektrikli Denizanası, Dev Kalamar) ve saldırıları |
| `reef.js` | Resif adacıkları, kanyon çıkıntıları, kanyon duvarı, silüetler, ön plan mercanları, deniz tabanı |
| `zones.js` | Bölge varlıkları: akıntı, mağara karanlığı, batık gemi, bacalar, yosun, mayınlar, kovalayan fener balığı |
| `title.js` | Açılış ekranı sahnesi |

`png/` klasöründe bu varlıkların saydam arka planlı PNG kopyaları var (tasarım ve sunum için; oyun bunları kullanmaz).
Yeniden üretmek için: proje klasöründe `python3 -m http.server 8765` çalışırken `node tools/export-assets.js`.
