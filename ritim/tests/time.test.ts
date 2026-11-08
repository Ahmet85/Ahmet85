import { describe, expect, it } from 'vitest';
import { localEnd, realDurationMin, startOfWeek, toZoned } from '../src/domain/time';

// Avrupa'da yaz saati: 29 Mart 2026 02:00 → 03:00 (ileri), 25 Ekim 2026 03:00 → 02:00 (geri)
const BERLIN = 'Europe/Berlin';
const NY = 'America/New_York'; // 8 Mart 2026 ileri, 1 Kasım 2026 geri

describe('yaz saati', () => {
  it('ileri alınan gece: 22:00–06:00 vardiya duvar saatinde 06:00 biter, gerçekte 7 saat sürer', () => {
    const end = localEnd('2026-03-28', '22:00', 480);
    expect(end).toEqual({ date: '2026-03-29', time: '06:00' });
    expect(realDurationMin('2026-03-28', '22:00', end.date, end.time, BERLIN)).toBe(420);
  });

  it('geri alınan gece: aynı vardiya gerçekte 9 saat sürer', () => {
    expect(realDurationMin('2026-10-24', '22:00', '2026-10-25', '06:00', BERLIN)).toBe(540);
  });

  it('var olmayan saat (02:30) bir sonraki geçerli saate kayar', () => {
    const z = toZoned('2026-03-29', '02:30', BERLIN);
    expect(z.hour).toBe(3);
    expect(z.minute).toBe(30);
  });

  it('iki kez yaşanan saat (02:30) ilk yaşanışı seçer', () => {
    const z = toZoned('2026-10-25', '02:30', BERLIN);
    expect(z.offset).toBe('+02:00');
  });

  it('yaz saati olmayan bölgede (İstanbul) süre aynen kalır', () => {
    expect(realDurationMin('2026-03-28', '22:00', '2026-03-29', '06:00', 'Europe/Istanbul')).toBe(480);
  });

  it('ABD yaz saati günü de doğru', () => {
    expect(realDurationMin('2026-03-07', '23:00', '2026-03-08', '06:30', NY)).toBe(390);
  });
});

describe('saat dilimi değişikliği (seyahat)', () => {
  it('yerel saat olarak saklanan blok, yeni dilimde yerel saatiyle kalır', () => {
    const ist = toZoned('2026-06-10', '07:00', 'Europe/Istanbul');
    const tokyo = toZoned('2026-06-10', '07:00', 'Asia/Tokyo');
    expect(ist.hour).toBe(7);
    expect(tokyo.hour).toBe(7);
    expect(ist.epochMilliseconds).not.toBe(tokyo.epochMilliseconds);
  });
});

describe('haftanın ilk günü', () => {
  it('Pazartesi veya Pazar başlangıcı', () => {
    expect(startOfWeek('2026-03-05', 1)).toBe('2026-03-02');
    expect(startOfWeek('2026-03-05', 7)).toBe('2026-03-01');
    expect(startOfWeek('2026-03-05', 6)).toBe('2026-02-28');
  });
});

describe('hızlı takvim hesabı Temporal ile aynı sonucu verir', () => {
  it('1900–2100 arası her 37. gün', async () => {
    const { Temporal, toDayNumber, fromDayNumber, weekdayOf, addDays } = await import('../src/domain/time');
    let d = Temporal.PlainDate.from('1900-01-01');
    const end = Temporal.PlainDate.from('2100-12-31');
    while (Temporal.PlainDate.compare(d, end) <= 0) {
      const s = d.toString();
      expect(fromDayNumber(toDayNumber(s))).toBe(s);
      expect(weekdayOf(s)).toBe(d.dayOfWeek);
      expect(addDays(s, 400)).toBe(d.add({ days: 400 }).toString());
      d = d.add({ days: 37 });
    }
  });

  it('artık yıl ve ay ekleme', async () => {
    const { daysInMonth, addMonths } = await import('../src/domain/time');
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-15', 2)).toBe('2027-01-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });
});
