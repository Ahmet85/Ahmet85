// Örnek profil "Ahmet" (tarif bölüm 5). YALNIZCA geliştirme ve deneme içindir;
// yeni kullanıcıların varsayılanı değildir. Ayarlar > Geliştirici > "Örnek
// profili yükle" ile eklenir. Müzik çalışmaları, mesai ve ibadet vakitleri
// yalnızca bu profile aittir.
import type {
  Category,
  Flexibility,
  Profile,
  ProfileSettings,
  Project,
  Routine,
  ShortVersion,
  Weekday,
} from '../domain/types';
import { minutesOfDay } from '../domain/time';
import { PALETTE } from '../domain/palette';

const WD: Weekday[] = [1, 2, 3, 4, 5];
const ALL: Weekday[] = [1, 2, 3, 4, 5, 6, 7];
const RULE_START = '2026-01-05'; // bir Pazartesi

const FIXED: Flexibility = { timing: 'fixed', priority: 'high', shortenable: false, movable: false, protected: false };
const PROTECTED: Flexibility = { timing: 'fixed', priority: 'high', shortenable: false, movable: false, protected: true };
const FLEX: Flexibility = { timing: 'flexible', priority: 'medium', shortenable: true, movable: true, protected: false };
const ROUTINE: Flexibility = { timing: 'flexible', priority: 'medium', shortenable: false, movable: false, protected: false };
const LIGHT: Flexibility = { timing: 'flexible', priority: 'low', shortenable: false, movable: false, protected: false };

