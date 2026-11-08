import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { RitimDB } from '../src/db/db';
import { Repo } from '../src/db/repo';
import { splitRule, shiftWeekday } from '../src/domain/moves';
import { buildDay } from '../src/domain/agenda';
import { expandRange } from '../src/domain/recurrence';
import { fireTimes } from '../src/domain/reminders';
import type { EventItem, Profile } from '../src/domain/types';
import { routine } from './helpers';

const profile: Profile = {
  id: 'p1', name: 'D', createdAt: '2026-01-01T00:00:00Z',
  settings: { language: 'tr', region: 'TR', timeZone: 'Europe/Istanbul', weekStart: 1, hourCycle: 'h23' },
};
let db: RitimDB;
let repo: Repo;
let n = 0;
beforeEach(async () => {
  db = new RitimDB(`moves-${++n}`);
  repo = new Repo(db);
  await repo.createProfile(profile);
});
const titlesOn = async (date: string) => {
  const d = await repo.loadProfileData('p1');
  return buildDay(d, date).filter((i) => !i.continues).map((i) => `${i.startTime} ${i.title}`);
};
const item = async (date: string, routineId = 'r1') => {
  const d = await repo.loadProfileData('p1');
  return buildDay(d, date).find((i) => i.routineId === routineId)!;
};

describe('kural bölme', () => {
  it('hafta günü kaydırma', () => {
    expect(shiftWeekday(1, 1)).toBe(2);
    expect(shiftWeekday(7, 1)).toBe(1);
    expect(shiftWeekday(1, -1)).toBe(7);
  });
  it('seri ikiye bölünür; ilk günden bölünürse eski kısım kalmaz', () => {
    const r = { freq: 'weekly' as const, interval: 1, byWeekday: [1, 3] as (1 | 3)[], startDate: '2026-03-02' };
    expect(splitRule(r, '2026-03-16', 1)).toEqual({
      old: { ...r, endDate: '2026-03-15' },
      next: { ...r, startDate: '2026-03-17', byWeekday: [2, 4] },
    });
    expect(splitRule(r, '2026-03-02').old).toBeNull();
  });
});

describe('taşıma (sürükle-bırak)', () => {
  // r1: her Pazartesi 20:00–21:00 (2026-03-02 Pazartesi)
  beforeEach(async () => {
    await repo.putRoutine(routine({ id: 'r1', title: 'Gitar', recurrence: { freq: 'weekly', byWeekday: [1] } }));
  });

  it('yalnızca o tarih: diğer haftalar aynen kalır, süre korunur', async () => {
    await repo.moveItem('p1', await item('2026-03-09'), { date: '2026-03-10', startTime: '18:00', durationMin: 60 }, 'one');
    expect(await titlesOn('2026-03-09')).toEqual([]);
    expect(await titlesOn('2026-03-10')).toEqual(['18:00 Gitar']);
    expect(await titlesOn('2026-03-16')).toEqual(['20:00 Gitar']);
    expect(await titlesOn('2026-03-02')).toEqual(['20:00 Gitar']);
  });

  it('süre değiştirme yalnızca o tarihe', async () => {
    await repo.moveItem('p1', await item('2026-03-09'), { date: '2026-03-09', startTime: '20:00', durationMin: 90 }, 'one');
    const d = await repo.loadProfileData('p1');
    expect(expandRange(d.routines, d.records, '2026-03-09', '2026-03-16').map((o) => o.durationMin)).toEqual([90, 60]);
  });

  it('sonraki tüm tekrarlar: geçmiş aynı kalır, sonrası yeni gün ve saatte', async () => {
    await repo.moveItem('p1', await item('2026-03-09'), { date: '2026-03-10', startTime: '18:00', durationMin: 45 }, 'future');
    expect(await titlesOn('2026-03-02')).toEqual(['20:00 Gitar']); // geçmiş
    expect(await titlesOn('2026-03-09')).toEqual([]);
    expect(await titlesOn('2026-03-10')).toEqual(['18:00 Gitar']);
    expect(await titlesOn('2026-03-16')).toEqual([]);
    expect(await titlesOn('2026-03-17')).toEqual(['18:00 Gitar']);
    expect((await item('2026-03-17', (await repo.loadProfileData('p1')).routines.find((r) => r.id !== 'r1')!.id)).endMin).toBe(18 * 60 + 45);
  });

  it('sonraki tüm tekrarlar: ileri tarihli istisna ve hatırlatmalar yeni seriye geçer', async () => {
    await repo.patchOccurrence('p1', 'r1', '2026-03-23', { status: 'skipped' });
    await repo.patchOccurrence('p1', 'r1', '2026-03-02', { status: 'done' });
    await repo.addReminder('p1', { kind: 'routine', routineId: 'r1' }, 10);
    await repo.moveItem('p1', await item('2026-03-09'), { date: '2026-03-09', startTime: '19:00', durationMin: 60 }, 'future');
    const d = await repo.loadProfileData('p1');
    const newId = d.routines.find((r) => r.id !== 'r1')!.id;
    expect(d.records.find((r) => r.originalDate === '2026-03-23')!.routineId).toBe(newId);
    expect(d.records.find((r) => r.originalDate === '2026-03-02')!.routineId).toBe('r1');
    const times = fireTimes(d.reminders, d, '2026-03-02', '2026-03-16', 'Europe/Istanbul').map((f) => `${f.date} ${f.time}`);
    expect(times).toEqual(['2026-03-02 20:00', '2026-03-09 19:00', '2026-03-16 19:00']);
  });

  it('tek "Geri al" bölmeyi tamamen geri alır', async () => {
    await repo.moveItem('p1', await item('2026-03-09'), { date: '2026-03-10', startTime: '18:00', durationMin: 60 }, 'future');
    await repo.undoLast('p1');
    const d = await repo.loadProfileData('p1');
    expect(d.routines).toHaveLength(1);
    expect(d.routines[0].recurrence.endDate).toBeUndefined();
    expect(await titlesOn('2026-03-16')).toEqual(['20:00 Gitar']);
  });

  it('seri ilk gününden itibaren taşınırsa eski seri kalmaz', async () => {
    await repo.moveItem('p1', await item('2026-03-02'), { date: '2026-03-02', startTime: '07:00', durationMin: 60 }, 'future');
    const d = await repo.loadProfileData('p1');
    expect(d.routines).toHaveLength(1);
    expect(d.routines[0].startTime).toBe('07:00');
  });

  it('randevu taşınınca süresi korunur, gece yarısını aşabilir', async () => {
    const e: EventItem = { id: 'e', profileId: 'p1', title: 'Vardiya', startDate: '2026-03-03', startTime: '14:00', endDate: '2026-03-03', endTime: '22:00', status: 'planned' };
    await repo.putEvent(e);
    const d = await repo.loadProfileData('p1');
    const ev = buildDay(d, '2026-03-03').find((i) => i.eventId === 'e')!;
    await repo.moveItem('p1', ev, { date: '2026-03-04', startTime: '22:00', durationMin: 480 }, 'one');
    expect(await db.events.get('e')).toMatchObject({ startDate: '2026-03-04', startTime: '22:00', endDate: '2026-03-05', endTime: '06:00' });
  });
});

