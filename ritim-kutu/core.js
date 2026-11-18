// Ritim: arayüzden bağımsız mantık (tarih, günün kutuları, koçun yolları).
// Hem tarayıcıda hem Node testlerinde çalışır.
(function (root) {
  const pad = (n) => String(n).padStart(2, '0');
  const dstr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), 12);
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return dstr(d); };
  const weekday = (s) => ((parse(s).getDay() + 6) % 7) + 1; // 1 = Pazartesi
  const weekStart = (s) => addDays(s, 1 - weekday(s));
  const toMin = (t) => (/^\d\d:\d\d$/.test(t || '') ? +t.slice(0, 2) * 60 + +t.slice(3) : null);
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  function emptyState() {
    return { v: 1, profile: null, boxes: [], log: {}, paths: [], star: null, energy: null, favQuotes: [], lastQuote: -1, lastRoll: null, checkins: {}, settings: { scene: true, sound: true, remind: true } };
  }

  /** O gün görünecek rutin kutular (saat sırasıyla). */
  function boxesForDay(state, date) {
    const wd = weekday(date);
    const order = { sabah: 0, gun: 1, aksam: 2 };
    return state.boxes
      .filter((b) => (b.once ? b.once === date : b.days.includes(wd)) && !(b.from && date < b.from))
      .sort((a, b) => order[a.part] - order[b.part] || (toMin(a.time) ?? 9999) - (toMin(b.time) ?? 9999));
  }

  const entry = (state, date, id) => (state.log[date] && state.log[date][id]) || null;
  function setEntry(state, date, id, e) {
    state.log[date] = state.log[date] || {};
    if (e) state.log[date][id] = e; else delete state.log[date][id];
  }
  const isDone = (e) => !!e && e.s === 'done';

  // ---- Koçun yolları ----
  /** Veri tanımından kişiye özel yol kurar. ratings: {konu: 'yok'|'az'|'var'} */
  function buildPath(def, mode, ratings) {
    let steps;
    if (def.topics && mode === 'derin') {
      const rank = { yok: 0, az: 1 };
      const keys = Object.keys(def.topics).filter((k) => (ratings ? ratings[k] : 'yok') !== 'var')
        .sort((a, b) => (rank[(ratings || {})[a] || 'yok'] - rank[(ratings || {})[b] || 'yok']));
      // Konuları sırayla karıştır: her konudan birer adım (tek konuda boğulmasın)
      steps = [];
      const max = Math.max(0, ...keys.map((k) => def.topics[k].steps.length));
      for (let i = 0; i < max; i++) for (const k of keys) if (def.topics[k].steps[i]) steps.push({ ...def.topics[k].steps[i], topic: def.topics[k].name });
    } else {
      steps = (def[mode] || def.basla || def.derin || []).map((s) => ({ ...s }));
    }
    if (mode === 'dene') steps = (def.basla || []).slice(0, 5).map((s) => ({ ...s }));
    return { id: uid(), key: def.key, title: def.name, em: def.em, c: def.c, mode, steps, idx: 0, misses: 0, small: false, daily: false, doneLog: {}, startedAt: null };
  }

  /** Özel (listede olmayan) ilgi alanı için genel yol. */
  function genericPath(name, mode, tpl) {
    const steps = tpl[mode === 'derin' ? 'derin' : 'basla'].map((s) => ({ t: s.t.replace(/\{x\}/g, name), s: s.s.replace(/\{x\}/g, name) }));
    return { id: uid(), key: 'ozel', title: name, em: '✨', c: '#7c3aed', mode, steps, idx: 0, misses: 0, small: false, daily: false, doneLog: {}, startedAt: null };
  }

  const activePaths = (state) => state.paths.filter((p) => p.idx < p.steps.length && !p.paused);
  const perDay = (state) => (state.profile && state.profile.minutes <= 15 ? 1 : 2);

  /**
   * Gün dönümü: dün seçilip yapılmayan gelişim adımlarını sayar (3 kez üst üste
   * atlanırsa adım küçültülür, suçlama yok) ve bugünün gelişim kutularını seçer.
   */
  function rollDay(state, today) {
    if (state.lastRoll && state.lastRoll < today) {
      const prev = state.log[state.lastRoll];
      for (const pid of (prev && prev.g) || []) {
        const p = state.paths.find((x) => x.id === pid);
        if (!p || p.doneLog[state.lastRoll] !== undefined) continue;
        p.misses++;
        if (p.misses >= 3) p.small = true;
      }
    }
    state.lastRoll = today;
    state.log[today] = state.log[today] || {};
    if (!state.log[today].g) {
      const last = (p) => Object.keys(p.doneLog).sort().pop() || ''; // hiç yapılmamış yol öne geçer
      const pool = activePaths(state).sort((a, b) => (b.daily ? 1 : 0) - (a.daily ? 1 : 0) || last(a).localeCompare(last(b)));
      state.log[today].g = pool.slice(0, perDay(state)).map((p) => p.id);
    }
    return state;
  }

  /** Bugünün gelişim kutuları: { path, step, text, done } */
  function growthForDay(state, date) {
    const ids = (state.log[date] && state.log[date].g) || [];
    return ids.map((id) => {
      const p = state.paths.find((x) => x.id === id);
      if (!p) return null;
      const doneIdx = p.doneLog[date];
      const idx = doneIdx !== undefined ? doneIdx : p.idx;
      const step = p.steps[idx];
      if (!step) return null;
      return { path: p, idx, step, text: p.small && doneIdx === undefined ? step.s : step.t, small: p.small && doneIdx === undefined, done: doneIdx !== undefined };
    }).filter(Boolean);
  }

  function completeGrowth(state, date, pathId) {
    const p = state.paths.find((x) => x.id === pathId);
    if (!p || p.doneLog[date] !== undefined || p.idx >= p.steps.length) return false;
    p.doneLog[date] = p.idx;
    p.idx++;
    p.misses = 0;
    p.small = false;
    p.startedAt = p.startedAt || date;
    return true;
  }

  function addPath(state, path, today) {
    path.startedAt = today;
    state.paths.push(path);
    // Bugünün seçiminde yer varsa hemen ekle
    const day = (state.log[today] = state.log[today] || {});
    day.g = day.g || [];
    if (day.g.length < perDay(state)) day.g.push(path.id);
  }

  // ---- Özetler ----
  function daySummary(state, date) {
    const boxes = boxesForDay(state, date);
    const g = growthForDay(state, date);
    let total = 0, done = 0;
    for (const b of boxes) {
      const e = entry(state, date, b.id);
      if (e && e.s === 'skip') continue;
      total++;
      if (isDone(e)) done++;
    }
    total += g.length;
    done += g.filter((x) => x.done).length;
    return { total, done, ratio: total ? done / total : 0, complete: total > 0 && done === total };
  }

  const anyDone = (state, date) => {
    const day = state.log[date] || {};
    return Object.keys(day).some((k) => k !== 'g' && isDone(day[k])) || state.paths.some((p) => p.doneLog[date] !== undefined);
  };

  /** Art arda en az bir şey yapılan gün sayısı; bugün henüz boşsa dünden sayılır. */
  function streak(state, today) {
    let d = anyDone(state, today) ? today : addDays(today, -1), n = 0;
    while (anyDone(state, d)) { n++; d = addDays(d, -1); }
    let gap = 0;
    if (anyDone(state, today)) for (let x = addDays(today, -1); gap < 60 && !anyDone(state, x); x = addDays(x, -1)) gap++;
    const ever = Object.keys(state.log).some((k) => k < today && anyDone(state, k));
    return { days: n, comeback: anyDone(state, today) && gap >= 2 && ever };
  }

  /** Bir kutunun art arda yapıldığı (planlı) gün sayısı. */
  function boxStreak(state, box, today) {
    let n = 0;
    for (let d = today, guard = 0; guard < 400; d = addDays(d, -1), guard++) {
      if (!boxesForDay(state, d).some((b) => b.id === box.id)) { if (box.once) break; continue; }
      if (isDone(entry(state, d, box.id))) n++;
      else if (d !== today) break;
    }
    return n;
  }

  /** Karakter kartına göre yeni hobi önerileri (veri: {key: [öneri anahtarları]}). */
  function suggestions(profile, rules, defs) {
    const have = new Set([...(profile.interests || []).map((i) => i.key), ...(profile.dreams || [])]);
    const score = {};
    for (const i of profile.interests || []) for (const s of rules[i.key] || []) if (!have.has(s)) score[s] = (score[s] || 0) + 2;
    for (const d of profile.dreams || []) for (const s of rules[d] || []) if (!have.has(s)) score[s] = (score[s] || 0) + 1;
    return Object.keys(score).filter((k) => defs[k]).sort((a, b) => score[b] - score[a] || a.localeCompare(b)).slice(0, 3);
  }

  /** Her açılışta bir öncekinden farklı söz. */
  function nextQuote(state, count, rnd) {
    if (count <= 1) return 0;
    let i;
    do { i = Math.floor((rnd || Math.random)() * count); } while (i === state.lastQuote);
    state.lastQuote = i;
    return i;
  }

  const api = { dstr, parse, addDays, weekday, weekStart, toMin, uid, emptyState, boxesForDay, entry, setEntry, isDone, buildPath, genericPath, activePaths, perDay, rollDay, growthForDay, completeGrowth, addPath, daySummary, anyDone, streak, boxStreak, suggestions, nextQuote };
  root.RK = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
