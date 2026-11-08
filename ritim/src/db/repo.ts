// Tüm yazma işlemleri buradan geçer. Her işlem tek bir "işlem geçmişi"
// kaydı oluşturur ve geri alınabilir. Kaynak silinince bağlı hatırlatmalar
// ve oluşum kayıtları da aynı işlemde silinir: sahipsiz kayıt kalmaz.
import type {
  Category,
  Change,
  DatedTask,
  EventItem,
  HistoryEntry,
  MonthTheme,
  OccurrenceRecord,
  Profile,
  Project,
  ProgressNote,
  RecurrenceRule,
  Reminder,
  ReminderTarget,
  Routine,
  TableName,
  YearGoals,
} from '../domain/types';
import { makeReminder, remindersFor } from '../domain/reminders';
import { occurrenceId } from '../domain/recurrence';
import type { AgendaItem } from '../domain/agenda';
import type { Resolution } from '../domain/conflicts';
import { splitRule, type Scope } from '../domain/moves';
import { addDays, localEnd, minutesOfDay, toDayNumber } from '../domain/time';
import { PROFILE_TABLES, uid, type RitimDB } from './db';

export const HISTORY_LIMIT = 100;

/** Randevunun dakika cinsinden süresi (tüm gün ise 60 varsayılır). */
export function eventDuration(e: EventItem) {
  return e.startTime && e.endTime
    ? (toDayNumber(e.endDate) - toDayNumber(e.startDate)) * 1440 + minutesOfDay(e.endTime) - minutesOfDay(e.startTime)
    : 60;
}

/** Randevuyu yeni başlangıca taşı (süre korunur). Tüm gün etkinlik gün olarak kayar. */
export function movedEvent(e: EventItem, date: string, startTime: string | undefined, durationMin: number): EventItem {
  if (!e.startTime || !startTime) {
    const span = toDayNumber(e.endDate) - toDayNumber(e.startDate);
    return { ...e, startDate: date, endDate: addDays(date, span) };
  }
  const end = localEnd(date, startTime, durationMin);
  return { ...e, startDate: date, startTime, endDate: end.date, endTime: end.time };
}

/** Tablo satırı (yalnızca kimliği zorunlu) */
const row = <T extends { id: string }>(x: T) => x;

type Op = { table: TableName; put: { id: string } } | { table: TableName; del: string };

export class Repo {
  constructor(public db: RitimDB) {}

  private tables() {
    return [
      this.db.profiles,
      this.db.categories,
      this.db.routines,
      this.db.occurrences,
      this.db.events,
      this.db.tasks,
      this.db.projects,
      this.db.notes,
      this.db.reminders,
      this.db.monthThemes,
      this.db.yearGoals,
      this.db.history,
    ];
  }

  /** İşlemleri tek seferde uygular ve geçmişe yazar. */
  async apply(profileId: string | null, label: string, ops: Op[]): Promise<number | undefined> {
    if (!ops.length) return;
    return this.db.transaction('rw', this.tables(), async () => {
      const changes: Change[] = [];
      for (const op of ops) {
        const table = this.db.table(op.table);
        const key = 'put' in op ? op.put.id : op.del;
        const before = (await table.get(key)) ?? null;
        if ('put' in op) {
          await table.put(op.put);
          changes.push({ table: op.table, key, before, after: op.put });
        } else if (before) {
          await table.delete(key);
          changes.push({ table: op.table, key, before, after: null });
        }
      }
      if (!changes.length) return;
      const id = await this.db.history.add({
        profileId,
        at: new Date().toISOString(),
        label,
        changes,
      });
      // Eski geçmişi buda
      const all = await this.db.history.where('profileId').equals(profileId ?? '').primaryKeys();
      if (profileId && all.length > HISTORY_LIMIT)
        await this.db.history.bulkDelete(all.slice(0, all.length - HISTORY_LIMIT));
      return id;
    });
  }

