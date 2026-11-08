import { describe, expect, it } from 'vitest';
import { buildIcs, fold, icsEscape } from '../src/domain/ics';
import { streakInfo } from '../src/domain/streaks';
import { makeReminder } from '../src/domain/reminders';
import { Temporal } from '../src/domain/time';
import type { OccurrenceRecord } from '../src/domain/types';
import { routine } from './helpers';

const empty = { routines: [], records: [], events: [], tasks: [] };

describe('alarmlı takvim dosyası (.ics)', () => {
  const r = routine({ id: 'g', title: 'Gitar, repertuar', startTime: '20:00', durationMin: 60 });
  const rems = [makeReminder('p1', { kind: 'routine', routineId: 'g' }, 15)];
  const opts = {
    from: '2026-03-02', to: '2026-03-04', timeZone: 'Europe/Istanbul', calendarName: 'Ritim',
    alarmText: () => 'Gitar saatin geldi; parmaklar ısınsın mı?', now: Temporal.Instant.from('2026-03-01T00:00:00Z'),
  };

  it('her oluşum için bir kayıt ve VALARM, UTC saatle', () => {
    const ics = buildIcs(rems, { ...empty, routines: [r] }, opts);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain('DTSTART:20260302T170000Z'); // 20:00 İstanbul
    expect(ics).toContain('TRIGGER:-PT15M');
    expect(ics).toContain('SUMMARY:Gitar\\, repertuar');
    expect(ics).toContain('DESCRIPTION:Gitar saatin geldi\; parmaklar ısınsın mı?');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('atlanan oluşum dahil edilmez, taşınan yeni saatinde', () => {
    const recs: OccurrenceRecord[] = [
      { id: 'g@2026-03-02', profileId: 'p1', routineId: 'g', originalDate: '2026-03-02', status: 'skipped' },
      { id: 'g@2026-03-03', profileId: 'p1', routineId: 'g', originalDate: '2026-03-03', startTime: '18:00' },
    ];
    const ics = buildIcs(rems, { ...empty, routines: [r], records: recs }, opts);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).not.toContain('DTSTART:20260302');
    expect(ics).toContain('DTSTART:20260303T150000Z');
  });

  it('uzun satırlar 75 baytta katlanır, Türkçe karakterler bölünmez', () => {
    const line = 'DESCRIPTION:' + 'ğüşıöç'.repeat(30);
    const folded = fold(line);
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
    expect(icsEscape('a\nb')).toBe('a\\nb');
  });
});

describe('seri ve geri dönüş', () => {
  const r = routine({ id: 'g', startTime: '08:00', durationMin: 30 });
  const done = (d: string): OccurrenceRecord => ({ id: `g@${d}`, profileId: 'p1', routineId: 'g', originalDate: d, status: 'done' });

  it('art arda aktif günler sayılır; bugün henüz yoksa dünden sayılır', () => {
    const recs = ['2026-03-05', '2026-03-06', '2026-03-07'].map(done);
    expect(streakInfo({ ...empty, routines: [r], records: recs }, '2026-03-08')).toMatchObject({ streak: 3, todayActive: false });
    expect(streakInfo({ ...empty, routines: [r], records: [...recs, done('2026-03-08')] }, '2026-03-08')).toMatchObject({ streak: 4, todayActive: true, dayComplete: true });
  });

  it('ara sonrası dönüş kutlanır; seri bozulunca ceza yok (sadece sıfırdan başlar)', () => {
    const recs = ['2026-03-01', '2026-03-02', '2026-03-06'].map(done);
    const s = streakInfo({ ...empty, routines: [r], records: recs }, '2026-03-06');
    expect(s).toMatchObject({ streak: 1, comeback: true });
  });

  it('kısa sürüm de tamamlandı sayılır; atlanan blok günü "tamamlanmamış" yapmaz', () => {
    const r2 = routine({ id: 'h', startTime: '09:00', durationMin: 30 });
    const recs: OccurrenceRecord[] = [
      { ...done('2026-03-06'), status: 'done_short' },
      { id: 'h@2026-03-06', profileId: 'p1', routineId: 'h', originalDate: '2026-03-06', status: 'skipped' },
    ];
    expect(streakInfo({ ...empty, routines: [r, r2], records: recs }, '2026-03-06').dayComplete).toBe(true);
  });
});

import { fireTimes } from '../src/domain/reminders';
describe('hatırlatma çalma kuralları', () => {
  it('tamamlanmış ya da atlanmış şey için hatırlatma çalmaz', () => {
    const r = routine({ id: 'g', startTime: '20:00', durationMin: 60 });
    const rems = [makeReminder('p1', { kind: 'routine', routineId: 'g' }, 0)];
    const recs: OccurrenceRecord[] = [
      { id: 'g@2026-03-02', profileId: 'p1', routineId: 'g', originalDate: '2026-03-02', status: 'done' },
      { id: 'g@2026-03-03', profileId: 'p1', routineId: 'g', originalDate: '2026-03-03', status: 'done_short' },
    ];
    const f = fireTimes(rems, { ...empty, routines: [r], records: recs }, '2026-03-02', '2026-03-04', 'Europe/Istanbul');
    expect(f.map((x) => x.date)).toEqual(['2026-03-04']);
    expect(f[0].source).toEqual({ routineId: 'g', originalDate: '2026-03-04' });
  });
});
