// Ritim veri modeli (tarif bölüm 4). Kişiden bağımsızdır: hiçbir alan tek bir
// yaşam düzenine, ülkeye veya saat dilimine sabitlenmez.
//
// Zaman kuralı: tüm tarih/saatler "yerel saat" (duvar saati) olarak saklanır:
// tarih "YYYY-MM-DD", saat "HH:MM". Gerçek ana (instant) çevirme yalnızca
// profilin saat dilimiyle, gerektiği anda yapılır (bkz. time.ts).

export type ID = string;
export type PlainDateStr = string; // "2026-11-08"
export type PlainTimeStr = string; // "07:45"

/** ISO hafta günü: 1 = Pazartesi … 7 = Pazar */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ProfileSettings {
  language: string; // arayüz dili, şimdilik yalnızca "tr"
  region: string; // tarih/sayı biçimi bölgesi, ör. "TR", "DE", "US"
  timeZone: string; // IANA, ör. "Europe/Istanbul"
  weekStart: Weekday; // haftanın ilk günü
  hourCycle: 'h23' | 'h12'; // 24 / 12 saat
}

export interface Profile {
  id: ID;
  name: string;
  createdAt: string; // ISO anı
  settings: ProfileSettings;
  /** Profiller arası isteğe bağlı PIN (özet olarak saklanır, düz metin değil). */
  pinHash?: string;
  /** Yalnızca geliştirici "Örnek profili yükle" ile eklenenler için. */
  isSample?: boolean;
}

export interface CategoryColor {
  bg: string; // açık zemin
  fg: string; // koyu yazı
  accent: string; // vurgu
}

export interface Category {
  id: ID;
  profileId: ID;
  name: string;
  color: CategoryColor;
  icon: string; // kodla çizilen ikon adı (emoji değil)
  order: number;
}

/**
 * Tekrar kuralı. Örnekler:
 *  - her gün:            { freq: 'daily', interval: 1 }
 *  - hafta içi:          { freq: 'weekly', interval: 1, byWeekday: [1,2,3,4,5] }
 *  - iki haftada bir Sa: { freq: 'weekly', interval: 2, byWeekday: [2] }
 *  - tarih aralığı:      startDate + endDate
 *  - tek seferlik değil; tek seferlikler Event/DatedTask olarak tutulur.
 */
export interface RecurrenceRule {
  freq: 'daily' | 'weekly';
  interval: number; // 1 = her gün/hafta, 2 = iki günde/haftada bir
  byWeekday?: Weekday[]; // yalnızca weekly
  startDate: PlainDateStr; // kural bu tarihten itibaren geçerli (aralık bu tarihe göre sayılır)
  endDate?: PlainDateStr; // dahil
}

export type Priority = 'low' | 'medium' | 'high';

export interface Flexibility {
  timing: 'fixed' | 'flexible'; // saat sabit mi esnek mi
  priority: Priority;
  shortenable: boolean; // kısaltılabilir mi
  movable: boolean; // başka güne taşınabilir mi
  protected: boolean; // korunan zaman (uyku, dinlenme, aile): otomatik daraltılmaz
}

export interface ShortVersion {
  id: ID;
  title: string; // "15 dk yürüyüş"
  durationMin: number;
}

/** Rutin blok: tekrarlayan şablon. */
export interface Routine {
  id: ID;
  profileId: ID;
  title: string;
  categoryId?: ID;
  projectId?: ID;
  startTime: PlainTimeStr;
  /** Süre dakika. Gece yarısını aşabilir (22:00 + 480 dk = ertesi gün 06:00). */
  durationMin: number;
  recurrence: RecurrenceRule;
  flex: Flexibility;
  shortVersions: ShortVersion[]; // en uzundan en kısaya
  description?: string;
}

export type Status =
  | 'planned' // planlandı
  | 'done' // tamamlandı
  | 'done_short' // kısa sürüm tamamlandı
  | 'postponed' // ertelendi
  | 'skipped' // atlandı (bilinçli)
  | 'cancelled'; // iptal