  /** Son (geri alınmamış) işlemi geri alır. */
  async undoLast(profileId: string | null): Promise<HistoryEntry | undefined> {
    return this.db.transaction('rw', this.tables(), async () => {
      const entries = await this.db.history
        .filter((h) => h.profileId === profileId && !h.undone)
        .toArray();
      const last = entries.sort((a, b) => (a.id ?? 0) - (b.id ?? 0)).pop();
      if (!last) return;
      for (const c of [...last.changes].reverse()) {
        const table = this.db.table(c.table);
        if (c.before === null) await table.delete(c.key);
        else await table.put(c.before);
      }
      await this.db.history.update(last.id!, { undone: true });
      return last;
    });
  }

  async canUndo(profileId: string | null) {
    return (await this.db.history.filter((h) => h.profileId === profileId && !h.undone).count()) > 0;
  }

  // ---- Profiller ----
  async createProfile(p: Profile, categories: Category[] = []) {
    await this.apply(p.id, 'history.createProfile', [
      { table: 'profiles', put: p },
      ...categories.map((c) => ({ table: 'categories' as const, put: c })),
    ]);
  }

  updateProfile(p: Profile) {
    return this.apply(p.id, 'history.updateProfile', [{ table: 'profiles', put: p }]);
  }

  /** Profili ve ona ait her şeyi siler (geri alınabilir). */
  async deleteProfile(profileId: string) {
    const ops: Op[] = [];
    for (const t of PROFILE_TABLES) {
      const keys = (await this.db.table(t).where('profileId').equals(profileId).primaryKeys()) as string[];
      keys.forEach((k) => ops.push({ table: t, del: k }));
    }
    ops.push({ table: 'profiles', del: profileId });
    await this.apply(null, 'history.deleteProfile', ops);
  }

  // ---- Kategoriler ----
  putCategory(c: Category) {
    return this.apply(c.profileId, 'history.saveCategory', [{ table: 'categories', put: c }]);
  }

  /** Kategoriyi sil: bağlı bloklar silinmez, kategorisiz kalır. */
  deleteCategory(c: Category) {
    return this.apply(c.profileId, 'history.deleteCategory', [{ table: 'categories', del: c.id }]);
  }

  // ---- Rutinler ----
  putRoutine(r: Routine) {
    return this.apply(r.profileId, 'history.saveRoutine', [{ table: 'routines', put: r }]);
  }

  async deleteRoutine(r: Routine) {
    const rems = await this.db.reminders.where('profileId').equals(r.profileId).toArray();
    const recs = await this.db.occurrences.where('routineId').equals(r.id).primaryKeys();
    await this.apply(r.profileId, 'history.deleteRoutine', [
      ...remindersFor(rems, { routineId: r.id }).map((x) => ({ table: 'reminders' as const, del: x.id })),
      ...recs.map((k) => ({ table: 'occurrences' as const, del: k as string })),
      { table: 'routines', del: r.id },
    ]);
  }

  /** Yalnızca o tarihe ait değişiklik (şablon bozulmaz). */
  async patchOccurrence(
    profileId: string,
    routineId: string,
    originalDate: string,
    patch: Partial<Omit<OccurrenceRecord, 'id' | 'profileId' | 'routineId' | 'originalDate'>>,
    label = 'history.changeOccurrence',
  ) {
    const id = occurrenceId(routineId, originalDate);
    const existing = await this.db.occurrences.get(id);
    const rec: OccurrenceRecord = { ...(existing ?? { id, profileId, routineId, originalDate }), ...patch };
    await this.apply(profileId, label, [{ table: 'occurrences', put: rec }]);
  }

  // ---- Etkinlikler ve görevler ----
  putEvent(e: EventItem) {
    return this.apply(e.profileId, 'history.saveEvent', [{ table: 'events', put: e }]);
  }

  async deleteEvent(e: EventItem) {
    const rems = await this.db.reminders.where('profileId').equals(e.profileId).toArray();
    await this.apply(e.profileId, 'history.deleteEvent', [
      ...remindersFor(rems, { eventId: e.id }).map((x) => ({ table: 'reminders' as const, del: x.id })),
      { table: 'events', del: e.id },
    ]);
  }