export function buildSampleProfile(id: string, settings: ProfileSettings, now = new Date()) {
  const profile: Profile = { id, name: 'Ahmet', createdAt: now.toISOString(), settings, isSample: true };

  const cat = (key: string, name: string, color: keyof typeof PALETTE, icon: string, order: number): Category => ({
    id: `${id}-c-${key}`,
    profileId: id,
    name,
    color: PALETTE[color],
    icon,
    order,
  });
  const categories = [
    cat('daily', 'Günlük', 'bej', 'sun', 0),
    cat('body', 'Hareket', 'yesil', 'leaf', 1),
    cat('work', 'Mesai', 'lacivert', 'briefcase', 2),
    cat('music', 'Müzik', 'kiremit', 'note', 3),
    cat('faith', 'İbadet', 'bej', 'moon', 4),
    cat('family', 'Aile ve sosyal', 'hardal', 'heart', 5),
    cat('rest', 'Dinlenme', 'mavi', 'book', 6),
  ];
  const C = (k: string) => `${id}-c-${k}`;

  const proj = (key: string, name: string): Project => ({ id: `${id}-p-${key}`, profileId: id, name, categoryId: C('music') });
  const projects = [
    proj('piano', 'Piyano ve teori'),
    proj('guitar', 'Gitar repertuarı'),
    proj('record', 'Kayıt işleri'),
    proj('video', 'Video projeler'),
    proj('compose', 'Beste'),
    proj('arrange', 'Arrange'),
    proj('mix', 'Mix ve render'),
  ];
  const P = (k: string) => `${id}-p-${k}`;

  let n = 0;
  const routines: Routine[] = [];
  const R = (
    title: string,
    category: string,
    start: string,
    end: string,
    days: Weekday[],
    flex: Flexibility,
    extra: Partial<Routine> = {},
  ) => {
    let dur = minutesOfDay(end) - minutesOfDay(start);
    if (dur <= 0) dur += 24 * 60; // gece yarısını aşan blok
    routines.push({
      id: `${id}-r-${++n}`,
      profileId: id,
      title,
      categoryId: C(category),
      startTime: start,
      durationMin: dur,
      recurrence: { freq: 'weekly', interval: 1, byWeekday: days, startDate: RULE_START },
      flex,
      shortVersions: [],
      ...extra,
    });
  };
  const sv = (title: string, durationMin: number): ShortVersion => ({ id: `sv-${title}`, title, durationMin });
  const moveShort = [sv('15 dk yürüyüş', 15), sv('5 dk esneme', 5)];
  const makeShort = [sv('Tek bir alt işi bitir', 20), sv('Sonraki adımı hazırla', 5)];

  // Her gün aynı sabah
  R('Uyanış · S N', 'daily', '06:30', '07:00', ALL, ROUTINE);
  R('Hareket: güç', 'body', '07:00', '07:45', [1, 3, 5], FLEX, { shortVersions: moveShort });
  R('Hareket: yürüyüş', 'body', '07:00', '07:45', [2, 6], FLEX, { shortVersions: moveShort });
  R('Hareket: esneme ve mobilite', 'body', '07:00', '07:45', [4], FLEX, { shortVersions: moveShort });
  R('Dinlenme', 'rest', '07:00', '07:45', [7], PROTECTED);
  R('Planlama ve kahve', 'daily', '07:45', '08:15', ALL, ROUTINE);
  R('Kahvaltı', 'daily', '08:15', '09:00', ALL, ROUTINE);

  // Hafta içi
  R('Mesai', 'work', '09:00', '12:30', WD, FIXED);
  R('Yemek · Ö N', 'daily', '12:30', '13:30', WD, ROUTINE);
  R('Mesai', 'work', '13:30', '17:00', WD, FIXED);
  R('İkindi kısa ara', 'faith', '15:34', '15:44', WD, FIXED);
  R('Mola · yürüyüş', 'body', '17:00', '18:00', WD, LIGHT);
  R('Serbest', 'rest', '18:00', '19:00', WD, LIGHT);

  // Akşam odağı (esnek, taşınabilir, kısa sürümlü)
  const focus: [Weekday, string, string][] = [
    [1, 'Piyano ve teori', 'piano'],
    [2, 'Gitar repertuarı', 'guitar'],
    [3, 'Kayıt işleri', 'record'],
    [4, 'Video projeler', 'video'],
    [5, 'Beste', 'compose'],
  ];
  for (const [d, t, p] of focus)
    R(`Akşam odağı: ${t}`, 'music', '20:00', '21:00', [d], FLEX, { projectId: P(p), shortVersions: makeShort });

  R('15 dk piyano', 'music', '21:00', '21:15', [1, 2, 3, 4, 5, 6], FLEX, { projectId: P('piano') });
  const late: [Weekday, string, string | undefined][] = [
    [1, 'Arrange', 'arrange'],
    [2, 'Teori ve mix', 'mix'],
    [3, 'Mix ve render', 'mix'],
    [4, 'Serbest', undefined],
    [5, 'Beste', 'compose'],
  ];
  for (const [d, t, p] of late)
    R(t, p ? 'music' : 'rest', '21:15', '21:45', [d], p ? FLEX : LIGHT, p ? { projectId: P(p) } : {});

  // Akşamlar (her gün)
  R('Akşam yemeği · A N', 'daily', '19:00', '20:00', ALL, ROUTINE);
  R('Y N · ekranlar kapanır', 'faith', '21:45', '22:00', ALL, ROUTINE);
  R('Okuma', 'rest', '22:00', '23:00', ALL, LIGHT);
  R('Uyku', 'rest', '23:00', '06:30', ALL, PROTECTED); // gece yarısını aşar

  // Hafta sonu
  R('Aile', 'family', '09:00', '12:30', [6, 7], PROTECTED);
  R('Aile yemeği · Ö N', 'family', '12:30', '13:30', [6, 7], PROTECTED);
  R('Serbest', 'rest', '13:30', '18:30', [6], LIGHT);
  R('Arkadaşlar', 'family', '18:30', '19:00', [6], ROUTINE);
  R('Sosyal medya ve içerik', 'music', '20:00', '21:00', [6], FLEX);
  R('Serbest', 'rest', '13:30', '19:00', [7], LIGHT);
  R('Karne ve haftalık plan', 'daily', '20:00', '21:45', [7], ROUTINE);

  return { profile, categories, projects, routines };
}
