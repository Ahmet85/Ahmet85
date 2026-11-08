// JSON yedekle / geri yükle (yerel veri kaybına karşı zorunlu).
import { DATA_TABLES, type RitimDB } from './db';
import type { TableName } from '../domain/types';

export const BACKUP_APP = 'ritim';
export const BACKUP_VERSION = 1;

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: Record<TableName, unknown[]>;
}

export async function exportBackup(db: RitimDB): Promise<Backup> {
  const data = {} as Record<TableName, unknown[]>;
  await db.transaction('r', DATA_TABLES.map((t) => db.table(t)), async () => {
    for (const t of DATA_TABLES) data[t] = await db.table(t).toArray();
  });
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

export class BackupError extends Error {
  constructor(public code: 'invalid' | 'newerVersion') {
    super(code);
  }
}

export function validateBackup(raw: unknown): Backup {
  const b = raw as Partial<Backup> | null;
  if (!b || typeof b !== 'object' || b.app !== BACKUP_APP || typeof b.version !== 'number' || !b.data)
    throw new BackupError('invalid');
  if (b.version > BACKUP_VERSION) throw new BackupError('newerVersion');
  for (const t of DATA_TABLES) {
    const rows = (b.data as Record<string, unknown>)[t] ?? [];
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof (r as { id?: unknown }).id !== 'string'))
      throw new BackupError('invalid');
  }
  return b as Backup;
}

/** Cihazdaki tüm veriyi yedektekiyle değiştirir. İşlem geçmişi temizlenir. */
export async function restoreBackup(db: RitimDB, raw: unknown): Promise<void> {
  const b = validateBackup(raw);
  const tables = [...DATA_TABLES.map((t) => db.table(t)), db.history, db.meta];
  await db.transaction('rw', tables, async () => {
    for (const t of DATA_TABLES) {
      await db.table(t).clear();
      await db.table(t).bulkPut(((b.data as Record<string, unknown[]>)[t] ?? []) as object[]);
    }
    await db.history.clear();
    await db.meta.delete('activeProfileId');
  });
}

export function backupFileName(now = new Date()) {
  const d = now.toISOString().slice(0, 10);
  return `ritim-yedek-${d}.json`;
}