  putTask(t: DatedTask) {
    return this.apply(t.profileId, 'history.saveTask', [{ table: 'tasks', put: t }]);
  }

  async deleteTask(t: DatedTask) {
    const rems = await this.db.reminders.where('profileId').equals(t.profileId).toArray();
    await this.apply(t.profileId, 'history.deleteTask', [
      ...remindersFor(rems, { taskId: t.id }).map((x) => ({ table: 'reminders' as const, del: x.id })),
      { table: 'tasks', del: t.id },
    ]);
  }

  /** Randevuyu iptal et: bağlı hatırlatmalar da silinir (geri alınabilir). */
  async cancelEvent(e: EventItem) {
    const rems = await this.db.reminders.where('profileId').equals(e.profileId).toArray();
    await this.apply(e.profileId, 'history.cancelEvent', [
      ...remindersFor(rems, { eventId: e.id }).map((x) => ({ table: 'reminders' as const, del: x.id })),
      { table: 'events', put: row({ ...e, status: 'cancelled' as const }) },
    ]);
  }

  /**
   * Yeni/düzenlenen randevu veya görevi, seçilen çakışma çözümleriyle birlikte
   * TEK işlemde kaydeder; "Geri al" hepsini birden geri alır.
   * Tekrarlayan bloklarda yalnızca o tarih değişir (şablon bozulmaz) ve
   * değişiklik "bilinçli" olarak işaretlenir (karnede başarısızlık sayılmaz).
   */
  async saveWithResolutions(
    profileId: string,
    label: string,
    item: { table: 'events' | 'tasks'; row: EventItem | DatedTask },
    resolutions: { target: AgendaItem; resolution: Resolution }[],
  ) {
    const ops: Op[] = [{ table: item.table, put: item.row }, ...(await this.resolutionOps(profileId, resolutions))];
    return this.apply(profileId, label, ops);
  }

  /** Çakışma çözümlerinin veritabanı işlemleri. */
  private async resolutionOps(profileId: string, resolutions: { target: AgendaItem; resolution: Resolution }[]) {
    const ops: Op[] = [];
    for (const { target, resolution: r } of resolutions) {
      if (r.action === 'keep') continue;
      if (target.kind === 'routine') {
        const patch: Partial<OccurrenceRecord> =
          r.action === 'skip'
            ? { status: 'skipped' }
            : r.action === 'move'
              ? { date: target.date, startTime: r.startTime }
              : { date: r.date, startTime: r.startTime };
        ops.push(await this.occurrenceOp(profileId, target.routineId!, target.originalDate!, { ...patch, consciousChange: true }));
      } else if (target.kind === 'event') {
        const e = await this.db.events.get(target.eventId!);
        if (!e) continue;
        if (r.action === 'skip') {
          ops.push({ table: 'events', put: row({ ...e, status: 'skipped' as const }) });
          continue;
        }
        const date = r.action === 'move' ? e.startDate : r.date;
        ops.push({ table: 'events', put: row(movedEvent(e, date, r.startTime, eventDuration(e))) });
      }
    }
    return ops;
  }

  private async occurrenceOp(profileId: string, routineId: string, originalDate: string, patch: Partial<OccurrenceRecord>): Promise<Op> {
    const id = occurrenceId(routineId, originalDate);
    const existing = (await this.db.occurrences.get(id)) ?? { id, profileId, routineId, originalDate };
    return { table: 'occurrences', put: row({ ...existing, ...patch }) };
  }

