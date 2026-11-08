import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { RitimDB } from '../src/db/db';
import { Repo } from '../src/db/repo';
import { exportBackup, restoreBackup, validateBackup } from '../src/db/backup';
import { fireTimes } from '../src/domain/reminders';
import type { EventItem, Profile } from '../src/domain/types';
import { buildSampleProfile } from '../src/sample/ahmetProfile';
import { expandRange, occurrencesForDay } from '../src/domain/recurrence';
import { routine } from './helpers';

const SETTINGS = { language: 'tr', region: 'TR', timeZone: 'Europe/Istanbul', weekStart: 1, hourCycle: 'h23' } as const;
const profile = (id = 'p1'): Profile => ({ id, name: 'Deneme', createdAt: '2026-01-01T00:00:00Z', settings: { ...SETTINGS } });

let db: RitimDB;
let repo: Repo;
let n = 0;
beforeEach(async () => {
  db = new RitimDB(`test-${++n}`);
  repo = new Repo(db);
  await repo.createProfile(profile());
});

describe('işlem geçmişi ve geri al', () => {
  it('ekleme geri alınınca kayıt kaybolur', async () => {
    await repo.putRoutine(routine());
    expect(await db.routines.count()).toBe(1);
    await repo.undoLast('p1');
    expect(await db.routines.count()).toBe(0);
  });

  it('değişiklik geri alınınca eski hâline döner', async () => {
    await repo.putRoutine(routine({ title: 'Gitar' }));
    await repo.putRoutine(routine({ title: 'Piyano' }));
    await repo.undoLast('p1');
    expect((await db.routines.get('r1'))!.title).toBe('Gitar');
  });

  it('silme geri alınınca rutin, istisnaları ve hatırlatmaları geri gelir', async () => {
    const r = routine();
    await repo.putRoutine(r);
    await repo.patchOccurrence('p1', 'r1', '2026-03-03', { status: 'skipped' });
    await repo.addReminder('p1', { kind: 'routine', routineId: 'r1' }, 15);
    await repo.deleteRoutine(r);
    expect(await db.routines.count()).toBe(0);
    expect(await db.reminders.count()).toBe(0);
    expect(await db.occurrences.count()).toBe(0);
    await repo.undoLast('p1');
    expect(await db.routines.count()).toBe(1);
    expect(await db.reminders.count()).toBe(1);
    expect(await db.occurrences.count()).toBe(1);
  });

  it('art arda geri alma sırayla çalışır', async () => {
    await repo.putRoutine(routine({ title: 'A' }));
    await repo.putRoutine(routine({ title: 'B' }));
    await repo.putRoutine(routine({ title: 'C' }));
    await repo.undoLast('p1');
    await repo.undoLast('p1');
    expect((await db.routines.get('r1'))!.title).toBe('A');
  });
});

describe('hatırlatmalar', () => {
  it('aynı hatırlatma iki kez eklenmez', async () => {
    await repo.putRoutine(routine());
    await repo.addReminder('p1', { kind: 'routine', routineId: 'r1' }, 15);
    await repo.addReminder('p1', { kind: 'routine', routineId: 'r1' }, 15);
    expect(await db.reminders.count()).toBe(1);
  });

  it('kaynak taşınınca hatırlatma yeni saate göre hesaplanır', async () => {
    await repo.putRoutine(routine());
    await repo.addReminder('p1', { kind: 'routine', routineId: 'r1' }, 15);
    await repo.patchOccurrence('p1', 'r1', '2026-03-03', { startTime: '18:00' });
    const d = await repo.loadProfileData('p1');
    const times = fireTimes(d.reminders, { ...d }, '2026-03-03', '2026-03-03', 'Europe/Istanbul');
    expect(times).toHaveLength(1);
    expect(times[0].at.toString()).toBe('2026-03-03T14:45:00Z'); // 17:45 İstanbul
  });

  it('atlanan oluşum için hatırlatma çalmaz', async () => {
    await repo.putRoutine(routine());
    await repo.addReminder('p1', { kind: 'routine', routineId: 'r1' }, 0);
    await repo.patchOccurrence('p1', 'r1', '2026-03-03', { status: 'skipped' });
    const d = await repo.loadProfileData('p1');
    expect(fireTimes(d.reminders, d, '2026-03-02', '2026-03-04', 'Europe/Istanbul')).toHaveLength(2);
  });

  it('etkinlik silinince bağlı hatırlatma da silinir', async () => {
    const e: EventItem = {
      id: 'e1', profileId: 'p1', title: 'Doktor', startDate: '2026-03-05', startTime: '10:00',
      endDate: '2026-03-05', endTime: '10:30', status: 'planned',
    };
    await repo.putEvent(e);
    await repo.addReminder('p1', { kind: 'event', eventId: 'e1' }, 30);
    await repo.addReminder('p1', { kind: 'event', eventId: 'e1' }, 0);
    await repo.deleteEvent(e);
    expect(await db.reminders.count()).toBe(0);
  });

  it('saati olmayan tarihli görevde "1 gün önce" 09:00 esas alınır', async () => {
    await repo.putTask({ id: 't1', profileId: 'p1', title: 'Fatura', date: '2026-03-10', status: 'planned' });
    await repo.addReminder('p1', { kind: 'task', taskId: 't1' }, 1440);
    const d = await repo.loadProfileData('p1');
    const [f] = fireTimes(d.reminders, d, '2026-03-01', '2026-03-31', 'Europe/Istanbul');
    expect(f.at.toString()).toBe('2026-03-09T06:00:00Z');
  });
});

