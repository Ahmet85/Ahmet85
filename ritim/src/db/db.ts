// Cihazdaki veritabanı (IndexedDB, Dexie ile). Veriler cihazdan çıkmaz.
import Dexie, { type Table } from 'dexie';
import type {
  Category,
  DatedTask,
  EventItem,
  HistoryEntry,
  OccurrenceRecord,
  Profile,
  ProgressNote,
  Project,
  Reminder,
  Routine,
  TableName,
} from '../domain/types';

export interface MetaRow {
  key: string;
  value: unknown;
}

export class RitimDB extends Dexie {
  profiles!: Table<Profile, string>;
  categories!: Table<Category, string>;
  routines!: Table<Routine, string>;
  occurrences!: Table<OccurrenceRecord, string>;
  events!: Table<EventItem, string>;
  tasks!: Table<DatedTask, string>;
  projects!: Table<Project, string>;
  notes!: Table<ProgressNote, string>;
  reminders!: Table<Reminder, string>;
  history!: Table<HistoryEntry, number>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'ritim') {
    super(name);
    this.version(1).stores({
      profiles: 'id',
      categories: 'id, profileId',
      routines: 'id, profileId',
      occurrences: 'id, profileId, routineId, date',
      events: 'id, profileId, startDate',
      tasks: 'id, profileId, date',
      projects: 'id, profileId',
      notes: 'id, profileId, projectId',
      reminders: 'id, profileId',
      history: '++id, profileId',
      meta: 'key',
    });
  }
}

/** Kullanıcı verisi tutan tablolar (yedeğe girenler). */
export const DATA_TABLES: TableName[] = [
  'profiles',
  'categories',
  'routines',
  'occurrences',
  'events',
  'tasks',
  'projects',
  'notes',
  'reminders',
];

/** Profile bağlı tablolar (profil silinince temizlenir). */
export const PROFILE_TABLES: Exclude<TableName, 'profiles'>[] = [
  'categories',
  'routines',
  'occurrences',
  'events',
  'tasks',
  'projects',
  'notes',
  'reminders',
];

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