  /**
   * Bir öğeyi yeni gün/saate taşır veya süresini değiştirir (sürükle-bırak,
   * "Gün ve saati değiştir"). Tekrarlayan blokta scope='one' yalnızca o tarihi,
   * 'future' o tarihten sonraki tüm tekrarları değiştirir. Çakışma çözümleri
   * aynı işleme dahildir; tek "Geri al" hepsini geri alır.
   */
  async moveItem(
    profileId: string,
    item: AgendaItem,
    to: { date: string; startTime?: string; durationMin: number },
    scope: Scope,
    resolutions: { target: AgendaItem; resolution: Resolution }[] = [],
  ) {
    const ops: Op[] = [];
    if (item.kind === 'routine') {
      const r = (await this.db.routines.get(item.routineId!))!;
      if (scope === 'one') {
        ops.push(
          await this.occurrenceOp(profileId, r.id, item.originalDate!, {
            date: to.date,
            startTime: to.startTime,
            durationMin: to.durationMin === r.durationMin ? undefined : to.durationMin,
            consciousChange: true,
          }),
        );
      } else {
        ops.push(
          ...(await this.splitOps(r, item.originalDate!, {
            ...r,
            startTime: to.startTime ?? r.startTime,
            durationMin: to.durationMin,
          }, toDayNumber(to.date) - toDayNumber(item.originalDate!))),
        );
      }
    } else if (item.kind === 'event') {
      const e = (await this.db.events.get(item.eventId!))!;
      ops.push({ table: 'events', put: row(movedEvent(e, to.date, to.startTime, to.durationMin)) });
    } else {
      const k = (await this.db.tasks.get(item.taskId!))!;
      ops.push({ table: 'tasks', put: row({ ...k, date: to.date, time: to.startTime ?? k.time }) });
    }
    ops.push(...(await this.resolutionOps(profileId, resolutions)));
    return this.apply(profileId, 'history.moveItem', ops);
  }

  /**
   * Rutini fromDate'ten böler: önceki kısım aynen kalır, yeni seri `next`
   * değerleriyle (delta gün kaydırılarak) devam eder. fromDate ve sonrasına ait
   * istisnalar ve hatırlatmalar yeni seriye taşınır.
   */
  private async splitOps(r: Routine, fromDate: string, next: Routine, delta: number, ruleOverride?: RecurrenceRule): Promise<Op[]> {
    const ops: Op[] = [];
    const { old, next: rule } = splitRule(r.recurrence, fromDate, delta);
    const newId = uid();
    ops.push({ table: 'routines', put: row({ ...next, id: newId, recurrence: ruleOverride ?? rule }) });
    if (old) ops.push({ table: 'routines', put: row({ ...r, recurrence: old }) });
    else ops.push({ table: 'routines', del: r.id });

    const recs = await this.db.occurrences.where('routineId').equals(r.id).toArray();
    for (const rec of recs) {
      if (rec.originalDate < fromDate) continue;
      ops.push({ table: 'occurrences', del: rec.id });
      if (rec.originalDate === fromDate) continue; // taşınan oluşumun eski istisnası artık gereksiz
      const od = addDays(rec.originalDate, delta);
      ops.push({ table: 'occurrences', put: row({ ...rec, id: occurrenceId(newId, od), routineId: newId, originalDate: od }) });
    }
    const rems = await this.db.reminders.where('profileId').equals(r.profileId).toArray();
    for (const m of remindersFor(rems, { routineId: r.id })) {
      const t = m.target;
      if (t.kind === 'routine') {
        const copy = makeReminder(r.profileId, { kind: 'routine', routineId: newId }, m.offsetMin);
        ops.push({ table: 'reminders', put: copy });
        if (!old) ops.push({ table: 'reminders', del: m.id });
      } else if (t.kind === 'occurrence' && t.originalDate >= fromDate) {
        ops.push({ table: 'reminders', del: m.id });
        ops.push({
          table: 'reminders',
          put: makeReminder(r.profileId, { kind: 'occurrence', routineId: newId, originalDate: addDays(t.originalDate, delta) }, m.offsetMin),
        });
      }
    }
    return ops;
  }

  /**
   * Rutin düzenleme. Saat, süre veya tekrar günleri değiştiyse geçmiş bozulmasın
   * diye seri fromDate'ten bölünür; yalnızca ad/kategori/esneklik gibi
   * değişiklikler tüm seriye uygulanır.
   */
  async updateRoutine(prev: Routine, next: Routine, fromDate: string) {
    const timingChanged =
      prev.startTime !== next.startTime ||
      prev.durationMin !== next.durationMin ||
      JSON.stringify(prev.recurrence) !== JSON.stringify(next.recurrence);
    if (!timingChanged || next.recurrence.startDate >= fromDate || prev.recurrence.startDate >= fromDate)
      return this.apply(next.profileId, 'history.saveRoutine', [{ table: 'routines', put: next }]);
    const ops = await this.splitOps(prev, fromDate, next, 0, { ...next.recurrence, startDate: fromDate });
    return this.apply(next.profileId, 'history.saveRoutine', ops);
  }

