// "Kaldığım yer" notları (tarif bölüm 10): kategoriye değil çalışmaya/projeye
// bağlıdır; aynı kategorideki farklı çalışmaların notları karışmaz.
import type { ProgressNote } from './types';

/** Bir çalışmanın notları, en yeniden eskiye. */
export const notesFor = (notes: ProgressNote[], projectId: string) =>
  notes.filter((n) => n.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** Sonraki oturumda gösterilecek en son not. */
export const latestNote = (notes: ProgressNote[], projectId?: string) => (projectId ? notesFor(notes, projectId)[0] : undefined);
