// Program paketi: bir haftalık düzeni (kategoriler, çalışmalar, rutin bloklar)
// taşınabilir hâle getirir. Bağlantının "#import=" kısmında sıkıştırılmış
// olarak taşınır; bu kısım sunucuya hiç gönderilmez ve kodda saklanmaz.
// Paket içe aktarılınca YENİ bir profil olarak eklenir; mevcut veriye dokunulmaz.
import type { CategoryColor, Flexibility, Profile, ProfileSettings, Project, Category, Routine, ShortVersion, Weekday } from './types';

export interface PackageRoutine {
  title: string;
  category?: string; // paket içi kategori anahtarı
  project?: string; // paket içi çalışma anahtarı
  start: string; // "HH:MM"
  durationMin: number;
  days: Weekday[];
  flex: Flexibility;
  short?: { title: string; durationMin: number }[];
}

export interface ProgramPackage {
  app: 'ritim';
  kind: 'program';
  version: 1;
  name: string;
  categories: { key: string; name: string; color: CategoryColor; icon: string }[];
  projects: { key: string; name: string; category?: string }[];
  routines: PackageRoutine[];
}

export class PackageError extends Error {}

export function validatePackage(raw: unknown): ProgramPackage {
  const p = raw as Partial<ProgramPackage> | null;
  if (!p || p.app !== 'ritim' || p.kind !== 'program' || p.version !== 1) throw new PackageError('invalid');
  if (!Array.isArray(p.routines) || !Array.isArray(p.categories) || !Array.isArray(p.projects)) throw new PackageError('invalid');
  for (const r of p.routines) {
    if (!r || typeof r.title !== 'string' || !/^\d{2}:\d{2}$/.test(r.start) || !(r.durationMin > 0 && r.durationMin <= 1440))
      throw new PackageError('invalid');
    if (!Array.isArray(r.days) || !r.days.length || r.days.some((d) => !(d >= 1 && d <= 7))) throw new PackageError('invalid');
  }
  return p as ProgramPackage;
}

/** Paketi yeni kimliklerle veritabanı satırlarına çevirir. */
export function materialize(
  pkg: ProgramPackage,
  o: { profileId: string; uid: () => string; settings: ProfileSettings; startDate: string; now?: Date },
) {
  const profile: Profile = { id: o.profileId, name: pkg.name, createdAt: (o.now ?? new Date()).toISOString(), settings: o.settings };
  const catId = new Map<string, string>();
  const categories: Category[] = pkg.categories.map((c, i) => {
    const id = o.uid();
    catId.set(c.key, id);
    return { id, profileId: o.profileId, name: c.name, color: c.color, icon: c.icon, order: i };
  });
  const projId = new Map<string, string>();
  const projects: Project[] = pkg.projects.map((p) => {
    const id = o.uid();
    projId.set(p.key, id);
    return { id, profileId: o.profileId, name: p.name, categoryId: p.category ? catId.get(p.category) : undefined };
  });
  const routines: Routine[] = pkg.routines.map((r) => ({
    id: o.uid(),
    profileId: o.profileId,
    title: r.title,
    categoryId: r.category ? catId.get(r.category) : undefined,
    projectId: r.project ? projId.get(r.project) : undefined,
    startTime: r.start,
    durationMin: r.durationMin,
    recurrence: { freq: 'weekly', interval: 1, byWeekday: [...r.days].sort(), startDate: o.startDate },
    flex: r.flex,
    shortVersions: (r.short ?? []).map((s): ShortVersion => ({ id: o.uid(), title: s.title, durationMin: s.durationMin })),
  }));
  return { profile, categories, projects, routines };
}

// ---- Bağlantı kodlama (gzip + base64url) ----
const toB64Url = (bytes: Uint8Array) => {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64Url = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodePackage(pkg: ProgramPackage): Promise<string> {
  return toB64Url(await pipe(new TextEncoder().encode(JSON.stringify(pkg)), new CompressionStream('gzip')));
}

export async function decodePackage(code: string): Promise<ProgramPackage> {
  try {
    const json = new TextDecoder().decode(await pipe(fromB64Url(code.trim()), new DecompressionStream('gzip')));
    return validatePackage(JSON.parse(json));
  } catch (e) {
    throw e instanceof PackageError ? e : new PackageError('invalid');
  }
}

/** Bir bağlantı ya da yapıştırılan metinden paket kodunu çıkarır. */
export const codeFromLink = (text: string) => text.match(/#import=([A-Za-z0-9_-]+)/)?.[1] ?? (/^[A-Za-z0-9_-]{20,}$/.test(text.trim()) ? text.trim() : null);
