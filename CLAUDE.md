# Okto projesi: Claude için notlar

- **Kullanıcının cihazı: iPhone 13** (ekran 390×844 nokta, 3x, çentik payı ~47 nokta, iOS Safari).
  Oyun ana ekrana eklenmiş PWA olarak oynanıyor. Testleri önce bu boyutta yap (Playwright `devices['iPhone 13']`).
- Kullanıcıyla Türkçe konuş; kod yorumları ve commit mesajları da Türkçe.
- Her yayında sürümü artır: `index.html` içindeki `?v=` ekleri, menüdeki `s<sürüm>` etiketi ve `sw.js` içindeki `okto-v<sürüm>` birlikte.
- Yayın: `claude/octopus-mobile-game-0is63u` dalı → GitHub Pages (https://ahmet85.github.io/Ahmet85/).
  Aynı dalda başka bir oturumun `ritim/` klasörü var; ona dokunma, push öncesi rebase yap.
- iPhone'a özgü dersler: ekran ölçümüyle oynamak titremeye yol açtı (basit `innerWidth/innerHeight` kalsın);
  arka plana geçerken AudioContext'i askıya almak bip sesi yaptı (müziği kısa sönümle durdur).
- Yapılacaklar ve fikirler: `YAPILACAKLAR.md`.
