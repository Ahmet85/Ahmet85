// Varlıkları assets/png klasörüne saydam PNG olarak dışa aktarır.
// Kullanım: proje klasöründe `python3 -m http.server 8765` çalışırken  `node tools/export-assets.js`
// (Playwright gerekir: npm i -D playwright)
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const out = path.join(__dirname, '..', 'assets', 'png'); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 400, height: 400 } });
  await p.goto('http://localhost:8765/preview/asset-export.html'); await p.waitForFunction(() => window.ready);
  const n = await p.evaluate(() => window.assets().length);
  for (let i = 0; i < n; i++) { const r = await p.evaluate(i => window.render(i), i); fs.writeFileSync(path.join(out, r.name + '.png'), Buffer.from(r.data.split(',')[1], 'base64')); }
  console.log(n + ' varlık dışa aktarıldı → assets/png'); await b.close();
})();
