import { describe, expect, it } from 'vitest';
import { replan, type PlanEntry } from '../src/domain/replan';
import type { Flexibility, Routine } from '../src/domain/types';
import { routine } from './helpers';

const D = '2026-03-03';
const F = (p: Partial<Flexibility>): Flexibility => ({ timing: 'flexible', priority: 'medium', shortenable: false, movable: false, protected: false, ...p });
const R = (id: string, start: string, dur: number, flex: Flexibility, extra: Partial<Routine> = {}) =>
  routine({ id, title: id, startTime: start, durationMin: dur, flex, ...extra });

const routines = [
  R('work', '09:00', 480, F({ timing: 'fixed', priority: 'high' })),
  R('walk', '17:00', 60, F({ priority: 'low' })),
  R('guitar', '18:00', 60, F({ shortenable: true, movable: true }), {
    shortVersions: [{ id: 's1', title: '20 dk tekrar', durationMin: 20 }, { id: 's2', title: '5 dk', durationMin: 5 }],
  }),
  R('dinner', '19:00', 60, F({ protected: true, timing: 'fixed', priority: 'high' })),
  R('piano', '20:00', 60, F({ priority: 'high' })),
  R('reading', '21:00', 60, F({ priority: 'low' })),
  R('sleep', '23:00', 480, F({ protected: true, timing: 'fixed', priority: 'high' })),
];
const src = { routines, records: [], events: [], tasks: [] };
const by = (plan: PlanEntry[]) => Object.fromEntries(plan.map((e) => [e.item.routineId ?? e.item.key, e]));
const span = (e: PlanEntry) => ('start' in e.decision ? [e.decision.start, e.decision.start + e.decision.duration] : null);

function assertNoOverlap(plan: PlanEntry[]) {
  const spans = plan.map(span).filter(Boolean) as number[][];
  spans.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < spans.length; i++) expect(spans[i][0]).toBeGreaterThanOrEqual(spans[i - 1][1]);
}

describe('Günüm değişti', () => {
  it('iş uzadı, 18:30 sonrası müsait: korunanlar yerinde, düşük öncelikli atlanır, kalanlar kaydırılır, çakışma yok', () => {
    const plan = replan({ src, date: D, nowMin: 17 * 60 + 30, availableFrom: 18 * 60 + 30, reason: 'work' });
    const p = by(plan);
    expect(p.dinner.decision).toMatchObject({ action: 'keep', start: 19 * 60 });
    expect(p.sleep.decision).toMatchObject({ action: 'keep', start: 23 * 60 });
    expect(p.reading.decision.action).toBe('skip');
    for (const k of ['walk', 'guitar', 'piano']) {
      const s = span(p[k])!;
      expect(s[0]).toBeGreaterThanOrEqual(18 * 60 + 30);
      expect(s[1]).toBeLessThanOrEqual(23 * 60);
    }
    assertNoOverlap(plan);
    expect(p.work).toBeUndefined(); // geçmişte biten sabit blok plana girmez
  });

  it('yorgunum: daha hafif plan (düşük öncelik atlanır, kısa sürümler)', () => {
    const p = by(replan({ src, date: D, nowMin: 17 * 60 + 30, reason: 'tired' }));
    expect(p.walk.decision.action).toBe('skip');
    expect(p.reading.decision.action).toBe('skip');
    expect(p.guitar.decision).toMatchObject({ action: 'shorten', duration: 20, start: 18 * 60 });
    expect(p.piano.decision).toMatchObject({ action: 'keep', start: 20 * 60 });
  });

  it('çok az zaman: önce kısa sürüm, sonra başka güne, en son atla; korunan zaman asla sıkıştırılmaz', () => {
    const plan = replan({ src, date: D, nowMin: 17 * 60 + 30, availableFrom: 22 * 60 + 30, reason: 'urgent' });
    const p = by(plan);
    expect(p.guitar.decision.action).toBe('postpone');
    expect(p.piano.decision.action).toBe('skip');
    expect(p.sleep.decision).toMatchObject({ action: 'keep', start: 23 * 60, duration: 480 });
    assertNoOverlap(plan);
  });

  it('kullanıcı kararı (kilit) korunur, geri kalanı yeniden planlanır', () => {
    const base = { src, date: D, nowMin: 17 * 60 + 30, availableFrom: 18 * 60 + 30, reason: 'work' as const };
    const key = (id: string) => `r:${id}@${D}`;
    const p = by(replan({ ...base, locks: { [key('piano')]: 'skip', [key('reading')]: 'place' } }));
    expect(p.piano.decision.action).toBe('skip');
    expect(p.reading.decision.action).not.toBe('skip');
    expect(p.piano.locked).toBe('skip');
  });

  it('her şey sığıyorsa hiçbir şey değişmez', () => {
    const plan = replan({ src, date: D, nowMin: 16 * 60, reason: 'other' });
    for (const e of plan) expect(e.decision.action).toBe('keep');
  });

  it('randevular çapadır: esnek blok onların etrafına yerleşir', () => {
    const ev = { id: 'doc', profileId: 'p1', title: 'Doktor', startDate: D, startTime: '20:00', endDate: D, endTime: '21:00', status: 'planned' as const };
    const plan = replan({ src: { ...src, events: [ev] }, date: D, nowMin: 19 * 60 + 30, reason: 'other' });
    const p = by(plan);
    expect(plan.find((e) => e.item.eventId === 'doc')!.decision).toMatchObject({ action: 'keep', start: 20 * 60 });
    expect(p.piano.decision.action).not.toBe('keep');
    assertNoOverlap(plan);
  });
});

describe('başka güne erteleme', () => {
  it('aynı güne ertelenen iki blok birbiriyle çakışmaz', () => {
    const mk = (id: string, start: string) => R(id, start, 30, F({ movable: true, priority: 'high' }));
    const a = mk('a', '20:00');
    const b2 = mk('b', '20:30');
    const wall = R('wall', '06:00', 14 * 60, F({ protected: true, timing: 'fixed' }), { recurrence: { freq: 'daily', interval: 1, startDate: D, endDate: D } });
    const plan = replan({ src: { routines: [a, b2, wall], records: [], events: [], tasks: [] }, date: D, nowMin: 19 * 60 + 50, availableFrom: 23 * 60 + 50, reason: 'work' });
    const ds = plan.filter((e) => e.decision.action === 'postpone').map((e) => e.decision as { date: string; startTime: string });
    expect(ds).toHaveLength(2);
    expect(`${ds[0].date} ${ds[0].startTime}`).not.toBe(`${ds[1].date} ${ds[1].startTime}`);
  });
});