/**
 * Oluşum kaydı: bir rutinin belirli bir tarihteki örneğine ait istisna/durum.
 * Yalnızca bir şey değiştiğinde saklanır; şablon (Routine) hiç bozulmaz.
 * Anahtar: routineId + originalDate.
 */
export interface OccurrenceRecord {
  id: ID; // `${routineId}@${originalDate}`
  profileId: ID;
  routineId: ID;
  originalDate: PlainDateStr; // kuralın ürettiği asıl tarih
  /** Taşındıysa yeni tarih/saat. */
  date?: PlainDateStr;
  startTime?: PlainTimeStr;
  durationMin?: number; // bu tarihe özel süre
  status?: Status;
  shortVersionId?: ID; // kısa sürüm yapıldıysa hangisi
  actualMin?: number; // gerçekleşen süre
  /** "Bilinçli değişiklik" (Günüm değişti vb.); karnede başarısızlık sayılmaz. */
  consciousChange?: boolean;
}

/** Tek seferlik etkinlik / randevu; çok günlü olabilir. */
export interface EventItem {
  id: ID;
  profileId: ID;
  title: string;
  startDate: PlainDateStr;
  startTime?: PlainTimeStr; // yoksa tüm gün
  endDate: PlainDateStr;
  endTime?: PlainTimeStr;
  categoryId?: ID;
  description?: string;
  location?: string;
  status: Status;
  actualMin?: number;
}

/** Tarihli görev: saati olmayabilir (son ödeme, doğum günü). */
export interface DatedTask {
  id: ID;
  profileId: ID;
  title: string;
  date: PlainDateStr;
  time?: PlainTimeStr;
  categoryId?: ID;
  status: Status;
}

/** Çalışma/proje: "Gitar repertuarı", "Kitap: X". */
export interface Project {
  id: ID;
  profileId: ID;
  name: string;
  categoryId?: ID;
  archived?: boolean;
}

/** "Kaldığım yer" notu: kategoriye değil projeye bağlıdır. */
export interface ProgressNote {
  id: ID;
  profileId: ID;
  projectId: ID;
  createdAt: string;
  text: string;
  routineId?: ID;
  originalDate?: PlainDateStr;
}

export type ReminderTarget =
  | { kind: 'routine'; routineId: ID } // rutinin tüm tekrarları
  | { kind: 'occurrence'; routineId: ID; originalDate: PlainDateStr } // tek tarih
  | { kind: 'event'; eventId: ID }
  | { kind: 'task'; taskId: ID };

/**
 * Hatırlatma. Zamanı saklanmaz; her seferinde kaynağın güncel saatinden
 * hesaplanır. Böylece kaynak değişince kendiliğinden güncellenir.
 */
export interface Reminder {
  id: ID; // hedef + ofset'ten türetilir → çift hatırlatma oluşamaz
  profileId: ID;
  target: ReminderTarget;
  /** Kaç dakika önce: 0 = tam vaktinde, 1440 = 1 gün önce. */
  offsetMin: number;
}

export type TableName =
  | 'profiles'
  | 'categories'
  | 'routines'
  | 'occurrences'
  | 'events'
  | 'tasks'
  | 'projects'
  | 'notes'
  | 'reminders';

export interface Change {
  table: TableName;
  key: ID;
  before: unknown | null; // null = yoktu (eklendi)
  after: unknown | null; // null = silindi
}

/** İşlem geçmişi: her değişiklik geri alınabilir. */
export interface HistoryEntry {
  id?: number;
  profileId: ID | null;
  at: string;
  label: string; // çeviri anahtarı, ör. "history.addRoutine"
  changes: Change[];
  undone?: boolean;
}

/** Bir günün ekranında gösterilecek, kuraldan üretilmiş somut blok. */
export interface OccurrenceInstance {
  routineId: ID;
  originalDate: PlainDateStr;
  date: PlainDateStr; // başladığı tarih (taşınmışsa yeni tarih)
  startTime: PlainTimeStr;
  durationMin: number;
  /** Yerel bitiş tarihi/saati (gece yarısını aşarsa ertesi gün). */
  endDate: PlainDateStr;
  endTime: PlainTimeStr;
  status: Status;
  moved: boolean;
  record?: OccurrenceRecord;
}
