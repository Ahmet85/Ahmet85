// Ritim: ekranlar. Veriler yalnızca bu cihazda (localStorage) durur.
(() => {
  const D = RKData;
  const KEY = 'ritim-kutu-v1';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  const layer = $('#layer');
  const PARTS = D.PARTS;
  const LONG = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  // ---- Durum ----
  let state = load();
  let tab = 'today';
  let weekOffset = 0;
  let cur = RK.dstr(new Date()); // Gün ekranında gösterilen tarih
  let editMode = false;
  let openWeekDay = null;
  let quoteIdx = 0;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign(RK.emptyState(), JSON.parse(raw));
    } catch { /* bozuk kayıt: boş başla */ }
    return RK.emptyState();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { toast('Kaydedilemedi: telefonda yer kalmamış olabilir'); }
  }
  const today = () => RK.dstr(new Date());
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const snapshot = () => { const copy = JSON.stringify(state); return () => { state = JSON.parse(copy); save(); render(); }; };
  const E = (id, d = cur) => RK.entry(state, d, id) || {};
  function setE(id, patch, d = cur) {
    const old = RK.entry(state, d, id) || {};
    RK.setEntry(state, d, id, patch === null ? null : Object.assign(old, patch));
  }
  const dayLabel = (d) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' }).format(RK.parse(d));

  // ---- Küçük sesler (WebAudio; dosya gerekmez) ----
  let actx = null;
  function beep(freqs, dur = 0.3, vol = 0.12) {
    if (!state.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      freqs.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain(), t0 = actx.currentTime + i * 0.09;
        o.frequency.value = f; o.type = 'sine';
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.05);
      });
    } catch { /* ses yoksa sessiz devam */ }
  }

  // ---- Bildirim şeridi, parıltı, kutlama ----
  let toastTimer;
  function toast(text, undo) {
    clearTimeout(toastTimer);
    $$('.toast', layer).forEach((n) => n.remove());
    const el = document.createElement('div');
    el.className = 'toast' + (undo ? '' : ' plain'); el.setAttribute('role', 'status');
    el.innerHTML = `<span>${esc(text)}</span>${undo ? '<button type="button">Geri al</button>' : ''}`;
    if (undo) el.querySelector('button').onclick = () => { undo(); el.remove(); };
    layer.appendChild(el);
    toastTimer = setTimeout(() => el.remove(), 3800);
  }
  function sparkle(el, color) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('span');
      s.className = 'spark';
      s.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;background:${color};--dx:${Math.cos(i / 10 * 6.28) * 64}px;--dy:${Math.sin(i / 10 * 6.28) * 64}px`;
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 650);
    }
  }
  function party(em, title, text) {
    const p = document.createElement('div');
    p.className = 'party';
    p.innerHTML = `<div class="card"><div class="em">${em}</div><h2>${esc(title)}</h2><p class="muted">${esc(text)}</p><button type="button" class="btn primary wide">Teşekkürler</button></div>`;
    p.onclick = () => p.remove();
    layer.appendChild(p);
    beep([523, 659, 784, 1047], 0.6);
  }
  function afterDone() { if (cur === today()) afterDoneToday(); }
  function afterDoneToday() {
    const t = today();
    state.celebrated = state.celebrated || {};
    const sum = RK.daySummary(state, t), st = RK.streak(state, t);
    const seen = (state.celebrated[t] = state.celebrated[t] || []);
    let pick = null;
    if (sum.complete && !seen.includes('day')) pick = ['day', '🎉', 'Bugünü tamamladın!', 'Bütün kutular doldu. Kendine bir teşekkür et.'];
    else if (st.comeback && !seen.includes('back')) pick = ['back', '🫶', 'Tekrar hoş geldin!', 'Ara vermek de yolun parçası. Geri dönmen en güzeli.'];
    else if ([3, 7, 14, 21, 30, 50, 100].includes(st.days) && !seen.includes('s' + st.days)) pick = ['s' + st.days, '🔥', `${st.days} gündür ritmindesin!`, 'Küçük adımlar birikiyor. Böyle devam.'];
    if (pick) { seen.push(pick[0]); save(); setTimeout(() => party(pick[1], pick[2], pick[3]), 600); }
  }

  // ---- Açılış sahnesi: her açılışta bir özlü söz ----
  function scene(done) {
    quoteIdx = RK.nextQuote(state, D.QUOTES.length);
    save();
    if (!state.settings.scene) return done();
    const [q, a] = D.QUOTES[quoteIdx];
    const el = document.createElement('div');
    el.className = 'scene';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Günün sözü');
    let i = 0;
    const words = q.split(' ').map((w) => `<span style="white-space:nowrap">${[...w].map((ch) => `<span style="--i:${i++}">${esc(ch)}</span>`).join('')}</span>${(i++, ' ')}`).join('');
    const after = 0.55 + i * 0.026 + 0.2;
    el.style.setProperty('--after', after + 's');
    el.innerHTML = `<i class="glow a"></i><i class="glow b"></i>${Array.from({ length: 22 }, (_, k) => { const r = (n) => Math.abs(Math.sin(k * 12.9898 + n * 78.233) * 43758.5453) % 1; return `<i class="dust" style="left:${(r(1) * 100).toFixed(1)}%;top:${(25 + r(2) * 75).toFixed(1)}%;width:${(1.5 + r(3) * 2.5).toFixed(1)}px;height:${(1.5 + r(3) * 2.5).toFixed(1)}px;animation-duration:${(5 + r(4) * 5).toFixed(1)}s;animation-delay:${(-r(5) * 8).toFixed(1)}s"></i>`; }).join('')}
      <div class="scene-inner"><div class="mark">Ritim</div><p class="quote" aria-label="${esc(q)}">${words}</p><div class="rule"></div><div class="author">${esc(a)}</div></div>
      <div class="skip">Başlamak için dokun</div>`;
    document.body.classList.add('locked');
    document.body.appendChild(el);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      el.classList.add('out');
      document.body.classList.remove('locked');
      done();
      setTimeout(() => el.remove(), 600);
    };
    el.onclick = close;
    setTimeout(close, (after + 2.6) * 1000);
  }

  // ---- Koçun cümleleri ----
  function coachLine() {
    const t = today(), sum = RK.daySummary(state, t), g = RK.growthForDay(state, t);
    const boxes = RK.boxesForDay(state, t).filter((b) => !['done', 'skip'].includes(E(b.id).s));
    const en = state.energy && state.energy.date === t ? state.energy.v : 'ok';
    const star = state.star && state.star.date === t ? state.boxes.find((b) => b.id === state.star.id) : null;
    const gTodo = g.find((x) => !x.done);
    if (!sum.total) return ['🧭', 'Henüz kutun yok. “Görev Ekle” ile başla ya da Ayarlar’dan hazır bir paket seç.'];
    if (sum.complete) return ['🎉', 'Bugünkü bütün kutular tamam. Akşamın tadını çıkar.'];
    if (en === 'low') return ['🫶', 'Yorgun bir gün. Kısa sürümleri açtım; yarısı bile sayılır.'];
    if (star && E(star.id).s !== 'done') return ['⭐', `Günün 1 numarası: ${star.name}. Yalnızca başlaman yeter.`];
    if (gTodo) {
      const b = state.profile && state.profile.blocker;
      const lead = gTodo.small ? 'Bu adımı küçülttüm, böylesi daha kolay: ' : b === 'nereden' ? 'Nereden başlayacağını ben söyleyeyim: ' : b === 'erteliyorum' ? 'Ertelemeden, şimdi 5 dakikada: ' : b === 'vakit' ? 'Kısacık bir adım: ' : 'Bugünkü adımın: ';
      return ['🧭', lead + gTodo.path.title.toLowerCase() + ' için altın kutuya bak.'];
    }
    if (en === 'high') return ['⚡', 'Enerjin yüksek. En zor kutuyla başla.'];
    return ['👉', `Sıradaki kutu: ${boxes[0] ? boxes[0].name : 'son adım'}.`];
  }

  // ---- Bugün ----
  function nowBox(boxes) {
    const m = nowMin();
    return boxes.find((b) => !E(b.id).s && RK.toMin(b.time) !== null && m >= RK.toMin(b.time) && m < RK.toMin(b.time) + 60);
  }
  function tileHTML(b, opts = {}) {
    const e = opts.preview ? {} : E(b.id);
    const cls = ['tile'];
    const done = e.s === 'done';
    if (done) cls.push('done');
    if (e.s === 'skip') cls.push('skip');
    if (opts.now) cls.push('now');
    if (!e.s && cur === today() && RK.toMin(b.time) !== null && RK.toMin(b.time) > nowMin()) cls.push('later');
    if (editMode && !opts.preview) cls.push('editing');
    let sub = e.s === 'skip' ? 'yarın tekrar' : e.snooze ? `${e.snooze} · ertelendi` : b.time || (b.kind === 'tap' ? '' : '');
    let extra = '';
    let name = b.name;
    if (e.short && b.short) { name = b.short; sub = (sub ? sub + ' · ' : '') + 'kısa sürüm'; }
    if (b.kind === 'count') {
      const n = e.n || 0, goal = b.goal || 8;
      sub = `${n}/${goal}`;
      extra = `<span class="count-dots">${Array.from({ length: Math.min(goal, 16) }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
    }
    if (b.kind === 'timer' && e.end && !done) {
      const left = Math.max(0, e.end - Date.now()), total = (b.mins || 15) * 60000, frac = Math.min(1, 1 - left / total);
      sub = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
      extra = `<svg class="ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><circle cx="50" cy="50" r="46" stroke="${b.c}" stroke-opacity=".22"/><circle cx="50" cy="50" r="46" stroke="${b.c}" stroke-dasharray="${289 * frac} 289" transform="rotate(-90 50 50)" stroke-linecap="round"/></svg>`;
    } else if (b.kind === 'timer' && !e.s) {
      sub = (sub ? sub + ' · ' : '') + `⏱ ${b.mins || 15} dk`;
    }
    const star = !opts.preview && cur === today() && state.star && state.star.date === today() && state.star.id === b.id;
    const fire = opts.preview ? 0 : RK.boxStreak(state, b, today());
    const label = `${name}${sub ? ', ' + sub : ''}, ${done ? 'tamamlandı' : e.s === 'skip' ? 'bugün olmadı' : 'yapılacak'}`;
    return `<button type="button" class="${cls.join(' ')}" style="--c:${b.c};--i:${opts.i || 0}" ${opts.preview ? 'tabindex="-1"' : `data-id="${b.id}"`} aria-label="${esc(label)}">
      ${extra}${editMode && !opts.preview ? '<span class="edit">✎</span>' : `${star ? '<span class="star">⭐</span>' : ''}${fire >= 3 ? `<span class="fire">🔥${fire}</span>` : ''}`}${b.dayOnly && !opts.preview ? '<span class="only">yalnız bu gün</span>' : ''}
      <span class="check">✓</span><span class="ci">${b.em}</span><span class="nm">${esc(name)}</span><span class="tm">${esc(sub)}</span></button>`;
  }

  function renderStrip() {
    const el = $('#strip');
    el.hidden = tab !== 'today';
    if (tab !== 'today') return;
    const s0 = RK.weekStart(cur), t = today();
    el.innerHTML = `<button type="button" class="nav" data-shift="-7" aria-label="Önceki hafta">‹</button>${DAYS.map((n, i) => {
      const d = RK.addDays(s0, i), sm = RK.daySummary(state, d);
      return `<button type="button" class="daybtn ${d === cur ? 'on' : ''} ${d === t ? 'today' : ''}" data-day="${d}" aria-label="${LONG[i]} ${+d.slice(8)}" aria-current="${d === cur}"><span class="n">${n}</span><span class="d">${+d.slice(8)}</span><span class="p"><i style="width:${d <= t ? Math.round(sm.ratio * 100) : 0}%"></i></span></button>`;
    }).join('')}<button type="button" class="nav" data-shift="7" aria-label="Sonraki hafta">›</button>`;
  }
  function goDay(d, dir = 0) { cur = d; tab = 'today'; window.scrollTo(0, 0); render(dir); }

  function renderDay(dir = 0) {
    const t = today();
    RK.rollDay(state, t); save();
    const isToday = cur === t;
    const boxes = RK.boxesForDay(state, cur), g = RK.growthForDay(state, cur), sum = RK.daySummary(state, cur), st = RK.streak(state, t);
    const now = isToday ? nowBox(boxes) : null;
    const pct = Math.round(sum.ratio * 100);
    const h = new Date().getHours();
    const name = state.profile ? ' ' + state.profile.name : '';
    const rel = isToday ? (h < 5 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar') + name : cur === RK.addDays(t, 1) ? 'Yarın' : cur === RK.addDays(t, -1) ? 'Dün' : cur > t ? 'Plan' : 'Geçmiş gün';
    const date = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }).format(RK.parse(cur));
    const en = state.energy && state.energy.date === t ? state.energy.v : null;
    let i = 0;
    const partsHTML = PARTS.map(([k, label, em]) => {
      const list = boxes.filter((b) => b.part === k);
      if (!list.length) return '';
      const d = list.filter((b) => E(b.id).s === 'done').length;
      return `<div class="part ${k === 'calisma' ? 'music' : ''}"><h3>${k === 'calisma' ? em + ' ' : ''}${label}</h3><span>${d}/${list.length}</span></div><div class="grid">${list.map((b) => tileHTML(b, { now: now && now.id === b.id, i: i++ })).join('')}</div>`;
    }).join('');
    const coach = isToday ? coachLine() : null;
    $('#view').innerHTML = `<div class="pane ${dir > 0 ? 'in-l' : dir < 0 ? 'in-r' : ''}">
      <section class="card hero" style="--i:0">
        <p class="hello">${esc(rel)} · ${date}</p>
        <p class="big">${sum.done}<small> / ${sum.total} kutu ${cur > t ? 'planlı' : 'tamam'}</small></p>
        <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
        ${coach ? `<div class="coach-line"><b>${coach[0]}</b><span>${esc(coach[1])}</span></div>` : ''}
        ${isToday && (st.days >= 2 || st.comeback) ? `<div class="badges">${st.comeback ? '<span class="badge-pill back">🫶 Geri döndün</span>' : ''}${st.days >= 2 ? `<span class="badge-pill">🔥 ${st.days} günlük seri</span>` : ''}</div>` : ''}
        <div class="hero-actions">${!isToday ? '<button type="button" class="mini" data-today>↩ Bugüne dön</button>' : ''}${boxes.length ? `<button type="button" class="mini ${editMode ? 'on' : ''}" data-editmode aria-pressed="${editMode}">${editMode ? '✓ Düzenleme bitti' : '✎ Kutuları düzenle'}</button>` : ''}</div>
      </section>
      ${editMode ? '<p class="edit-note">Değiştirmek istediğin kutuya dokun. Yalnızca bu gün ya da her hafta için değiştirebilirsin.</p>' : ''}
      ${isToday && boxes.length && !editMode ? `<div class="energy" role="group" aria-label="Bugün enerjin nasıl?" style="--i:1"><span>Enerjin:</span>
        ${[['low', '😴 Yorgun'], ['ok', '🙂 İyi'], ['high', '⚡ Dolu']].map(([v, l]) => `<button type="button" class="pill ${en === v ? 'on' : ''}" data-energy="${v}">${l}</button>`).join('')}</div>` : ''}
      ${g.length && !editMode ? `<div class="part"><h3>Koçun ${isToday ? 'bugünkü' : 'o günkü'} adımı</h3><span>${g.filter((x) => x.done).length}/${g.length}</span></div>` : ''}
      ${editMode ? '' : g.map((x, k) => `<button type="button" class="growth ${x.done ? 'done' : ''}" data-growth="${x.path.id}" style="--i:${2 + k}" aria-label="${esc(x.path.title + ': ' + x.text + (x.done ? ', tamamlandı' : ''))}">
          <span class="em">${x.path.em}</span>
          <span class="gx"><span class="gh">${esc(x.path.title)} · ${x.idx + 1}. adım / ${x.path.steps.length}${x.step.topic ? ' · ' + esc(x.step.topic) : ''}</span>
          <p class="gt">${esc(x.text)}</p>${x.small ? '<span class="gs">Küçültülmüş adım. Bu da sayılır.</span>' : ''}</span>
          <span class="gc">✓</span></button>`).join('')}
      ${partsHTML}
      ${editMode ? '<div class="grid" style="margin-top:14px"><button type="button" class="tile add" data-addbox><span class="ci">＋</span><span class="nm">Bu güne kutu ekle</span></button></div>' : ''}
      ${!boxes.length ? `<section class="card empty-day"><div class="em">🧩</div><p><b>${isToday ? 'Kutuların burada görünecek' : 'Bu gün için kutu yok'}</b></p><p class="muted small">Alttaki “Görev Ekle” ile kutu yap ya da hazır bir paket ekle.</p><button type="button" class="btn" data-tabgo="settings">Hazır paketlere bak</button></section>` : `<p class="hint">Sağa sola kaydır: önceki / sonraki gün · Dokun: tamam · Basılı tut: seçenekler</p>`}</div>`;
  }

  // ---- Kutuya dokunma ----
  let ticker = null;
  function ensureTicker() {
    const t = today(), running = RK.boxesForDay(state, t).some((b) => b.kind === 'timer' && E(b.id, t).end && E(b.id, t).s !== 'done');
    if (running && !ticker) ticker = setInterval(tick, 1000);
    if (!running && ticker) { clearInterval(ticker); ticker = null; }
  }
  function tick() {
    let finished = null;
    const t = today();
    for (const b of RK.boxesForDay(state, t)) {
      const e = E(b.id, t);
      if (b.kind === 'timer' && e.end && e.s !== 'done' && Date.now() >= e.end) { setE(b.id, { s: 'done', end: null }, t); finished = b; }
    }
    if (finished) {
      save(); beep([659, 988]); navigator.vibrate?.([80, 60, 80]);
      toast(`${finished.em} ${finished.name}: süre doldu, tamam!`);
      afterDone();
    }
    if (tab === 'today' && cur === today() && !$('.sheet', layer) && !$('.ob')) renderDay();
    ensureTicker();
  }
  function tap(b, el) {
    if (cur > today()) return toast('Bu gün henüz gelmedi. Düzenlemek için ✎ Kutuları düzenle’ye dokun.');
    const undo = snapshot(), e = E(b.id), isToday = cur === today();
    const afterDone = isToday ? afterDoneToday : () => {};
    if (e.s === 'skip') { setE(b.id, { s: null }); save(); render(); return toast(`${b.em} ${b.name} yeniden açıldı`, undo); }
    if (b.kind === 'count') {
      if (e.s === 'done') { setE(b.id, { s: null, n: 0 }); save(); render(); return toast(`${b.em} sayaç sıfırlandı`, undo); }
      const n = (e.n || 0) + 1, goal = b.goal || 8;
      setE(b.id, n >= goal ? { n, s: 'done' } : { n });
      save();
      if (n >= goal) { sparkle(el, b.c); beep([659, 988]); render(); toast(`${b.em} ${b.name} hedefi tamam!`, undo); return afterDone(); }
      navigator.vibrate?.(10); render(); return toast(`${b.em} ${b.name} ${n}/${goal}`, undo);
    }
    if (b.kind === 'timer' && !e.s && !e.end && isToday) {
      setE(b.id, { end: Date.now() + (b.mins || 15) * 60000 });
      save(); render(); ensureTicker();
      return toast(`${b.em} ${b.mins || 15} dakika başladı. Bitirince kutuya dokun.`, undo);
    }
    if (e.s === 'done') { setE(b.id, { s: null, end: null }); save(); render(); return toast(`${b.em} ${b.name} geri açıldı`, undo); }
    setE(b.id, { s: 'done', end: null });
    save(); sparkle(el, b.c); beep([659, 988]); navigator.vibrate?.(15);
    render(); ensureTicker();
    toast(`${b.em} ${e.short && b.short ? b.short : b.name} tamam`, undo);
    afterDone();
  }
  function tapGrowth(pathId, el) {
    if (cur !== today()) return toast('Koçun adımı yalnızca bugün işaretlenir.');
    const undo = snapshot(), t = today();
    const p = state.paths.find((x) => x.id === pathId);
    if (!p) return;
    if (p.doneLog[t] !== undefined) {
      p.idx = p.doneLog[t]; delete p.doneLog[t];
      save(); render(); return toast(`${p.em} adım geri açıldı`, undo);
    }
    RK.completeGrowth(state, t, pathId);
    save(); sparkle(el, '#b8860b'); beep([523, 784, 1047], 0.4); navigator.vibrate?.(20);
    render();
    if (p.idx >= p.steps.length) setTimeout(() => party('🏅', `${p.title} yolu tamam!`, 'Bütün adımları bitirdin. Koç sekmesinden yeni bir yol seçebilirsin.'), 500);
    else toast(`${p.em} ${p.title}: ${p.idx}. adım tamam`, undo);
    afterDone();
  }

  // ---- Alt sayfalar ----
  function closeSheet() { $$('.backdrop,.sheet', layer).forEach((n) => n.remove()); document.body.classList.remove('locked'); }
  function openSheet(build) {
    closeSheet();
    const bd = document.createElement('div'); bd.className = 'backdrop'; bd.onclick = closeSheet;
    const sh = document.createElement('section'); sh.className = 'sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
    layer.append(bd, sh);
    document.body.classList.add('locked');
    build(sh);
    return sh;
  }
  const head = (title) => `<div class="sheet-head"><h2>${title}</h2><button type="button" class="x" data-close aria-label="Kapat">✕</button></div>`;
  const bindClose = (sh) => $$('[data-close]', sh).forEach((b) => (b.onclick = closeSheet));

  function boxMenu(b) {
    openSheet((sh) => {
      const e = E(b.id), isToday = cur === today(), isStar = isToday && state.star && state.star.date === today() && state.star.id === b.id;
      sh.innerHTML = `${head(`${b.em} ${esc(b.name)}`)}<div class="menu">
        <button type="button" data-a="edit"><span class="ci">✏️</span>Değiştir (bu gün ya da her hafta)</button>
        ${isToday && RK.toMin(b.time) !== null ? '<button type="button" data-a="snooze"><span class="ci">⏰</span>10 dk ertele</button>' : ''}
        ${b.short ? `<button type="button" data-a="short"><span class="ci">✂️</span>${e.short ? 'Tam sürüme dön' : 'Kısa sürüm: ' + esc(b.short)}</button>` : ''}
        ${cur <= today() ? '<button type="button" data-a="skip"><span class="ci">🌥️</span>Bugün olmadı</button>' : ''}
        ${isToday ? `<button type="button" data-a="star"><span class="ci">⭐</span>${isStar ? 'Günün 1 numarası değil' : 'Günün 1 numarası yap'}</button>` : ''}</div>`;
      bindClose(sh);
      $$('[data-a]', sh).forEach((btn) => (btn.onclick = () => {
        const a = btn.dataset.a, undo = snapshot();
        if (a === 'edit') return boxForm(b);
        if (a === 'snooze') {
          const m = Math.max(nowMin(), RK.toMin(e.snooze || b.time)) + 10;
          const hhmm = `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
          setE(b.id, { snooze: hhmm }); state.fired = (state.fired || []).filter((k) => !k.startsWith(`${today()}|${b.id}|`));
          toast(`${b.em} ${hhmm}'de hatırlatacağım`, undo);
        }
        if (a === 'short') { setE(b.id, { short: !e.short }); toast(e.short ? `${b.em} tam sürüm` : `${b.em} kısa sürüm: ${b.short}`, undo); }
        if (a === 'skip') { setE(b.id, { s: 'skip', end: null }); toast(`${b.em} tamam, olmadı. Sorun değil.`, undo); }
        if (a === 'star') { state.star = isStar ? null : { date: today(), id: b.id }; toast(isStar ? '⭐ kaldırıldı' : `⭐ Günün 1 numarası: ${b.name}`, undo); }
        save(); closeSheet(); render(); afterDone();
      }));
    });
  }
  function growthMenu(pathId) {
    const p = state.paths.find((x) => x.id === pathId);
    if (!p) return;
    openSheet((sh) => {
      sh.innerHTML = `${head(`${p.em} ${esc(p.title)}`)}<div class="menu">
        <button type="button" data-a="small"><span class="ci">🪶</span>${p.small ? 'Normal adıma dön' : 'Daha küçük bir adım ver'}</button>
        <button type="button" data-a="jump"><span class="ci">⏭️</span>Bu adımı geç (zaten yaptım / bana göre değil)</button>
        <button type="button" data-a="pause"><span class="ci">⏸️</span>Bu yolu duraklat</button></div>`;
      bindClose(sh);
      $$('[data-a]', sh).forEach((btn) => (btn.onclick = () => {
        const a = btn.dataset.a, undo = snapshot();
        if (a === 'small') { p.small = !p.small; toast(p.small ? '🪶 Adımı küçülttüm' : 'Normal adıma döndüm', undo); }
        if (a === 'jump' && p.doneLog[today()] === undefined) { p.idx = Math.min(p.idx + 1, p.steps.length); p.misses = 0; toast('⏭️ Sıradaki adıma geçtim', undo); }
        if (a === 'pause') { p.paused = true; state.log[today()].g = state.log[today()].g.filter((id) => id !== p.id); toast(`⏸️ ${p.title} duraklatıldı. Koç sekmesinden devam ettirebilirsin.`, undo); }
        save(); closeSheet(); render();
      }));
    });
  }

  /** Kutu ekleme / değiştirme. box: o günkü hâliyle kutu; opts.date: hangi gün için. */
  function boxForm(box, opts = {}) {
    const date = opts.date || cur, wd = RK.weekday(date);
    const base = box ? state.boxes.find((x) => x.id === box.id) : null;
    const guess = () => { const h = new Date().getHours(); return h < 9 ? 'sabah' : h < 18 ? 'gun' : 'aksam'; };
    const st = box
      ? { em: box.em, name: box.name, part: box.part, time: box.time || '', kind: box.kind, goal: box.goal || 8, mins: box.mins || 15, c: box.c, short: box.short || '', days: [...base.days] }
      : { em: '💧', name: '', part: opts.part || guess(), time: '', kind: 'tap', goal: 8, mins: 15, days: opts.date ? [wd] : [1, 2, 3, 4, 5, 6, 7], c: D.TILE_COLORS[state.boxes.length % D.TILE_COLORS.length], short: '' };
    const single = base && (base.once || base.days.length === 1);
    let scope = base ? opts.scope || (base.once ? 'all' : 'day') : null; // varsayılan: yalnızca bu gün
    let rep = base && base.once ? 'once' : st.days.length === 7 ? 'all' : st.days.join() === '1,2,3,4,5' ? 'wd' : 'pick';
    const chips = (name, curv, list) => `<div class="chips">${list.map(([v, l]) => `<button type="button" class="chip ${curv === v ? 'on' : ''}" data-set="${name}" data-v="${v}">${l}</button>`).join('')}</div>`;
    // Hazır seçenekler: programındaki diğer kutular (aynı bölümdekiler önce)
    const quick = [];
    for (const x of [...state.boxes].sort((a, b) => (a.part === st.part ? 0 : 1) - (b.part === st.part ? 0 : 1))) if (!quick.some((q) => q.name === x.name) && (!box || x.name !== box.name)) quick.push(x);
    openSheet((sh) => {
      const draw = () => {
        const scroll = sh.scrollTop;
        sh.innerHTML = `${head(box ? 'Kutuyu değiştir' : 'Yeni kutu')}
          ${base ? `<p class="muted small" style="margin:0">${LONG[wd - 1]} · ${dayLabel(date)}</p>
            <div class="seg ${single ? 'two' : ''}">${base.once ? '' : `<button type="button" class="${scope === 'day' ? 'on' : ''}" data-scope="day">Yalnızca bu gün</button>`}
            ${single ? '' : `<button type="button" class="${scope === 'wd' ? 'on' : ''}" data-scope="wd">Her ${LONG[wd - 1]}</button>`}
            <button type="button" class="${scope === 'all' ? 'on' : ''}" data-scope="all">${base.once ? 'Bu kutu' : single ? 'Her ' + LONG[base.days[0] - 1] : 'Tüm günleri'}</button></div>` : ''}
          <div class="preview-tile">${tileHTML({ ...st, name: st.name || 'Kutu adı', id: '_' }, { preview: true })}</div>
          ${box && quick.length ? `<div class="field"><span>Hazır seçenekler (programından)</span><div class="chips quick">${quick.slice(0, 14).map((q, i) => `<button type="button" class="chip" data-quick="${i}">${q.em} ${esc(q.name)}</button>`).join('')}</div></div>` : ''}
          <div class="field"><span>Simge</span><div class="emojis">${[...new Set([st.em, ...D.EMOJIS])].slice(0, 24).map((e) => `<button type="button" class="${st.em === e ? 'on' : ''}" data-em="${e}" aria-label="${e}">${e}</button>`).join('')}</div></div>
          <label class="field"><span>Ne yapacaksın?</span><input id="fName" type="text" value="${esc(st.name)}" placeholder="Örneğin: Vitamin al" maxlength="30" autocomplete="off"></label>
          <div class="field"><span>Günün hangi bölümü?</span>${chips('part', st.part, PARTS.map(([k, l, e]) => [k, `${e} ${l}`]))}</div>
          <label class="field"><span>Saat (boş bırakılabilir; saat varsa hatırlatırım)</span><input id="fTime" type="time" value="${esc(st.time)}"></label>
          <div class="field"><span>Nasıl bir kutu?</span>${chips('kind', st.kind, [['tap', '👆 Tek dokunuş'], ['count', '🔢 Sayaç'], ['timer', '⏱ Süreli']])}</div>
          ${st.kind === 'count' ? `<label class="field"><span>Günlük hedef (kaç kez?)</span><input id="fGoal" type="number" inputmode="numeric" min="2" max="30" value="${st.goal}"></label>` : ''}
          ${st.kind === 'timer' ? `<label class="field"><span>Kaç dakika?</span><input id="fMins" type="number" inputmode="numeric" min="1" max="240" value="${st.mins}"></label>` : ''}
          ${!base || (scope === 'all' && !base.once) ? `<div class="field"><span>Ne sıklıkla?</span>${chips('rep', rep, [['all', 'Her gün'], ['wd', 'Hafta içi'], ['pick', 'Günleri seç'], ...(base ? [] : [['once', `Yalnızca ${dayLabel(date)}`]])])}
            ${rep === 'pick' ? `<div class="chips" style="margin-top:8px">${DAYS.map((d, i) => `<button type="button" class="chip day ${st.days.includes(i + 1) ? 'on' : ''}" data-day="${i + 1}">${d}</button>`).join('')}</div>` : ''}</div>` : ''}
          <label class="field"><span>Kısa sürümü (yorgun günler için, isteğe bağlı)</span><input id="fShort" type="text" value="${esc(st.short)}" placeholder="Örneğin: 5 dakika" maxlength="30" autocomplete="off"></label>
          <div class="field"><span>Renk</span><div class="swatches">${[...new Set([st.c, ...D.TILE_COLORS])].map((c) => `<button type="button" class="${st.c === c ? 'on' : ''}" style="background:${c}" data-color="${c}" aria-label="Renk"></button>`).join('')}</div></div>
          <div style="margin-top:18px;display:grid;gap:8px"><button type="button" class="btn primary wide big" data-save>${box ? 'Kaydet' : 'Kutuyu ekle'}</button>
          ${base ? `<button type="button" class="btn danger wide" data-del>🗑️ ${scope === 'day' ? 'Yalnızca bu günden kaldır' : scope === 'wd' ? `Her ${LONG[wd - 1]} gününden kaldır` : single && !base.once ? `Her ${LONG[base.days[0] - 1]} için sil` : 'Kutuyu tamamen sil'}</button>` : ''}</div>`;
        sh.scrollTop = scroll;
        bindClose(sh);
        const read = () => {
          st.name = $('#fName', sh).value; st.time = $('#fTime', sh).value; st.short = $('#fShort', sh).value;
          if ($('#fGoal', sh)) st.goal = Math.max(2, Math.min(30, +$('#fGoal', sh).value || 8));
          if ($('#fMins', sh)) st.mins = Math.max(1, Math.min(240, +$('#fMins', sh).value || 15));
        };
        $('#fName', sh).oninput = (e) => { $('.preview-tile .nm', sh).textContent = e.target.value || 'Kutu adı'; };
        $$('[data-scope]', sh).forEach((b) => (b.onclick = () => { read(); scope = b.dataset.scope; draw(); }));
        $$('[data-quick]', sh).forEach((b) => (b.onclick = () => { const q = quick[+b.dataset.quick]; Object.assign(st, { em: q.em, name: q.name, c: q.c, kind: q.kind, mins: q.mins || 15, goal: q.goal || 8, short: q.short || '' }); draw(); }));
        $$('[data-em]', sh).forEach((b) => (b.onclick = () => { read(); st.em = b.dataset.em; draw(); }));
        $$('[data-color]', sh).forEach((b) => (b.onclick = () => { read(); st.c = b.dataset.color; draw(); }));
        $$('[data-day]', sh).forEach((b) => (b.onclick = () => { read(); const d = +b.dataset.day; st.days = st.days.includes(d) ? st.days.filter((x) => x !== d) : [...st.days, d].sort(); draw(); }));
        $$('[data-set]', sh).forEach((b) => (b.onclick = () => {
          read();
          if (b.dataset.set === 'rep') { rep = b.dataset.v; if (rep === 'all') st.days = [1, 2, 3, 4, 5, 6, 7]; if (rep === 'wd') st.days = [1, 2, 3, 4, 5]; }
          else st[b.dataset.set] = b.dataset.v;
          draw();
        }));
        $('[data-save]', sh).onclick = () => {
          read();
          if (!st.name.trim()) { const n = $('#fName', sh); n.placeholder = 'Önce bir ad yaz'; n.focus(); return; }
          if (rep === 'pick' && !st.days.length) return toast('En az bir gün seç');
          const undo = snapshot();
          st.name = st.name.trim(); st.short = st.short.trim();
          let msg;
          if (base) {
            RK.editBox(state, base.id, scope === 'all' && !base.once ? st : { ...st, days: undefined }, scope, date);
            msg = `${st.em} ${st.name}: ${scope === 'day' ? `yalnızca ${dayLabel(date)}` : scope === 'wd' ? `her ${LONG[wd - 1]}` : single && !base.once ? `her ${LONG[base.days[0] - 1]}` : 'tüm günlerde güncellendi'}`;
          } else {
            const nb = { ...st, id: RK.uid() };
            if (rep === 'once') { nb.once = date; nb.days = []; }
            state.boxes.push(nb);
            msg = `${st.em} ${st.name} eklendi`;
          }
          save(); closeSheet(); render(); toast(msg, undo);
        };
        const del = $('[data-del]', sh);
        if (del) del.onclick = () => {
          const undo = snapshot();
          RK.removeBox(state, base.id, scope, date);
          save(); closeSheet(); render();
          toast(`${box.em} ${box.name} ${scope === 'day' ? 'bu günden kaldırıldı' : scope === 'wd' ? `${LONG[wd - 1]} günlerinden kaldırıldı` : 'silindi'}`, undo);
        };
      };
      draw();
    });
  }

  // ---- Hafta ----
  function renderWeek() {
    const t = today(), start = RK.addDays(RK.weekStart(t), weekOffset * 7);
    const fmt = (d) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(RK.parse(d));
    const cards = DAYS.map((n, i) => {
      const date = RK.addDays(start, i), boxes = RK.boxesForDay(state, date), sum = RK.daySummary(state, date), open = openWeekDay === date;
      const dots = boxes.map((b) => { const e = RK.entry(state, date, b.id) || {}; return `<i class="${e.s === 'done' ? 'on' : e.s === 'skip' ? 'sk' : ''}" style="--c:${b.c}"></i>`; }).join('')
        + state.paths.filter((p) => p.doneLog[date] !== undefined).map(() => '<i class="on g" style="--c:#b8860b"></i>').join('');
      const work = boxes.filter((b) => b.part === 'calisma');
      return `<section class="card wday ${date === t ? 'today' : ''}">
        <button type="button" class="wday-top" data-open="${date}" aria-label="${LONG[i]} ${+date.slice(8)}: ${sum.done}/${sum.total}, günü aç">
          <span class="wday-date"><span class="n">${n}</span><span class="d">${+date.slice(8)}</span></span>
          <span class="wday-mid"><span class="dots" aria-hidden="true">${dots || '<span class="small muted">kutu yok</span>'}</span></span>
          <span class="wday-pc">${sum.done}/${sum.total} ›</span></button>
        ${!open && work.length ? `<div class="slots">${work.map((b) => `<button type="button" class="slot-btn" style="--c:${b.c}" data-wbox="${date}|${b.id}" aria-label="${esc(b.name)} ${esc(b.time)}, değiştir"><span class="e">${b.em}</span><span class="t"><b>${esc(b.name)}</b><span>${esc(b.time)}${b.dayOnly ? ' · yalnız bu gün' : ''}</span></span><span class="pen">✎</span></button>`).join('')}</div>` : ''}
        ${open ? PARTS.map(([k, label]) => { const l = boxes.filter((b) => b.part === k); return l.length ? `<div class="wpart">${label}</div><div class="slots">${l.map((b) => `<button type="button" class="slot-btn" style="--c:${b.c}" data-wbox="${date}|${b.id}" aria-label="${esc(b.name)} ${esc(b.time)}, değiştir"><span class="e">${b.em}</span><span class="t"><b>${esc(b.name)}</b><span>${esc(b.time || '')}${b.dayOnly ? ' · yalnız bu gün' : ''}</span></span><span class="pen">✎</span></button>`).join('')}</div>` : ''; }).join('') + `<div class="slots"><button type="button" class="slot-btn empty" data-wadd="${date}"><span class="e">＋</span><span class="t"><b>Kutu ekle</b><span>${LONG[i]}</span></span></button></div>` : ''}
        <div class="wday-actions"><button type="button" class="link" data-open="${date}">${LONG[i]} gününü aç →</button><button type="button" class="link" data-wtoggle="${date}">${open ? 'Kapat' : '✎ Tüm kutuları düzenle'}</button></div></section>`;
    }).join('');
    const top = state.boxes.map((b) => [b, RK.boxStreak(state, b, t)]).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const st = RK.streak(state, t);
    $('#view').innerHTML = `
      <div class="month-nav"><button type="button" data-week="-1" aria-label="Önceki hafta">‹</button><b>${fmt(start)} – ${fmt(RK.addDays(start, 6))}${weekOffset === 0 ? ' · bu hafta' : ''}</b><button type="button" data-week="1" aria-label="Sonraki hafta">›</button></div>
      ${cards}
      <section class="card"><h2>Seriler</h2>
        <ul class="streaks"><li><span>🔥</span><span class="nm">Ritim (en az bir kutu)</span><span class="n">${st.days} gün</span></li>
        ${top.map(([b, n]) => `<li><span>${b.em}</span><span class="nm">${esc(b.name)}</span><span class="n">🔥 ${n}</span></li>`).join('')}</ul>
        <p class="small muted" style="margin:12px 0 0">Seri bozulunca ceza yok. Döndüğünde kaldığın yerden devam ederiz.</p></section>`;
  }

  // ---- Koç ----
  const pathDef = (key) => D.PATHS[key];
  const modeLabel = { basla: 'Başla', derin: 'Derinleş', dene: 'Bir haftalık deneme' };
  function personaText(p) {
    const ints = p.interests.map((i) => `${i.name}${i.level === 'meslek' ? ' (mesleği)' : i.level === 'yillar' ? ' (yıllardır)' : ' (yeni)'}`);
    const dreams = p.dreams.map((k) => (pathDef(k) ? pathDef(k).name : k));
    const when = { sabah: 'sabah insanı', gun: 'gün içi insanı', aksam: 'akşam insanı' }[p.when];
    return { ints, dreams, when };
  }
  function renderCoach() {
    const t = today(), p = state.profile;
    const [q, a] = D.QUOTES[quoteIdx], fav = state.favQuotes.includes(quoteIdx);
    if (!p) {
      $('#view').innerHTML = `<section class="card"><div class="tip"><span class="em">🧭</span><div><p><b>Önce tanışalım</b></p><p class="muted">Seni tanıyayım; neyi sevdiğini, neyi hayal ettiğini öğreneyim. Sonra sana özel küçük günlük adımlar hazırlarım.</p><div class="actions"><button type="button" class="btn primary" data-onboard>Tanışmaya başla</button></div></div></div></section>`;
      return;
    }
    const pt = personaText(p);
    const active = state.paths.filter((x) => x.idx < x.steps.length && !x.paused), paused = state.paths.filter((x) => x.paused && x.idx < x.steps.length), finished = state.paths.filter((x) => x.idx >= x.steps.length);
    const sug = RK.suggestions(p, D.SUGGEST, D.PATHS).filter((k) => !state.paths.some((x) => x.key === k));
    const wk = RK.weekStart(t), sunday = RK.weekday(t) === 7, needCheck = sunday && !state.checkins[wk] && active.length;
    const sum = RK.daySummary(state, t), left = RK.boxesForDay(state, t).filter((b) => !E(b.id).s);
    const evening = new Date().getHours() >= 20 && sum.total > 0;
    const pathHTML = (x) => {
      const pct = Math.round((x.idx / x.steps.length) * 100), step = x.steps[Math.min(x.idx, x.steps.length - 1)];
      return `<div class="path"><div class="path-head"><span class="em">${x.em}</span><span class="tx"><b>${esc(x.title)}<span class="tag gold">${modeLabel[x.mode]}</span>${x.daily ? '<span class="tag">her gün</span>' : ''}</b>
        <span class="small muted">${x.idx} / ${x.steps.length} adım</span></span><button type="button" class="x" data-pathmenu="${x.id}" aria-label="${esc(x.title)} seçenekleri">⋯</button></div>
        <div class="bar thin gold"><span style="width:${pct}%"></span></div>
        ${x.idx < x.steps.length ? `<p class="next"><span>Sıradaki:</span> ${esc(x.small ? step.s : step.t)}</p>` : '<p class="next">🏅 Yol tamamlandı.</p>'}</div>`;
    };
    $('#view').innerHTML = `
      <section class="card quote-card"><p class="q">“${esc(q)}”</p><div class="row"><p class="a">${esc(a)}</p><button type="button" data-fav aria-label="${fav ? 'Favorilerden çıkar' : 'Favorilere ekle'}" aria-pressed="${fav}">${fav ? '⭐' : '☆'}</button></div></section>
      <section class="card"><div class="persona"><span class="av">🧑</span><div>
        <h3>${esc(p.name)}</h3>
        ${pt.ints.length ? `<p><b>Sevdiği:</b> ${esc(pt.ints.join(', '))}</p>` : ''}
        ${pt.dreams.length ? `<p><b>Hayali:</b> ${esc(pt.dreams.join(', '))}</p>` : ''}
        <p class="muted">${pt.when} · günde ${p.minutes} dakika</p>
        <button type="button" class="link" data-onboard>Kendimi yeniden tanıtayım</button></div></div></section>
      ${needCheck ? `<section class="card"><h2>Haftalık görüşme</h2><p>Bu hafta adımlar nasıldı? Cevabına göre hızını ayarlayacağım.</p>
        ${active.map((x) => `<div class="check-row"><b>${x.em} ${esc(x.title)}</b><div class="chips">${[['kolay', '😌 Kolay'], ['iyi', '👌 Kıvamında'], ['zor', '😮‍💨 Zor']].map(([v, l]) => `<button type="button" class="chip" data-check="${x.id}" data-v="${v}">${l}</button>`).join('')}</div></div>`).join('')}
        <div class="actions"><button type="button" class="btn primary" data-checkdone>Görüşmeyi bitir</button></div></section>` : ''}
      ${evening ? `<section class="card"><div class="tip"><span class="em">🌙</span><div><p><b>Akşam özeti</b></p><p>Bugün ${sum.done}/${sum.total}. ${left.length ? `${esc(left.slice(0, 2).map((b) => b.name).join(' ve '))} kaldı; yarın yeni bir gün.` : 'Hepsi tamam, harika bir gün.'}</p></div></div></section>` : ''}
      <section class="card"><h2>Yolların</h2>
        ${active.length ? active.map(pathHTML).join('') : '<p class="muted">Şu an açık bir yolun yok. Aşağıdan bir tane seç.</p>'}
        <div class="actions"><button type="button" class="btn" data-newpath>＋ Yeni yol ekle</button></div></section>
      ${sug.length ? `<section class="card"><h2>Keşfet: sana uyabilir</h2>
        ${sug.map((k) => `<div class="pack"><span class="em">${pathDef(k).em}</span><span class="tx"><b>${esc(pathDef(k).name)}</b><span class="small muted">5 küçük adımla bir hafta dene</span></span><button type="button" class="btn" data-try="${k}">Dene</button></div>`).join('')}</section>` : ''}
      ${paused.length ? `<section class="card"><h2>Duraklatılanlar</h2>${paused.map((x) => `<div class="pack"><span class="em">${x.em}</span><span class="tx"><b>${esc(x.title)}</b><span class="small muted">${x.idx} / ${x.steps.length} adım</span></span><button type="button" class="btn" data-resume="${x.id}">Devam et</button></div>`).join('')}</section>` : ''}
      ${finished.length ? `<section class="card"><h2>Tamamlananlar</h2>${finished.map((x) => `<p>🏅 ${x.em} ${esc(x.title)} <span class="muted small">(${x.steps.length} adım)</span></p>`).join('')}</section>` : ''}
      ${state.favQuotes.length ? `<section class="card"><h2>Sakladığın sözler</h2>${state.favQuotes.map((i) => `<p class="hand" style="font-size:20px;line-height:1.2">“${esc(D.QUOTES[i][0])}” <span class="small muted" style="font-family:inherit">${esc(D.QUOTES[i][1])}</span></p>`).join('')}</section>` : ''}`;
  }

  function pathMenu(id) {
    const p = state.paths.find((x) => x.id === id);
    openSheet((sh) => {
      sh.innerHTML = `${head(`${p.em} ${esc(p.title)}`)}<p class="muted small">${p.steps.length} adımlık ${modeLabel[p.mode].toLowerCase()} yolu.</p><div class="menu">
        <button type="button" data-a="daily"><span class="ci">📌</span>${p.daily ? 'Her gün sorma' : 'Her gün bir adım ver'}</button>
        <button type="button" data-a="steps"><span class="ci">📜</span>Bütün adımları gör</button>
        <button type="button" data-a="pause"><span class="ci">⏸️</span>Duraklat</button>
        <button type="button" class="danger" data-a="del"><span class="ci">🗑️</span>Yolu sil</button></div>`;
      bindClose(sh);
      $$('[data-a]', sh).forEach((b) => (b.onclick = () => {
        const a = b.dataset.a, undo = snapshot();
        if (a === 'steps') {
          sh.innerHTML = `${head(`${p.em} ${esc(p.title)}`)}<ol style="padding-left:22px;margin:0">${p.steps.map((s, i) => `<li style="margin:8px 0;${i < p.idx ? 'color:var(--muted);text-decoration:line-through' : i === p.idx ? 'font-weight:650' : ''}">${esc(s.t)}${s.topic ? ` <span class="tag">${esc(s.topic)}</span>` : ''}</li>`).join('')}</ol>`;
          return bindClose(sh);
        }
        if (a === 'daily') { p.daily = !p.daily; toast(p.daily ? `📌 ${p.title}: her gün bir adım` : 'Sırayla soracağım', undo); }
        if (a === 'pause') { p.paused = true; toast(`⏸️ ${p.title} duraklatıldı`, undo); }
        if (a === 'del') { state.paths = state.paths.filter((x) => x.id !== p.id); toast(`${p.title} yolu silindi`, undo); }
        if (state.log[today()] && state.log[today()].g && (a === 'pause' || a === 'del')) state.log[today()].g = state.log[today()].g.filter((x) => x !== p.id);
        save(); closeSheet(); render();
      }));
    });
  }
  function newPath() {
    let custom = '', mode = 'basla';
    openSheet((sh) => {
      const have = new Set(state.paths.filter((x) => x.idx < x.steps.length).map((x) => x.key));
      const draw = () => {
        sh.innerHTML = `${head('Yeni yol')}
          <div class="field"><span>Bu konuda neredesin?</span><div class="chips">${[['basla', '🌱 Yeni başlıyorum'], ['derin', '🚀 Zaten yapıyorum, gelişmek istiyorum']].map(([v, l]) => `<button type="button" class="chip ${mode === v ? 'on' : ''}" data-mode="${v}">${l}</button>`).join('')}</div></div>
          <div class="field"><span>Hazır yollar</span><div class="chips">${Object.values(D.PATHS).filter((d) => !have.has(d.key)).map((d) => `<button type="button" class="chip" data-key="${d.key}">${d.em} ${esc(d.name)}</button>`).join('')}</div></div>
          <div class="field"><span>Listede yoksa yaz</span><div class="inline-add"><input id="cName" type="text" placeholder="Örneğin: Seramik" maxlength="24" value="${esc(custom)}" autocomplete="off"><button type="button" class="btn primary" data-custom>Ekle</button></div></div>`;
        bindClose(sh);
        $$('[data-mode]', sh).forEach((b) => (b.onclick = () => { custom = $('#cName', sh).value; mode = b.dataset.mode; draw(); }));
        const add = (path) => { const undo = snapshot(); RK.addPath(state, path, today()); save(); closeSheet(); render(); toast(`${path.em} ${path.title} yolu eklendi`, undo); };
        $$('[data-key]', sh).forEach((b) => (b.onclick = () => {
          const def = D.PATHS[b.dataset.key];
          if (def.topics && mode === 'derin') return topicSheet(def, (r) => add(RK.buildPath(def, 'derin', r)));
          add(def[mode] || def.topics ? RK.buildPath(def, mode) : Object.assign(RK.genericPath(def.name, mode, D.GENERIC), { em: def.em, c: def.c, key: def.key }));
        }));
        $('[data-custom]', sh).onclick = () => { const n = $('#cName', sh).value.trim(); if (!n) return $('#cName', sh).focus(); add(RK.genericPath(n, mode, D.GENERIC)); };
      };
      draw();
    });
  }
  function topicSheet(def, done, initial) {
    const r = Object.assign({}, initial);
    openSheet((sh) => {
      const draw = () => {
        const scroll = sh.scrollTop;
        sh.innerHTML = `${head(`${def.em} ${esc(def.name)}: neyi biliyorsun?`)}<p class="muted small">Bilmediklerinden başlayacağım. Bildiklerini atlarım.</p>
          ${Object.entries(def.topics).map(([k, tpc]) => `<div class="ob-row"><b>${esc(tpc.name)}</b><div class="chips">${[['yok', 'Hiç bilmiyorum'], ['az', 'Az biliyorum'], ['var', 'Biliyorum']].map(([v, l]) => `<button type="button" class="chip ${(r[k] || 'yok') === v ? 'on' : ''}" data-t="${k}" data-v="${v}">${l}</button>`).join('')}</div></div>`).join('')}
          <button type="button" class="btn primary wide big" data-ok>Yolumu kur</button>`;
        sh.scrollTop = scroll;
        bindClose(sh);
        $$('[data-t]', sh).forEach((b) => (b.onclick = () => { r[b.dataset.t] = b.dataset.v; draw(); }));
        $('[data-ok]', sh).onclick = () => {
          if (Object.keys(def.topics).every((k) => r[k] === 'var')) return toast('Hepsini biliyorsan en az birini “az” seç; seni zorlayacak bir şey bulalım');
          done(r);
        };
      };
      draw();
    });
  }

  // ---- Tanışma: herkes kendini koça tanıtır ----
  function onboard() {
    closeSheet();
    const old = state.profile;
    const ob = {
      name: old ? old.name : '', interests: old ? old.interests.map((i) => ({ ...i })) : [], dreams: old ? [...old.dreams] : [], customDreams: old ? [...(old.customDreams || [])] : [],
      blocker: old ? old.blocker : null, minutes: old ? old.minutes : 20, when: old ? old.when : 'aksam', ratings: old ? { ...(old.ratings || {}) } : {}, packs: null,
    };
    let step = 0;
    const el = document.createElement('div');
    el.className = 'ob';
    document.body.appendChild(el);
    document.body.classList.add('locked');
    const hasInt = (k) => ob.interests.some((i) => i.key === k);
    const muzikDeep = () => ob.interests.some((i) => i.key === 'muzik' && i.level !== 'yeni');
    const steps = () => ['name', 'interests', ...(ob.interests.length ? ['levels'] : []), 'dreams', ...(ob.dreams.length || ob.customDreams.length ? ['blocker'] : []), 'time', ...(muzikDeep() ? ['topics'] : []), ...(old ? [] : ['packs']), 'card'];
    const say = (title, text) => `<div class="coach-say"><span class="av">🧭</span><div class="bub"><h2>${title}</h2><p>${text}</p></div></div>`;
    const finish = () => {
      const undo = snapshot();
      state.profile = { name: ob.name.trim() || 'Dostum', interests: ob.interests, dreams: ob.dreams, customDreams: ob.customDreams, blocker: ob.blocker, minutes: ob.minutes, when: ob.when, ratings: ob.ratings };
      const t = today();
      const open = (key) => state.paths.some((x) => x.key === key && x.idx < x.steps.length);
      for (const i of ob.interests) {
        if (i.key === 'ozel') { if (!state.paths.some((x) => x.title === i.name)) RK.addPath(state, RK.genericPath(i.name, i.level === 'yeni' ? 'basla' : 'derin', D.GENERIC), t); continue; }
        if (open(i.key)) continue;
        const def = D.PATHS[i.key], mode = i.level === 'yeni' ? 'basla' : 'derin';
        if (def.topics && mode === 'derin') RK.addPath(state, RK.buildPath(def, 'derin', ob.ratings), t);
        else if (def[mode]) RK.addPath(state, RK.buildPath(def, mode), t);
        else RK.addPath(state, Object.assign(RK.genericPath(def.name, mode, D.GENERIC), { em: def.em, c: def.c, key: def.key }), t);
      }
      for (const k of ob.dreams) if (!open(k)) RK.addPath(state, RK.buildPath(D.PATHS[k], 'basla'), t);
      for (const n of ob.customDreams) if (!state.paths.some((x) => x.title === n)) RK.addPath(state, RK.genericPath(n, 'basla', D.GENERIC), t);
      for (const k of ob.packs || []) addPack(k, true);
      cur = t; delete state.log[t].g; state.lastRoll = null;
      RK.rollDay(state, t);
      save(); el.remove(); document.body.classList.remove('locked');
      tab = 'today'; render(); enter();
      toast(old ? 'Karakter kartın güncellendi' : `Hoş geldin ${state.profile.name}! İlk adımların hazır.`, old ? undo : null);
    };
    const draw = () => {
      const list = steps(), cur = list[step];
      let body = '';
      if (cur === 'name') body = `${say('Merhaba, ben koçun.', 'Seni tanımak istiyorum. Birkaç kısa soru soracağım; sonra sana özel küçük günlük adımlar hazırlayacağım.')}
        <label class="field"><span>Sana nasıl hitap edeyim?</span><input id="obName" type="text" value="${esc(ob.name)}" placeholder="Adın" maxlength="20" autocomplete="given-name"></label>`;
      if (cur === 'interests') body = `${say(`${esc(ob.name.trim() || 'Peki')}, seni ne heyecanlandırır?`, 'Yaptığın ya da ilgilendiğin her şeyi seç. Listede yoksa yaz.')}
        <div class="chips">${Object.values(D.PATHS).map((d) => `<button type="button" class="chip ${hasInt(d.key) ? 'on' : ''}" data-int="${d.key}">${d.em} ${esc(d.name)}</button>`).join('')}
        ${ob.interests.filter((i) => i.key === 'ozel').map((i) => `<button type="button" class="chip on" data-intx="${esc(i.name)}">✨ ${esc(i.name)} ✕</button>`).join('')}</div>
        <div class="inline-add"><input id="obAdd" type="text" placeholder="Başka bir şey: örneğin Seramik" maxlength="24" autocomplete="off"><button type="button" class="btn" data-addint>Ekle</button></div>`;
      if (cur === 'levels') body = `${say('Bunlarda ne kadar ilerisin?', 'İleri olduklarında bilmediklerini bulur, seni oraya yönlendiririm.')}
        ${ob.interests.map((i, n) => `<div class="ob-row"><b>${i.key === 'ozel' ? '✨' : D.PATHS[i.key].em} ${esc(i.name)}</b><div class="chips">${D.LEVELS.map(([v, l]) => `<button type="button" class="chip ${i.level === v ? 'on' : ''}" data-lvl="${n}" data-v="${v}">${l}</button>`).join('')}</div></div>`).join('')}`;
      if (cur === 'dreams') body = `${say('Hep hayal edip hiç başlamadığın bir şey var mı?', 'Başlamak en zor kısım. Onu ben küçük adımlara böleceğim.')}
        <div class="chips">${Object.values(D.PATHS).filter((d) => !hasInt(d.key)).map((d) => `<button type="button" class="chip ${ob.dreams.includes(d.key) ? 'on' : ''}" data-dream="${d.key}">${d.em} ${esc(d.name)}</button>`).join('')}
        ${ob.customDreams.map((n) => `<button type="button" class="chip on" data-dreamx="${esc(n)}">✨ ${esc(n)} ✕</button>`).join('')}</div>
        <div class="inline-add"><input id="obAdd" type="text" placeholder="Başka bir hayal: örneğin Yelken" maxlength="24" autocomplete="off"><button type="button" class="btn" data-adddream>Ekle</button></div>`;
      if (cur === 'blocker') body = `${say('Seni şimdiye kadar ne durdurdu?', 'Dürüst cevap en iyisi; adımları buna göre ayarlayacağım.')}
        <div class="chips">${D.BLOCKERS.map(([v, l]) => `<button type="button" class="chip ${ob.blocker === v ? 'on' : ''}" data-block="${v}">${l}</button>`).join('')}</div>`;
      if (cur === 'time') body = `${say('Kendine günde ne kadar vakit ayırabilirsin?', 'Az olsun ama her gün olsun. 15 dakikaya kadar günde bir, fazlasında iki adım veririm.')}
        <div class="ob-row"><b>Günde</b><div class="chips">${[10, 15, 20, 30, 45].map((m) => `<button type="button" class="chip ${ob.minutes === m ? 'on' : ''}" data-min="${m}">${m} dk</button>`).join('')}</div></div>
        <div class="ob-row"><b>En verimli olduğun zaman</b><div class="chips">${[['sabah', '🌅 Sabah'], ['gun', '☀️ Gün içi'], ['aksam', '🌙 Akşam']].map(([v, l]) => `<button type="button" class="chip ${ob.when === v ? 'on' : ''}" data-when="${v}">${l}</button>`).join('')}</div></div>`;
      if (cur === 'topics') body = `${say('Müzikte neyi biliyorsun, neyi bilmiyorsun?', 'Bilmediklerinden başlayacağım. Böylece her gün yeni bir şey öğrenirsin.')}
        ${Object.entries(D.PATHS.muzik.topics).map(([k, tpc]) => `<div class="ob-row"><b>${esc(tpc.name)}</b><div class="chips">${[['yok', 'Hiç bilmiyorum'], ['az', 'Az biliyorum'], ['var', 'Biliyorum']].map(([v, l]) => `<button type="button" class="chip ${(ob.ratings[k] || 'yok') === v ? 'on' : ''}" data-rate="${k}" data-v="${v}">${l}</button>`).join('')}</div></div>`).join('')}`;
      if (cur === 'packs') {
        if (!ob.packs) ob.packs = muzikDeep() ? ['aksamMuzik'] : [];
        body = `${say('Günlük rutinlerini de ekleyeyim mi?', 'Hazır paketlerden seç; sonra her kutuyu değiştirebilir ya da silebilirsin. İstersen boş geç.')}
        ${Object.entries(D.PACKS).map(([k, pk]) => `<button type="button" class="ob-row" style="display:flex;gap:12px;align-items:center;width:100%;text-align:left;border:2px solid ${ob.packs.includes(k) ? 'var(--accent)' : 'transparent'}" data-pack="${k}"><span style="font-size:26px">${pk.em}</span><span style="flex:1"><b style="margin:0">${esc(pk.name)}</b><span class="small muted">${esc(pk.desc)}</span></span><span>${ob.packs.includes(k) ? '✅' : '＋'}</span></button>`).join('')}`;
      }
      if (cur === 'card') {
        const pt = personaText({ ...ob, name: ob.name });
        const all = [...ob.interests.map((i) => `${i.key === 'ozel' ? '✨' : D.PATHS[i.key].em} ${i.name}: ${i.level === 'yeni' ? 'başla' : 'derinleş'}`), ...ob.dreams.map((k) => `${D.PATHS[k].em} ${D.PATHS[k].name}: ilk adımlar`), ...ob.customDreams.map((n) => `✨ ${n}: ilk adımlar`)];
        body = `${say('Seni tanıdığıma sevindim.', 'Karakter kartın hazır. İstediğin zaman Koç sekmesinden güncelleyebilirsin.')}
        <section class="card"><div class="persona"><span class="av">🧑</span><div><h3>${esc(ob.name.trim() || 'Dostum')}</h3>
          ${pt.ints.length ? `<p><b>Sevdiği:</b> ${esc(pt.ints.join(', '))}</p>` : ''}${pt.dreams.length || ob.customDreams.length ? `<p><b>Hayali:</b> ${esc([...pt.dreams, ...ob.customDreams].join(', '))}</p>` : ''}
          <p class="muted">${pt.when} · günde ${ob.minutes} dakika</p></div></div></section>
        <section class="card"><h2>Senin için kuracağım yollar</h2>${all.length ? all.map((x) => `<p>${esc(x)}</p>`).join('') : '<p class="muted">Henüz bir ilgi alanı seçmedin. Sonra Koç sekmesinden yol ekleyebilirsin.</p>'}
          <p class="small muted" style="margin-top:8px">Her gün kutularının arasına ${ob.minutes <= 15 ? 'bir' : 'en fazla iki'} altın “gelişim kutusu” koyacağım.</p></section>`;
      }
      el.innerHTML = `<div class="wrap"><div class="ob-dots">${list.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>${body}</div>
        <div class="ob-foot"><div class="wrap">${step > 0 ? '<button type="button" class="btn back" data-back>Geri</button>' : old ? '<button type="button" class="btn back" data-quit>Vazgeç</button>' : ''}<button type="button" class="btn primary big" data-next>${cur === 'card' ? 'Yolculuğa başla' : 'Devam'}</button></div></div>`;
      el.scrollTop = 0;
      const keep = () => { const n = $('#obName', el); if (n) ob.name = n.value; };
      const redraw = () => { const y = el.scrollTop; keep(); draw(); el.scrollTop = y; };
      $('[data-next]', el).onclick = () => { keep(); if (cur === 'card') return finish(); step++; draw(); };
      const back = $('[data-back]', el); if (back) back.onclick = () => { keep(); step--; draw(); };
      const quit = $('[data-quit]', el); if (quit) quit.onclick = () => { el.remove(); document.body.classList.remove('locked'); };
      $$('[data-int]', el).forEach((b) => (b.onclick = () => { const k = b.dataset.int; ob.interests = hasInt(k) ? ob.interests.filter((i) => i.key !== k) : [...ob.interests, { key: k, name: D.PATHS[k].name, level: 'yillar' }]; ob.dreams = ob.dreams.filter((d) => d !== k); redraw(); }));
      $$('[data-intx]', el).forEach((b) => (b.onclick = () => { ob.interests = ob.interests.filter((i) => !(i.key === 'ozel' && i.name === b.dataset.intx)); redraw(); }));
      const addInt = $('[data-addint]', el); if (addInt) addInt.onclick = () => { const n = $('#obAdd', el).value.trim(); if (n && !ob.interests.some((i) => i.name === n)) ob.interests.push({ key: 'ozel', name: n, level: 'yillar' }); redraw(); };
      $$('[data-lvl]', el).forEach((b) => (b.onclick = () => { ob.interests[+b.dataset.lvl].level = b.dataset.v; redraw(); }));
      $$('[data-dream]', el).forEach((b) => (b.onclick = () => { const k = b.dataset.dream; ob.dreams = ob.dreams.includes(k) ? ob.dreams.filter((d) => d !== k) : [...ob.dreams, k]; redraw(); }));
      $$('[data-dreamx]', el).forEach((b) => (b.onclick = () => { ob.customDreams = ob.customDreams.filter((n) => n !== b.dataset.dreamx); redraw(); }));
      const addDream = $('[data-adddream]', el); if (addDream) addDream.onclick = () => { const n = $('#obAdd', el).value.trim(); if (n && !ob.customDreams.includes(n)) ob.customDreams.push(n); redraw(); };
      $$('[data-block]', el).forEach((b) => (b.onclick = () => { ob.blocker = b.dataset.block; redraw(); }));
      $$('[data-min]', el).forEach((b) => (b.onclick = () => { ob.minutes = +b.dataset.min; redraw(); }));
      $$('[data-when]', el).forEach((b) => (b.onclick = () => { ob.when = b.dataset.when; redraw(); }));
      $$('[data-rate]', el).forEach((b) => (b.onclick = () => { ob.ratings[b.dataset.rate] = b.dataset.v; redraw(); }));
      $$('[data-pack]', el).forEach((b) => (b.onclick = () => { const k = b.dataset.pack; ob.packs = ob.packs.includes(k) ? ob.packs.filter((x) => x !== k) : [...ob.packs, k]; redraw(); }));
    };
    draw();
  }

  // ---- Ayarlar ----
  function addPack(key, silent) {
    const pk = D.PACKS[key], undo = silent ? null : snapshot();
    let n = 0;
    for (const b of pk.boxes) {
      if (state.boxes.some((x) => x.name === b.name && x.time === b.time && x.days.join() === b.days.join())) continue;
      state.boxes.push({ ...b, days: [...b.days], id: RK.uid() }); n++;
    }
    if (!silent) { save(); render(); toast(n ? `${pk.em} ${pk.name}: ${n} kutu eklendi` : 'Bu paket zaten ekli', n ? undo : null); }
  }
  function renderSettings() {
    const s = state.settings, perm = 'Notification' in window ? Notification.permission : 'unsupported';
    $('#view').innerHTML = `
      <section class="card"><h2>Hazır kutu paketleri</h2>
        ${Object.entries(D.PACKS).map(([k, pk]) => `<div class="pack"><span class="em">${pk.em}</span><span class="tx"><b>${esc(pk.name)}</b><span class="small muted">${esc(pk.desc)}</span></span><button type="button" class="btn" data-addpack="${k}">Ekle</button></div>`).join('')}</section>
      <section class="card"><h2>Kutuların (${state.boxes.length})</h2>
        ${state.boxes.length ? state.boxes.slice().sort((a, b) => a.name.localeCompare(b.name, 'tr')).map((b) => `<div class="pack"><span class="em">${b.em}</span><span class="tx"><b>${esc(b.name)}</b><span class="small muted">${esc(b.time || PARTS.find((p) => p[0] === b.part)[1])} · ${b.once ? 'tek sefer' : b.days.length === 7 ? 'her gün' : b.days.map((d) => DAYS[d - 1]).join(' ')}</span></span><button type="button" class="btn" data-editbox="${b.id}">Düzenle</button></div>`).join('') : '<p class="muted">Henüz kutu yok.</p>'}</section>
      <section class="card"><h2>Tercihler</h2>
        <label class="switch"><input type="checkbox" data-pref="scene" ${s.scene ? 'checked' : ''}><span>Açılış sahnesi<small>Her açılışta bir özlü söz</small></span></label>
        <label class="switch"><input type="checkbox" data-pref="sound" ${s.sound ? 'checked' : ''}><span>Sesler<small>Kutu dolunca kısa bir ses</small></span></label>
        <label class="switch"><input type="checkbox" data-pref="remind" ${s.remind ? 'checked' : ''}><span>Hatırlatmalar<small>Saati olan kutular için, uygulama açıkken</small></span></label>
        ${perm === 'default' ? '<button type="button" class="btn" data-perm>🔔 Bildirimlere izin ver</button><p class="small muted" style="margin-top:6px">Ritim arka plandayken de haber verebilmem için.</p>' : perm === 'denied' ? '<p class="small muted">Bildirim izni kapalı; telefon ayarlarından açabilirsin.</p>' : perm === 'granted' ? '<p class="small muted">🔔 Bildirim izni açık.</p>' : '<p class="small muted">Bu tarayıcı bildirim göstermiyor. iPhone’da Ritim’i ana ekrana ekleyip oradan açarsan çalışır.</p>'}</section>
      <section class="card"><h2>Yedek</h2><p class="small muted">Verilerin yalnızca bu telefonda duruyor. Arada bir yedek al.</p>
        <div class="btn-col"><button type="button" class="btn" data-export>⬇️ Yedeği indir</button><label class="btn file-btn">⬆️ Yedekten geri yükle<input type="file" accept="application/json,.json" data-import></label>
        <button type="button" class="btn danger" data-reset>Her şeyi sil ve baştan başla</button></div></section>
      <p class="small muted center">Ritim · sürüm 1.1</p>`;
  }

  // ---- Hatırlatmalar (uygulama açıkken) ----
  function checkReminders() {
    if (!state.settings.remind || $('.ob') || $('.scene')) return;
    const t = today(), m = nowMin();
    state.fired = (state.fired || []).filter((k) => k.startsWith(t));
    for (const b of RK.boxesForDay(state, t)) {
      const e = E(b.id, t), at = RK.toMin(e.snooze || b.time);
      if (at === null || e.s || e.end) continue;
      const key = `${t}|${b.id}|${at}`;
      if (m < at || m > at + 10 || state.fired.includes(key)) continue;
      state.fired.push(key); save();
      return nudge(b);
    }
  }
  const NUDGES = ['{x} zamanı geldi. Hazır mısın?', 'Sırada: {x}. Küçük bir başlangıç yeter.', '{x} için an şimdi. Sen başla, gerisi gelir.', 'Hadi bakalım: {x}. Kısa sürümü de sayılır.'];
  function nudge(b) {
    $$('.nudge', layer).forEach((n) => n.remove());
    const text = NUDGES[(b.name.length + new Date().getDate()) % NUDGES.length].replace('{x}', b.name);
    const el = document.createElement('div');
    el.className = 'nudge'; el.style.setProperty('--c', b.c); el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-label', 'Hatırlatma');
    el.innerHTML = `<span class="app">${b.em}</span><div><b>${esc(text)}</b><span class="small muted">${esc(b.time)}</span>
      <div class="acts"><button type="button" class="btn primary" data-n="go">Başladım</button><button type="button" class="btn" data-n="snooze">10 dk sonra</button><button type="button" class="btn" data-n="skip">Bugün olmadı</button></div></div>`;
    layer.appendChild(el);
    beep([880, 1109], 0.7, 0.14); navigator.vibrate?.([120, 80, 120]);
    if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted')
      navigator.serviceWorker?.ready.then((r) => r.showNotification('Ritim', { body: text, icon: 'icons/icon-192.png', tag: b.id })).catch(() => {});
    $$('[data-n]', el).forEach((btn) => (btn.onclick = () => {
      const a = btn.dataset.n;
      const t = today();
      if (a === 'go' && b.kind === 'timer') setE(b.id, { end: Date.now() + (b.mins || 15) * 60000 }, t);
      if (a === 'snooze') { const mm = nowMin() + 10; setE(b.id, { snooze: `${String(Math.floor(mm / 60) % 24).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}` }, t); }
      if (a === 'skip') setE(b.id, { s: 'skip' }, t);
      save(); el.remove(); render(); ensureTicker();
    }));
  }

  // ---- Çizim ve etkileşim ----
  function render(dir = 0) {
    $('#title').textContent = { today: cur === today() ? 'Bugün' : LONG[RK.weekday(cur) - 1], week: 'Hafta', coach: 'Koç', settings: 'Ayarlar' }[tab];
    renderStrip();
    $$('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $('#fab').hidden = tab !== 'today';
    ({ today: () => renderDay(dir), week: renderWeek, coach: renderCoach, settings: renderSettings })[tab]();
  }
  function enter() {
    document.body.classList.add('enter');
    setTimeout(() => document.body.classList.remove('enter'), 1600);
  }

  let pressTimer = null, pressed = null, longFired = false, startXY = null;
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('#view .tile[data-id], #view .growth');
    if (!el) return;
    pressed = el; longFired = false; startXY = [e.clientX, e.clientY]; el.classList.add('pressing');
    pressTimer = setTimeout(() => {
      longFired = true; el.classList.remove('pressing'); navigator.vibrate?.(15);
      if (el.dataset.growth) growthMenu(el.dataset.growth);
      else { const bx = RK.boxesForDay(state, cur).find((b) => b.id === el.dataset.id); if (bx) (editMode ? boxForm : boxMenu)(bx); }
    }, 480);
  });
  const cancelPress = () => { clearTimeout(pressTimer); pressed?.classList.remove('pressing'); };
  document.addEventListener('pointermove', (e) => { if (startXY && Math.hypot(e.clientX - startXY[0], e.clientY - startXY[1]) > 10) cancelPress(); });
  document.addEventListener('pointerup', cancelPress);
  document.addEventListener('pointercancel', cancelPress);
  document.addEventListener('contextmenu', (e) => { if (e.target.closest('.tile, .growth')) e.preventDefault(); });

  $('#view').addEventListener('click', (e) => {
    const q = (sel) => e.target.closest(sel);
    let el;
    if (swiped) return;
    if ((el = q('.tile[data-id]'))) { if (longFired) { longFired = false; return; } const b = RK.boxesForDay(state, cur).find((x) => x.id === el.dataset.id); return b && (editMode ? boxForm(b) : tap(b, el)); }
    if ((el = q('.growth'))) { if (longFired) { longFired = false; return; } return tapGrowth(el.dataset.growth, el); }
    if (q('[data-today]')) return goDay(today(), cur < today() ? 1 : -1);
    if (q('[data-editmode]')) { editMode = !editMode; return render(); }
    if (q('[data-addbox]')) return boxForm(null, { date: cur });
    if ((el = q('[data-open]'))) return goDay(el.dataset.open);
    if ((el = q('[data-wtoggle]'))) { openWeekDay = openWeekDay === el.dataset.wtoggle ? null : el.dataset.wtoggle; return render(); }
    if ((el = q('[data-wbox]'))) { const [d, id] = el.dataset.wbox.split('|'); const b = RK.boxesForDay(state, d).find((x) => x.id === id); return b && boxForm(b, { date: d }); }
    if ((el = q('[data-wadd]'))) return boxForm(null, { date: el.dataset.wadd });
    if ((el = q('[data-energy]'))) {
      const v = el.dataset.energy, t = today(), undo = snapshot();
      state.energy = { date: t, v };
      for (const b of RK.boxesForDay(state, t)) if (b.short && !E(b.id).s) setE(b.id, { short: v === 'low' });
      save(); render();
      return toast(v === 'low' ? '🫶 Hafif gün: kısa sürümler açıldı' : v === 'high' ? '⚡ Dolu enerji, harika!' : '🙂 Not aldım', undo);
    }
    if ((el = q('[data-tabgo]'))) { tab = el.dataset.tabgo; return render(); }
    if ((el = q('[data-week]'))) { weekOffset += +el.dataset.week; return render(); }
    if (q('[data-onboard]')) return onboard();
    if (q('[data-fav]')) { state.favQuotes = state.favQuotes.includes(quoteIdx) ? state.favQuotes.filter((i) => i !== quoteIdx) : [...state.favQuotes, quoteIdx]; save(); return render(); }
    if ((el = q('[data-pathmenu]'))) return pathMenu(el.dataset.pathmenu);
    if (q('[data-newpath]')) return newPath();
    if ((el = q('[data-try]'))) { const undo = snapshot(), def = D.PATHS[el.dataset.try]; RK.addPath(state, RK.buildPath(def, 'dene'), today()); save(); render(); return toast(`${def.em} ${def.name}: bir haftalık deneme başladı`, undo); }
    if ((el = q('[data-resume]'))) { const p = state.paths.find((x) => x.id === el.dataset.resume); p.paused = false; save(); return render(); }
    if ((el = q('[data-check]'))) {
      const p = state.paths.find((x) => x.id === el.dataset.check), v = el.dataset.v;
      p.small = v === 'zor'; p.daily = v === 'kolay'; if (v !== 'zor') p.misses = 0;
      save(); $$(`[data-check="${p.id}"]`).forEach((c) => c.classList.toggle('on', c === el));
      return toast(v === 'zor' ? `${p.em} Adımları küçültüyorum` : v === 'kolay' ? `${p.em} O zaman her gün bir adım` : `${p.em} Aynı hızla devam`);
    }
    if (q('[data-checkdone]')) { state.checkins[RK.weekStart(today())] = true; save(); render(); return toast('🧭 Görüşme tamam. Yeni haftan hazır.'); }
    if ((el = q('[data-addpack]'))) return addPack(el.dataset.addpack);
    if ((el = q('[data-editbox]'))) { const b = state.boxes.find((x) => x.id === el.dataset.editbox); return boxForm(b, { scope: 'all', date: b.once || RK.addDays(RK.weekStart(today()), (b.days[0] || 1) - 1) }); }
    if (q('[data-perm]')) return Notification.requestPermission().then(render);
    if (q('[data-export]')) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'ritim-kutu', version: 1, exportedAt: new Date().toISOString(), state }, null, 1)], { type: 'application/json' }));
      a.download = `ritim-yedek-${today()}.json`; a.click();
      return setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    }
    if (q('[data-reset]')) {
      if (!confirm('Bütün kutular, yollar ve geçmiş silinsin mi? Bu geri alınamaz. Önce yedek almanı öneririm.')) return;
      state = RK.emptyState(); save(); tab = 'today'; render(); return onboard();
    }
  });
  $('#view').addEventListener('change', (e) => {
    const pref = e.target.closest('[data-pref]');
    if (pref) { state.settings[pref.dataset.pref] = pref.checked; save(); if (pref.dataset.pref === 'sound' && pref.checked) beep([659, 988]); return; }
    const imp = e.target.closest('[data-import]');
    if (imp && imp.files[0]) {
      imp.files[0].text().then((txt) => {
        const data = JSON.parse(txt);
        if (data.app !== 'ritim-kutu' || !data.state || !Array.isArray(data.state.boxes)) throw new Error('bad');
        if (!confirm('Bu telefondaki veriler yedektekilerle değiştirilecek. Devam edilsin mi?')) return;
        state = Object.assign(RK.emptyState(), data.state); save(); render(); toast('Yedek geri yüklendi');
      }).catch(() => toast('Bu dosya bir Ritim yedeği gibi görünmüyor. Hiçbir şey değişmedi.'));
      imp.value = '';
    }
  });
  $$('.tabbar button').forEach((b) => (b.onclick = () => { if (b.dataset.tab === 'today' && tab === 'today') cur = today(); tab = b.dataset.tab; weekOffset = 0; editMode = false; window.scrollTo(0, 0); render(); }));
  $('#fab').onclick = () => boxForm(null, cur === today() ? {} : { date: cur });
  $('#strip').addEventListener('click', (e) => {
    const d = e.target.closest('[data-day]'), sh = e.target.closest('[data-shift]');
    if (d) return goDay(d.dataset.day, Math.sign(RK.parse(d.dataset.day) - RK.parse(cur)));
    if (sh) return goDay(RK.addDays(cur, +sh.dataset.shift), +sh.dataset.shift > 0 ? 1 : -1);
  });
  // Sağa sola kaydırma: sıradaki / önceki gün
  let sw = null, swiped = false;
  const vw = $('#view');
  vw.addEventListener('touchstart', (e) => { sw = tab === 'today' && e.touches.length === 1 && !$('.sheet', layer) ? [e.touches[0].clientX, e.touches[0].clientY] : null; }, { passive: true });
  vw.addEventListener('touchmove', (e) => {
    if (!sw) return;
    const dx = e.touches[0].clientX - sw[0], dy = e.touches[0].clientY - sw[1];
    if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.5) { const p = $('.pane'); if (p) p.style.transform = `translateX(${dx * 0.6}px)`; }
  }, { passive: true });
  vw.addEventListener('touchend', (e) => {
    if (!sw) return;
    const dx = e.changedTouches[0].clientX - sw[0], dy = e.changedTouches[0].clientY - sw[1]; sw = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped = true; cancelPress(); longFired = false; setTimeout(() => (swiped = false), 350); return goDay(RK.addDays(cur, dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); }
    const p = $('.pane'); if (p) p.style.transform = '';
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheet();
    if (tab === 'today' && !$('.sheet', layer) && !$('.ob') && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) goDay(RK.addDays(cur, e.key === 'ArrowRight' ? 1 : -1), e.key === 'ArrowRight' ? 1 : -1);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { render(); checkReminders(); ensureTicker(); navigator.serviceWorker?.getRegistration().then((r) => r && r.update()).catch(() => {}); } });

  // ---- Başlangıç ----
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.storage?.persist?.().catch(() => {});
  render();
  scene(() => { if (!state.profile) onboard(); else enter(); });
  ensureTicker();
  setInterval(checkReminders, 20000);
  setInterval(() => { if (tab === 'today' && !ticker && !$('.sheet', layer) && !$('.ob') && document.visibilityState === 'visible') { renderStrip(); renderDay(); } }, 60000);
  window.__ritim = { get state() { return state; } };
})();