  /** "Bundan sonraki tüm tekrarları sil": geçmiş kalır (karne için). */
  async endRoutineFrom(r: Routine, fromDate: string) {
    const { old } = splitRule(r.recurrence, fromDate, 0);
    if (!old) return this.deleteRoutine(r);
    const recs = await this.db.occurrences.where('routineId').equals(r.id).toArray();
    const rems = await this.db.reminders.where('profileId').equals(r.profileId).toArray();
    await this.apply(r.profileId, 'history.endRoutine', [
      { table: 'routines', put: row({ ...r, recurrence: old }) },
      ...recs.filter((x) => x.originalDate >= fromDate).map((x) => ({ table: 'occurrences' as const, del: x.id })),
      ...remindersFor(rems, { routineId: r.id })
        .filter((m) => m.target.kind === 'occurrence' && m.target.originalDate >= fromDate)
        .map((m) => ({ table: 'reminders' as const, del: m.id })),
    ]);
  }

  // ---- Projeler ve notlar ----
  putProject(p: Project) {
    return this.apply(p.profileId, 'history.saveProject', [{ table: 'projects', put: p }]);
  }

  addNote(n: ProgressNote) {
    return this.apply(n.profileId, 'history.addNote', [{ table: 'notes', put: n }]);
  }

  // ---- Ay teması ve yıl hedefleri ----
  putMonthTheme(m: MonthTheme) {
    return this.apply(m.profileId, 'history.saveMonthTheme', [{ table: 'monthThemes', put: m }]);
  }

  putYearGoals(y: YearGoals) {
    return this.apply(y.profileId, 'history.saveYearGoals', [{ table: 'yearGoals', put: y }]);
  }

  // ---- Hatırlatmalar ----
  /** Aynı hedef+ofset zaten varsa yeniden eklenmez (çift hatırlatma olmaz). */
  async addReminder(profileId: string, target: ReminderTarget, offsetMin: number): Promise<Reminder> {
    const r = makeReminder(profileId, target, offsetMin);
    if (!(await this.db.reminders.get(r.id)))
      await this.apply(profileId, 'history.addReminder', [{ table: 'reminders', put: r }]);
    return r;
  }

  removeReminder(r: Reminder) {
    return this.apply(r.profileId, 'history.removeReminder', [{ table: 'reminders', del: r.id }]);
  }

  // ---- Toplu ekleme (örnek profil) ----
  async bulkInsert(profileId: string, label: string, items: { table: TableName; rows: { id: string }[] }[]) {
    await this.apply(
      profileId,
      label,
      items.flatMap((i) => i.rows.map((put) => ({ table: i.table, put }))),
    );
  }

  // ---- Okuma ----
  async loadProfileData(profileId: string) {
    const by = <T>(t: TableName) => this.db.table<T>(t).where('profileId').equals(profileId).toArray();
    const [categories, routines, records, events, tasks, projects, notes, reminders, monthThemes, yearGoals] = await Promise.all([
      by<Category>('categories'),
      by<Routine>('routines'),
      by<OccurrenceRecord>('occurrences'),
      by<EventItem>('events'),
      by<DatedTask>('tasks'),
      by<Project>('projects'),
      by<ProgressNote>('notes'),
      by<Reminder>('reminders'),
      by<MonthTheme>('monthThemes'),
      by<YearGoals>('yearGoals'),
    ]);
    return { categories, routines, records, events, tasks, projects, notes, reminders, monthThemes, yearGoals };
  }
}

export type ProfileData = Awaited<ReturnType<Repo['loadProfileData']>>;