describe('rutin düzenleme', () => {
  it('saat değişince geçmiş korunur, bugünden itibaren yeni saat', async () => {
    const r = routine({ id: 'r1', title: 'Gitar' });
    await repo.putRoutine(r);
    await repo.updateRoutine(r, { ...r, startTime: '07:00', title: 'Gitar pratiği' }, '2026-03-05');
    expect(await titlesOn('2026-03-04')).toEqual(['20:00 Gitar']);
    expect(await titlesOn('2026-03-05')).toEqual(['07:00 Gitar pratiği']);
  });
  it('yalnızca ad değişince tüm seri güncellenir (bölünmez)', async () => {
    const r = routine({ id: 'r1', title: 'Gitar' });
    await repo.putRoutine(r);
    await repo.updateRoutine(r, { ...r, title: 'Gitar 2' }, '2026-03-05');
    expect((await repo.loadProfileData('p1')).routines).toHaveLength(1);
    expect(await titlesOn('2026-03-02')).toEqual(['20:00 Gitar 2']);
  });
  it('bundan sonraki tekrarları sil: geçmiş kalır', async () => {
    const r = routine({ id: 'r1', title: 'Gitar' });
    await repo.putRoutine(r);
    await repo.endRoutineFrom(r, '2026-03-05');
    expect(await titlesOn('2026-03-04')).toEqual(['20:00 Gitar']);
    expect(await titlesOn('2026-03-05')).toEqual([]);
  });
});

import { replan } from '../src/domain/replan';
describe('Günüm değişti uygulanması', () => {
  it('plan tek işlemde uygulanır, şablon bozulmaz, tek "Geri al" ile döner', async () => {
    await repo.putRoutine(routine({ id: 'g', title: 'Gitar', startTime: '18:00', durationMin: 60, flex: { timing: 'flexible', priority: 'medium', shortenable: true, movable: true, protected: false }, shortVersions: [{ id: 's', title: '15 dk', durationMin: 15 }] }));
    await repo.putRoutine(routine({ id: 'w', title: 'Yürüyüş', startTime: '19:00', durationMin: 60, flex: { timing: 'flexible', priority: 'low', shortenable: false, movable: false, protected: false } }));
    const D = '2026-03-03';
    const d0 = await repo.loadProfileData('p1');
    const plan = replan({ src: d0, date: D, nowMin: 17 * 60, reason: 'tired' });
    await repo.applyReplan('p1', plan);
    const d = await repo.loadProfileData('p1');
    const day = buildDay(d, D);
    expect(day.find((i) => i.routineId === 'g')).toMatchObject({ endMin: 18 * 60 + 15, plannedShort: { title: '15 dk' } });
    expect(day.find((i) => i.routineId === 'w')!.status).toBe('skipped');
    expect(d.records.every((r) => r.consciousChange)).toBe(true);
    expect(d.routines.find((r) => r.id === 'g')!.durationMin).toBe(60);
    expect(buildDay(d, '2026-03-04').find((i) => i.routineId === 'g')!.endMin).toBe(19 * 60);
    await repo.undoLast('p1');
    expect((await repo.loadProfileData('p1')).records).toHaveLength(0);
  });
});
