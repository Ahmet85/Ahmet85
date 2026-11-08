// "Kaldığım yer" notu ekleme ve çalışmanın not geçmişi.
import { useState } from 'react';
import { useT } from '../../i18n/i18n';
import { repo, useStore } from '../store';
import { uid } from '../../db/db';
import { latestNote, notesFor } from '../../domain/notes';
import { formatDayMonth, formatWeekdayShort } from '../format';
import { Icon } from '../Icon';
import { Sheet } from '../Sheet';

export interface NoteInit {
  projectId: string;
  routineId?: string;
  originalDate?: string;
  /** Tamamlama sonrası mı açıldı (başlık ve dil buna göre) */
  afterDone?: boolean;
}

const localDate = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

export function NoteSheet({ init, onClose }: { init: NoteInit; onClose: () => void }) {
  const { t } = useT();
  const { profile, data, run } = useStore();
  const [text, setText] = useState('');
  const project = data.projects.find((p) => p.id === init.projectId);
  const prev = latestNote(data.notes, init.projectId);
  const s = profile!.settings;

  const save = async () => {
    if (!text.trim()) return onClose();
    await run('note.saved', () =>
      repo.addNote({
        id: uid(),
        profileId: profile!.id,
        projectId: init.projectId,
        createdAt: new Date().toISOString(),
        text: text.trim(),
        routineId: init.routineId,
        originalDate: init.originalDate,
      }),
    );
    onClose();
  };

  return (
    <Sheet title={t('note.title')} onClose={onClose}>
      <div className="stack">
        {init.afterDone && <p className="hand mid">{t('note.afterDone')}</p>}
        <p className="muted">{t('note.ask', { project: project?.name ?? '' })}</p>
        {prev && (
          <div className="left-off quiet">
            <span className="small muted">
              {t('note.previous', {
                date: `${formatWeekdayShort(localDate(prev.createdAt, s.timeZone), s)} ${formatDayMonth(localDate(prev.createdAt, s.timeZone), s)}`,
              })}
            </span>
            <p className="hand mid">{prev.text}</p>
          </div>
        )}
        <label className="field">
          <span className="sr-only">{t('note.title')}</span>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('note.placeholder')} autoFocus maxLength={500} />
        </label>
        <div className="row-btns">
          <button className="btn primary" disabled={!text.trim()} onClick={save}>
            {t('common.save')}
          </button>
          <button className="btn ghost" onClick={onClose}>
            {t('note.notNow')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export function ProjectSheet({ projectId, onClose, onAddNote }: { projectId: string; onClose: () => void; onAddNote: () => void }) {
  const { t } = useT();
  const { profile, data, run } = useStore();
  const s = profile!.settings;
  const project = data.projects.find((p) => p.id === projectId);
  const [name, setName] = useState(project?.name ?? '');
  const [categoryId, setCategoryId] = useState(project?.categoryId ?? '');
  if (!project) return null;
  const notes = notesFor(data.notes, projectId);
  const blocks = data.routines.filter((r) => r.projectId === projectId);
  const dirty = name.trim() !== project.name || (categoryId || undefined) !== project.categoryId;

  return (
    <Sheet title={project.name} onClose={onClose}>
      <div className="stack">
        <div className="field-row align-end">
          <label className="field">
            <span>{t('project.name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('add.category')}</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{t('add.noCategory')}</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {dirty && name.trim() && (
          <button
            className="btn"
            onClick={() => run('history.saveProject', () => repo.putProject({ ...project, name: name.trim(), categoryId: categoryId || undefined }))}
          >
            {t('common.save')}
          </button>
        )}
        {blocks.length > 0 && (
          <p className="small muted">
            {t('project.blocks')}: {blocks.map((b) => b.title).join(', ')}
          </p>
        )}

        <div className="card-head">
          <h3>{t('note.history')}</h3>
          <button className="btn small-btn" onClick={onAddNote}>
            <Icon name="plus" size={16} /> {t('note.add')}
          </button>
        </div>
        {notes.length === 0 ? (
          <p className="muted small">{t('note.none')}</p>
        ) : (
          <ol className="note-list">
            {notes.map((n, i) => {
              const d = localDate(n.createdAt, s.timeZone);
              return (
                <li key={n.id} className={i === 0 ? 'latest' : ''}>
                  <span className="small muted">
                    {formatWeekdayShort(d, s)} {formatDayMonth(d, s)}
                    {i === 0 && ` · ${t('note.latest')}`}
                  </span>
                  <p className="hand mid">{n.text}</p>
                  <button className="icon-btn" aria-label={t('note.delete')} onClick={() => run('note.deleted', () => repo.deleteNote(n))}>
                    <Icon name="trash" size={16} />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Sheet>
  );
}