describe('profiller', () => {
  it('profiller birbirinin verisini görmez', async () => {
    await repo.createProfile(profile('p2'));
    await repo.putRoutine(routine());
    await repo.putRoutine(routine({ id: 'r2', profileId: 'p2' }));
    expect((await repo.loadProfileData('p1')).routines.map((r) => r.id)).toEqual(['r1']);
    expect((await repo.loadProfileData('p2')).routines.map((r) => r.id)).toEqual(['r2']);
  });

  it('profil silinince tüm verisi gider, geri alınınca döner', async () => {
    await repo.putRoutine(routine());
    await repo.addReminder('p1', { kind: 'routine', routineId: 'r1' }, 5);
    await repo.deleteProfile('p1');
    expect(await db.profiles.count()).toBe(0);
    expect(await db.routines.count()).toBe(0);
    await repo.undoLast(null);
    expect(await db.profiles.count()).toBe(1);
    expect(await db.routines.count()).toBe(1);
  });
});

describe('yedekleme', () => {
  it('yedek alıp geri yükleyince veri aynen döner', async () => {
    await repo.putRoutine(routine());
    await repo.patchOccurrence('p1', 'r1', '2026-03-03', { status: 'done_short', actualMin: 15 });
    await repo.addReminder('p1', { kind: 'routine', routineId: 'r1' }, 10);
    const backup = JSON.parse(JSON.stringify(await exportBackup(db)));

    const other = new RitimDB(`restore-${n}`);
    await new Repo(other).createProfile(profile('baska'));
    await restoreBackup(other, backup);
    const again = await exportBackup(other);
    expect(again.data).toEqual(backup.data);
    expect(await other.profiles.get('baska')).toBeUndefined();
  });

  it('bozuk veya yabancı dosya reddedilir, mevcut veri bozulmaz', async () => {
    await repo.putRoutine(routine());
    await expect(restoreBackup(db, { foo: 1 })).rejects.toThrow('invalid');
    await expect(restoreBackup(db, { app: 'ritim', version: 1, data: { routines: [{ x: 1 }] } })).rejects.toThrow();
    await expect(restoreBackup(db, { app: 'ritim', version: 99, data: {} })).rejects.toThrow('newerVersion');
    expect(await db.routines.count()).toBe(1);
  });

  it('eksik tablolar boş sayılır', () => {
    expect(() => validateBackup({ app: 'ritim', version: 1, exportedAt: '', data: { profiles: [] } })).not.toThrow();
  });
});

describe('örnek profil', () => {
  it('Ahmet profili yüklenir ve günleri tarife uyar', async () => {
    const s = buildSampleProfile('ahmet', { ...SETTINGS }, '2026-11-01');
    await repo.createProfile(s.profile, s.categories);
    await repo.bulkInsert('ahmet', 'history.loadSample', [
      { table: 'projects', rows: s.projects },
      { table: 'routines', rows: s.routines },
    ]);
    const d = await repo.loadProfileData('ahmet');
        const t = (date: string) => expandRange(d.routines, [], date, date).map((o) => d.routines.find((r) => r.id === o.routineId)!.title);

    // Pazartesi 2026-11-09
    expect(t('2026-11-09')).toContain('Hareket: güç');
    expect(t('2026-11-09')).toContain('Akşam odağı: Piyano ve teori');
    expect(t('2026-11-09')).toContain('Mesai');
    // Salı
    expect(t('2026-11-10')).toContain('Akşam odağı: Gitar repertuarı');
    // Cumartesi: mesai yok, aile var
    expect(t('2026-11-14')).not.toContain('Mesai');
    expect(t('2026-11-14')).toContain('Aile');
    expect(t('2026-11-14')).toContain('15 dk piyano');
    // Pazar: hareket yerine dinlenme, karne
    expect(t('2026-11-15')).toContain('Dinlenme');
    expect(t('2026-11-15')).toContain('Karne ve haftalık plan');
    expect(t('2026-11-15').some((x) => x.startsWith('Hareket'))).toBe(false);
    expect(t('2026-11-09').length).toBeGreaterThan(10);

    // Uyku gece yarısını aşar ve korunan zamandır
    const sleep = d.routines.find((r) => r.title === 'Uyku')!;
    expect(sleep.flex.protected).toBe(true);
    const day = occurrencesForDay(d.routines, [], '2026-11-10');
    expect(day.some((x) => x.continuesFromPrevDay && x.instance.routineId === sleep.id)).toBe(true);

    // Hafta içi aynı saatte iki blok yok (İkindi arası hariç: mesai içinde bilinçli kısa ara)
    for (const date of ['2026-11-09', '2026-11-12', '2026-11-14', '2026-11-15']) {
      const occ = expandRange(d.routines, [], date, date).filter((o) => !d.routines.find((r) => r.id === o.routineId)!.title.startsWith('İkindi'));
      for (let i = 1; i < occ.length; i++) {
        const prev = occ[i - 1];
        const prevEnd = prev.endDate > date ? '24:00' : prev.endTime;
        expect(occ[i].startTime >= prevEnd, `${date} ${occ[i].startTime}`).toBe(true);
      }
    }
  });
});
