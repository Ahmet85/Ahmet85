// Uygulama durumu: etkin profil, profilin verisi ve işlemler.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { RitimDB, uid } from '../db/db';
import { Repo, type ProfileData } from '../db/repo';
import type { Category, Profile, ProfileSettings } from '../domain/types';
import { deviceDefaults } from '../domain/time';
import { buildSampleProfile } from '../sample/ahmetProfile';

export const db = new RitimDB();
export const repo = new Repo(db);

const EMPTY: ProfileData = {
  categories: [], routines: [], records: [], events: [], tasks: [], projects: [], notes: [], reminders: [],
};

export interface Toast {
  id: number;
  /** Çeviri anahtarı */
  key: string;
  undo?: boolean;
}

interface Store {
  ready: boolean;
  profiles: Profile[];
  profile: Profile | null;
  data: ProfileData;
  toast: Toast | null;
  defaults: ProfileSettings;
  /** Bir işlemi çalıştır, ekranı yenile, "Geri al" seçeneği göster. */
  run: (key: string, fn: () => Promise<unknown>, opts?: { undo?: boolean; global?: boolean }) => Promise<void>;
  undo: () => Promise<void>;
  switchProfile: (id: string) => Promise<void>;
  createProfile: (name: string, categories: Omit<Category, 'id' | 'profileId'>[]) => Promise<void>;
  loadSample: () => Promise<void>;
  reload: () => Promise<void>;
  dismissToast: () => void;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [data, setData] = useState<ProfileData>(EMPTY);
  const [toast, setToast] = useState<Toast | null>(null);
  /** Son işlem profil dışı mıydı (profil silme)? Geri al o kapsamda çalışır. */
  const [undoScope, setUndoScope] = useState<'profile' | 'global'>('profile');
  const defaults = useMemo(() => deviceDefaults(), []);

  const reload = useCallback(async (preferId?: string | null) => {
    const all = (await db.profiles.toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const stored = (await db.meta.get('activeProfileId'))?.value as string | undefined;
    let id = preferId ?? stored ?? null;
    if (!id || !all.some((p) => p.id === id)) id = all[0]?.id ?? null;
    if (id !== stored) await db.meta.put({ key: 'activeProfileId', value: id });
    setProfiles(all);
    setActiveId(id);
    setData(id ? await repo.loadProfileData(id) : EMPTY);
    setReady(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const showToast = (key: string, undo = false) => setToast({ id: Date.now(), key, undo });

  const run: Store['run'] = async (key, fn, opts = {}) => {
    await fn();
    setUndoScope(opts.global ? 'global' : 'profile');
    await reload();
    showToast(key, opts.undo ?? true);
  };

  const undo = async () => {
    const entry = await repo.undoLast(undoScope === 'global' ? null : activeId);
    await reload(entry?.changes.find((c) => c.table === 'profiles')?.key ?? undefined);
    setUndoScope('profile');
    showToast(entry ? 'undo.done' : 'undo.nothing');
  };

  const switchProfile = async (id: string) => {
    await db.meta.put({ key: 'activeProfileId', value: id });
    await reload(id);
  };

  const createProfile: Store['createProfile'] = async (name, cats) => {
    const id = uid();
    const p: Profile = { id, name, createdAt: new Date().toISOString(), settings: { ...defaults } };
    await repo.createProfile(
      p,
      cats.map((c) => ({ ...c, id: uid(), profileId: id })),
    );
    await db.meta.put({ key: 'activeProfileId', value: id });
    await reload(id);
  };

  const loadSample = async () => {
    const id = uid();
    const s = buildSampleProfile(id, { ...defaults });
    // Tek işlem: "Geri al" örnek profili tamamen kaldırır.
    await repo.bulkInsert(id, 'history.loadSample', [
      { table: 'profiles', rows: [s.profile] },
      { table: 'categories', rows: s.categories },
      { table: 'projects', rows: s.projects },
      { table: 'routines', rows: s.routines },
    ]);
    await db.meta.put({ key: 'activeProfileId', value: id });
    setUndoScope('profile');
    await reload(id);
    showToast('settings.sampleLoaded', true);
  };

  const profile = profiles.find((p) => p.id === activeId) ?? null;

  return (
    <Ctx.Provider
      value={{
        ready, profiles, profile, data, toast, defaults, run, undo, switchProfile, createProfile, loadSample,
        reload: () => reload(),
        dismissToast: () => setToast(null),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
