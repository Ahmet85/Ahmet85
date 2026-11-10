/* OKTO düşmanlar ve toplanabilirler: game.js'ten ayrılmış çizim modülü (kodla çizilen varlıklar).
   Kullanım: OktoEnemies.draw(G, e)  — G = { ctx, S, W, H, time, FONT } */
(() => {
'use strict';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
let ctx, S, W, H, time, FONT;
function use(G) { ctx = G.ctx; S = G.S; W = G.W; H = G.H; time = G.time; FONT = G.FONT; }

function drawEntity(e) {
  const r = e.r;
  ctx.save(); ctx.translate(e.x, e.y);
  if (e.stunned) ctx.globalAlpha = 0.45;
  switch (e.type) {
    case 'pearl': {
      const pulse = 1 + Math.sin(e.t * 4) * 0.08;
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r * 1.9 * pulse);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#fff2d9'); g.addColorStop(0.55, 'rgba(255,240,210,.35)'); g.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.9 * pulse, 0, TAU); ctx.fill();
      break;
    }
    case 'glow': { // Işık Midyesi: yenince ışık bombası
      const pulse = 0.5 + 0.5 * Math.sin(e.t * 5);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3.2);
      gg.addColorStop(0, `rgba(255,245,170,${0.55 + pulse * 0.3})`); gg.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, r * 3.2, 0, TAU); ctx.fill();
      ctx.rotate(e.t * 0.8); ctx.fillStyle = `rgba(255,250,200,${0.25 + pulse * 0.2})`;
      for (let i = 0; i < 8; i++) { ctx.rotate(TAU / 8); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * 0.35, r * 3); ctx.lineTo(-r * 0.35, r * 3); ctx.fill(); }
      ctx.restore();
      const open = 0.35 + pulse * 0.15;
      ctx.lineJoin = 'round'; ctx.strokeStyle = '#7a3a8c'; ctx.lineWidth = 1.6 * S;
      const shell = (dir) => {
        ctx.save(); ctx.scale(1, dir);
        const sg = ctx.createLinearGradient(0, 0, 0, r * 1.1); sg.addColorStop(0, '#ffd6f2'); sg.addColorStop(1, '#c27adf');
        ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(-r * 1.15, 0);
        for (let i = 0; i <= 6; i++) { const a = Math.PI + i / 6 * Math.PI, rr = r * (1.05 + (i % 2) * 0.08); ctx.lineTo(Math.cos(a) * rr * 1.1, -Math.sin(a) * rr * 0.95); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(122,58,140,.5)';
        for (let i = 1; i < 6; i++) { const a = Math.PI + i / 6 * Math.PI; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, -Math.sin(a) * r * 0.85); ctx.stroke(); }
        ctx.restore();
      };
      ctx.save(); ctx.rotate(-open * 0.5); ctx.translate(0, -r * 0.05); shell(-1); ctx.restore();
      const pg = ctx.createRadialGradient(-r * 0.15, -r * 0.2, 1, 0, 0, r * 0.55);
      pg.addColorStop(0, '#ffffff'); pg.addColorStop(1, '#ffe46b');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 0.5, 0, TAU); ctx.fill();
      shell(1);
      break;
    }
    case 'gift': {
      const wob = Math.sin(e.t * 6) * 0.12, bob = Math.sin(e.t * 3) * 3 * S;
      ctx.translate(0, bob); ctx.rotate(wob);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.2); gl.addColorStop(0, `hsla(${e.hue},100%,75%,.45)`); gl.addColorStop(1, `hsla(${e.hue},100%,75%,0)`);
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, TAU); ctx.fill(); ctx.restore();
      ctx.lineJoin = 'round'; ctx.lineWidth = 1.6 * S; ctx.strokeStyle = `hsl(${e.hue},70%,30%)`;
      ctx.fillStyle = `hsl(${e.hue},85%,58%)`; ctx.beginPath(); ctx.roundRect(-r, -r * 0.55, r * 2, r * 1.5, 3 * S); ctx.fill(); ctx.stroke();
      ctx.fillStyle = `hsl(${e.hue},85%,66%)`; ctx.beginPath(); ctx.roundRect(-r * 1.12, -r * 0.85, r * 2.24, r * 0.45, 3 * S); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff3a0'; ctx.fillRect(-r * 0.18, -r * 0.85, r * 0.36, r * 1.8);
      ctx.beginPath(); ctx.ellipse(-r * 0.38, -r * 1.05, r * 0.38, r * 0.22, -0.4, 0, TAU); ctx.ellipse(r * 0.38, -r * 1.05, r * 0.38, r * 0.22, 0.4, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = `700 ${r * 0.9}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, r * 0.25);
      break;
    }
    case 'treat': { // Altın Karides: belirir, parlar
      const pop = Math.min(1, e.t / 0.35), sc = pop < 1 ? 0.3 + pop * 0.9 : 1 + Math.sin(e.t * 5) * 0.06;
      ctx.scale(sc, sc); ctx.rotate(Math.sin(e.t * 3) * 0.2);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gl = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.6); gl.addColorStop(0, 'rgba(255,220,90,.7)'); gl.addColorStop(1, 'rgba(255,220,90,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, r * 2.6, 0, TAU); ctx.fill(); ctx.restore();
      ctx.lineJoin = 'round'; ctx.strokeStyle = '#8a4b00'; ctx.lineWidth = 1.5 * S;
      for (let i = 4; i >= 0; i--) { // kıvrık gövde boğumları
        const a = -0.6 + i * 0.42, x = Math.cos(a) * r * 0.75, y = Math.sin(a) * r * 0.75, rr = r * (0.48 - i * 0.06);
        ctx.fillStyle = i % 2 ? '#ffb000' : '#ffd23f'; ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.8, a, 0, TAU); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#ffb000'; ctx.beginPath(); ctx.moveTo(-r * 0.2, r * 0.95); ctx.lineTo(-r * 0.75, r * 1.25); ctx.lineTo(-r * 0.45, r * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#ffcf6b'; ctx.lineWidth = 1.2 * S; ctx.beginPath(); ctx.moveTo(r * 0.75, -r * 0.5); ctx.quadraticCurveTo(r * 1.4, -r * 1.2, r * 1.6, -r * 0.6); ctx.moveTo(r * 0.7, -r * 0.55); ctx.quadraticCurveTo(r * 1.1, -r * 1.4, r * 1.5, -r * 1.2); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(r * 0.72, -r * 0.42, r * 0.09, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { const a = e.t * 2 + i * 2.1; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(e.t * 6 + i); ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.4, Math.sin(a) * r * 1.4, 1.6 * S, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
      break;
    }
    case 'spike': {
      ctx.rotate(Math.atan2(e.vy, e.vx));
      ctx.fillStyle = '#e8a400'; ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 1.5 * S;
      ctx.beginPath(); ctx.moveTo(r * 1.8, 0); ctx.lineTo(-r, -r * 0.6); ctx.lineTo(-r * 0.5, 0); ctx.lineTo(-r, r * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'blob': {
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r * 1.2);
      g.addColorStop(0, '#7a4fb8'); g.addColorStop(1, '#1d0b33');
      ctx.fillStyle = g; ctx.beginPath();
      for (let i = 0; i <= 12; i++) { const a = i / 12 * TAU, rr = r * (1 + Math.sin(e.t * 8 + i * 2) * 0.12); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.1, r * 0.22, 0, TAU); ctx.arc(r * 0.3, -r * 0.1, r * 0.22, 0, TAU); ctx.fill();
      ctx.fillStyle = '#c0213a'; ctx.beginPath(); ctx.arc(-r * 0.27, -r * 0.05, r * 0.11, 0, TAU); ctx.arc(r * 0.33, -r * 0.05, r * 0.11, 0, TAU); ctx.fill();
      break;
    }
    case 'fish': {
      ctx.scale(e.dir, 1);
      const wag = Math.sin(e.t * 12) * 0.35;
      ctx.fillStyle = `hsl(${e.hue},95%,60%)`;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3, r * 0.8, 0, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(-r * 1.2, 0); ctx.rotate(wag);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 0.9, -r * 0.7); ctx.lineTo(-r * 0.9, r * 0.7); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-r * 0.2, -r * 0.75, r * 0.25, r * 1.5);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * 0.6, -r * 0.15, r * 0.28, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(r * 0.68, -r * 0.15, r * 0.14, 0, TAU); ctx.fill();
      break;
    }
    case 'jelly': {
      const pulse = Math.sin(e.t * 2.2);
      const col = e.stunned ? '150,150,170' : `${hsl2rgb(e.hue)}`;
      ctx.strokeStyle = `rgba(${col},.7)`; ctx.lineWidth = 2 * S;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(i * r * 0.3, r * 0.1);
        for (let k = 1; k <= 6; k++) ctx.lineTo(i * r * 0.3 + Math.sin(e.t * 3 + k + i) * 4 * S, r * 0.1 + k * r * 0.32);
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(0, -r * 0.3, 1, 0, 0, r * 1.2);
      g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.5, `rgba(${col},.75)`); g.addColorStop(1, `rgba(${col},.2)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, r * (1 + pulse * 0.08), r * (0.8 - pulse * 0.08), 0, Math.PI, 0); ctx.quadraticCurveTo(0, r * 0.35, -r * (1 + pulse * 0.08), 0); ctx.fill();
      if (!e.stunned) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(${col},.15)`; ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, TAU); ctx.fill(); }
      break;
    }
    case 'urchin': {
      ctx.rotate(e.t * 0.4);
      ctx.strokeStyle = e.stunned ? '#777' : '#3a1450'; ctx.lineWidth = 2.2 * S; ctx.lineCap = 'round';
      for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, l = r * (1.25 + (i % 2) * 0.3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.stroke(); }
      ctx.fillStyle = e.stunned ? '#888' : '#5b1f7a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff5d73'; ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.1, r * 0.15, 0, TAU); ctx.arc(r * 0.2, -r * 0.1, r * 0.15, 0, TAU); ctx.fill();
      break;
    }
    case 'puffer': {
      ctx.fillStyle = e.stunned ? '#aaa' : '#ffd23f';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      if (e.puff > 0.2) {
        ctx.strokeStyle = '#b07d00'; ctx.lineWidth = 1.6 * S;
        for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * r * (1 + 0.3 * e.puff), Math.sin(a) * r * (1 + 0.3 * e.puff)); ctx.stroke(); }
      }
      ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.ellipse(0, r * 0.35, r * 0.7, r * 0.45, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.2, r * 0.25, 0, TAU); ctx.arc(r * 0.35, -r * 0.2, r * 0.25, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.18, r * 0.12, 0, TAU); ctx.arc(r * 0.38, -r * 0.18, r * 0.12, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff7a5c'; ctx.beginPath(); ctx.arc(0, r * 0.15, r * 0.12, 0, TAU); ctx.fill();
      break;
    }
    case 'angler': {
      const lure = Math.sin(e.t * 3) * 0.5 + 0.5;
      ctx.strokeStyle = '#4a5a6a'; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.quadraticCurveTo(r * 0.3, -r * 1.8, r * 0.9, -r * 1.4); ctx.stroke();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(r * 0.9, -r * 1.4, 1, r * 0.9, -r * 1.4, r * (0.8 + lure * 0.5));
      lg.addColorStop(0, 'rgba(180,255,240,1)'); lg.addColorStop(1, 'rgba(80,255,220,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(r * 0.9, -r * 1.4, r * 1.3, 0, TAU); ctx.fill(); ctx.restore();
      ctx.fillStyle = e.stunned ? '#666' : '#2b3a4a'; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.1, r * 0.85, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0a0f18'; ctx.beginPath(); ctx.moveTo(r * 0.1, r * 0.1); ctx.lineTo(r * 1.1, -r * 0.1); ctx.lineTo(r * 1.1, r * 0.6); ctx.fill();
      ctx.fillStyle = '#eee';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(r * (0.35 + i * 0.18), r * 0.05); ctx.lineTo(r * (0.43 + i * 0.18), r * 0.3); ctx.lineTo(r * (0.51 + i * 0.18), r * 0.05); ctx.fill(); }
      ctx.fillStyle = '#d6ff6b'; ctx.beginPath(); ctx.arc(r * 0.1, -r * 0.35, r * 0.18, 0, TAU); ctx.fill();
      break;
    }
    case 'shark': {
      if (e.warn > 0) {
        ctx.restore(); ctx.save();
        const wx = e.dir > 0 ? 28 * S : W - 28 * S;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 20);
        ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(wx, e.y, 18 * S, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `bold ${24 * S}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', wx, e.y + 1);
        break;
      }
      ctx.scale(e.dir, 1);
      ctx.fillStyle = e.stunned ? '#8a95a0' : '#5d7487';
      ctx.beginPath(); ctx.moveTo(r * 2.2, 0); ctx.quadraticCurveTo(r * 1.2, -r * 0.9, -r * 1.4, -r * 0.3); ctx.lineTo(-r * 2.4, -r * 1.0); ctx.lineTo(-r * 2.1, 0); ctx.lineTo(-r * 2.4, r * 0.9); ctx.lineTo(-r * 1.4, r * 0.3); ctx.quadraticCurveTo(r * 1.2, r * 0.8, r * 2.2, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -r * 0.6); ctx.lineTo(-r * 0.6, -r * 1.4); ctx.lineTo(-r * 0.7, -r * 0.45); ctx.fill();
      ctx.fillStyle = '#dfe8ee'; ctx.beginPath(); ctx.moveTo(r * 2.1, r * 0.08); ctx.quadraticCurveTo(r * 0.8, r * 0.75, -r * 1.2, r * 0.25); ctx.quadraticCurveTo(r * 0.8, r * 0.3, r * 2.1, r * 0.08); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(r * 1.35, -r * 0.2, r * 0.1, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.4 * S;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(r * (0.7 - i * 0.18), -r * 0.2); ctx.lineTo(r * (0.6 - i * 0.18), r * 0.2); ctx.stroke(); }
      break;
    }
    case 'shield': {
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r * 1.2);
      g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.6, 'rgba(120,220,255,.35)'); g.addColorStop(1, 'rgba(120,220,255,.8)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, Math.sin(e.t * 3) * 3 * S, r * 1.15, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8f1f7'; ctx.strokeStyle = '#5b7a90'; ctx.lineWidth = 1.5 * S; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(0, -r * 0.6); ctx.quadraticCurveTo(r * 0.3, -r * 0.45, r * 0.55, -r * 0.5); ctx.quadraticCurveTo(r * 0.55, r * 0.25, 0, r * 0.62);
      ctx.quadraticCurveTo(-r * 0.55, r * 0.25, -r * 0.55, -r * 0.5); ctx.quadraticCurveTo(-r * 0.3, -r * 0.45, 0, -r * 0.6); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#9fb6c6'; ctx.beginPath(); ctx.moveTo(0, -r * 0.45); ctx.lineTo(0, r * 0.45); ctx.stroke();
      break;
    }
    case 'star': {
      ctx.rotate(Math.sin(e.t * 2) * 0.3);
      ctx.fillStyle = '#ff9f43'; ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, l = i % 2 ? r * 0.5 : r * 1.25; ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd38a'; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, 1.8 * S, 0, TAU); ctx.fill(); }
      break;
    }
    case 'heart': {
      const s = r * (1 + Math.sin(e.t * 6) * 0.08) / 16;
      ctx.scale(s, s); ctx.fillStyle = '#ff4d6d';
      ctx.beginPath(); ctx.moveTo(0, 14); ctx.bezierCurveTo(-26, -4, -12, -22, 0, -8); ctx.bezierCurveTo(12, -22, 26, -4, 0, 14); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(-8, -8, 3.5, 0, TAU); ctx.fill();
      break;
    }
  }
  ctx.restore();
  if (e.stunned && e.type !== 'pearl') {
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `bold ${12 * S}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText('z z', e.x + r * 0.8, e.y - r * 1.1 - Math.sin(e.t * 3) * 3 * S);
  }
}
const hslCache = {};
function hsl2rgb(h) {
  const k = Math.round(h); if (hslCache[k]) return hslCache[k];
  const s = 0.85, l = 0.68, a = s * Math.min(l, 1 - l);
  const f = n => { const kk = (n + k / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(kk - 3, 9 - kk, 1)))); };
  return (hslCache[k] = `${f(0)},${f(8)},${f(4)}`);
}


window.OktoEnemies = { draw(G, e) { use(G); drawEntity(e); }, hsl2rgb };
})();
