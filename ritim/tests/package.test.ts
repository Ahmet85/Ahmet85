import { describe, expect, it } from 'vitest';
import { codeFromLink, decodePackage, encodePackage, materialize, validatePackage, type ProgramPackage } from '../src/domain/profilePackage';
import { buildDay } from '../src/domain/agenda';

const pkg: ProgramPackage = {
  app: 'ritim', kind: 'program', version: 1, name: 'Deneme',
  categories: [{ key: 'm', name: 'Müzik', color: { bg: '#F3DFD3', fg: '#8A3C1E', accent: '#C2643F' }, icon: 'note' }],
  projects: [{ key: 'p', name: 'Piyano', category: 'm' }],
  routines: [
    { title: 'Piyano', category: 'm', project: 'p', start: '20:00', durationMin: 60, days: [1, 3], flex: { timing: 'flexible', priority: 'medium', shortenable: true, movable: true, protected: false }, short: [{ title: '15 dk', durationMin: 15 }] },
    { title: 'Uyku', start: '23:00', durationMin: 450, days: [1, 2, 3, 4, 5, 6, 7], flex: { timing: 'fixed', priority: 'high', shortenable: false, movable: false, protected: true } },
  ],
};

describe('bağlantıyla program paketi', () => {
  it('kodlanıp çözülünce aynı paket döner; bağlantıdan kod ayıklanır', async () => {
    const code = await encodePackage(pkg);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodePackage(code)).toEqual(pkg);
    expect(codeFromLink(`https://ahmet85.github.io/Ahmet85/ritim/#import=${code}`)).toBe(code);
    expect(codeFromLink('rastgele yazı')).toBeNull();
  });

  it('bozuk ya da yabancı içerik reddedilir', async () => {
    await expect(decodePackage('abc')).rejects.toThrow();
    expect(() => validatePackage({ app: 'ritim', kind: 'program', version: 1, name: 'x', categories: [], projects: [], routines: [{ title: 'a', start: '25', durationMin: 10, days: [1] }] })).toThrow();
  });

  it('yeni kimliklerle profile dönüşür; kategoriler ve çalışmalar bağlı; gece yarısını aşan blok doğru', () => {
    let n = 0;
    const rows = materialize(pkg, {
      profileId: 'p1', uid: () => `id${++n}`, startDate: '2026-11-09',
      settings: { language: 'tr', region: 'TR', timeZone: 'Europe/Istanbul', weekStart: 1, hourCycle: 'h23' },
    });
    expect(rows.profile).toMatchObject({ id: 'p1', name: 'Deneme' });
    const piano = rows.routines.find((r) => r.title === 'Piyano')!;
    expect(piano.categoryId).toBe(rows.categories[0].id);
    expect(piano.projectId).toBe(rows.projects[0].id);
    expect(piano.shortVersions[0].title).toBe('15 dk');
    const day = buildDay({ routines: rows.routines, records: [], events: [], tasks: [] }, '2026-11-10');
    expect(day.map((i) => `${i.continues ? 'devam' : i.startTime} ${i.title}`)).toEqual(['devam Uyku', '23:00 Uyku']);
  });
});
