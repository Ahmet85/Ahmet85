# Ritim

Kişisel hayat ajandası ve nazik yaşam koçu. Tarif: [PROJE-TARIFI.md](PROJE-TARIFI.md) (sürüm 3, tek ve güncel tarif).

Yayın adresi: https://ahmet85.github.io/Ahmet85/ritim/ (telefonda açıp "Ana ekrana ekle")

## Durum
- [x] 1. Temel: veri modeli, Türkçe ve çeviriye hazır arayüz, bölge/saat ayarları, yedekleme, örnek profil
- [x] 2. Görünümler: Bugün (ŞİMDİ kartı), Hafta (şerit + yan çevirince tablo), Ay, Yıl; yakınlaşma geçişleri
- [x] 3. Randevu ekleme, hatırlatma teklifi ve çakışma yönetimi (önizleme, onay, geri al)
- [x] 4. Haftalık tabloda sürükle-bırak, süre değiştirme, "Gün ve saati değiştir", rutin blok oluşturma/düzenleme
- [ ] 5. "Günüm değişti" ve kısa sürümler
- [ ] 6. "Kaldığım yer" notları
- [ ] 7. Alarmlar ve kutlamalar
- [ ] 8. Karne
- [ ] 9. Ayarlar ve dışa aktarma

## Teknik
- Vite + React + TypeScript, çevrimdışı çalışan PWA
- Veriler cihazda: IndexedDB (Dexie). Sunucu yok, analitik yok.
- Tarih/saat: Temporal (yaz saati ve saat dilimi doğru), tekrar kuralları `src/domain/recurrence.ts`
- Çeviri: `src/locales/tr.json` (ICU mesaj biçimi, react-intl)
- Testler: Vitest (`tests/`)

| Klasör | İçerik |
|---|---|
| `src/domain` | Veri modeli, tekrar kuralları, zaman, hatırlatma hesapları (arayüzden bağımsız) |
| `src/db` | Veritabanı, işlem geçmişi/geri al, yedek |
| `src/sample` | Örnek "Ahmet" profili (yalnızca deneme) |
| `src/ui` | Ekranlar |
| `assets/` | İleride eklenecek görsel ve sesler için yuvalar |

## Komutlar
```bash
npm install
npm test            # otomatik testler
npm run dev         # geliştirme sunucusu (aynı Wi-Fi'deki telefondan IP ile açılır)
npm run build       # yayın derlemesi (dist/)
scripts/deploy.sh   # derleyip GitHub Pages'e yayınlar
```
