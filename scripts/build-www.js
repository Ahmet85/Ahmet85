// Oyun dosyalarını mağaza uygulaması için www/ klasörüne kopyalar (ritim/, preview/, docs/ gibi klasörler dahil edilmez)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'www');
const FILES = ['index.html', 'game.js', 'okto.js', 'reef.js', 'zones.js', 'enemies.js', 'bosses.js', 'title.js', 'music.js',
  'manifest.json', 'sw.js', 'icon.svg', 'apple-touch-icon.png'];
const DIRS = ['fonts', 'splash', 'music'];
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(root, f), path.join(out, f));
for (const d of DIRS) if (fs.existsSync(path.join(root, d))) fs.cpSync(path.join(root, d), path.join(out, d), { recursive: true });
console.log('www/ hazır:', FILES.length, 'dosya +', DIRS.join(', '));
