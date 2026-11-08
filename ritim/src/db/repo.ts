// Tüm yazma işlemleri buradan geçer. Her işlem tek bir "işlem geçmişi"
// kaydı oluşturur ve geri alınabilir. Kaynak silinince bağlı hatırlatmalar
// ve oluşum kayıtları da aynı işlemde silinir: sahipsiz kayıt kalmaz.
import type {
  Category,
  Change,
  DatedTask,
  EventItem,
  HistoryEntry,
  OccurrenceRecord,
  Profile,
  Project,
  ProgressNote,
  Reminder,
  ReminderTarget,
  Routine,
  TableName,
} from '../domain/types';
import { makeReminder, remindersFor } from '../domain/reminders';
import { occurrenceId } from '../domain/recurrence';
import { PROFILE_TABLES, type RitimDB } from './db';

export const HISTORY_LIMIT = 100;

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

  // ---- Projeler ve notlar ----
  putProject(p: Project) {
    return this.apply(p.profileId, 'history.saveProject', [{ table: 'projects', put: p }]);
  }

  addNote(n: ProgressNote) {
    return this.apply(n.profileId, 'history.addNote', [{ table: 'notes', put: n }]);
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
    const [categories, routines, records, events, tasks, projects, notes, reminders] = await Promise.all([
      by<Category>('categories'),
      by<Routine>('routines'),
      by<OccurrenceRecord>('occurrences'),
      by<EventItem>('events'),
      by<DatedTask>('tasks'),
      by<Project>('projects'),
      by<ProgressNote>('notes'),
      by<Reminder>('reminders'),
    ]);
    return { categories, routines, records, events, tasks, projects, notes, reminders };
  }
}

export type ProfileData = Awaited<ReturnType<Repo['loadProfileData']>>;
