// Rutin blok oluşturma/düzenleme ("düzenleme modunda satır ekleme/silme,
// metin, kategori"). Kişiden bağımsız: herkes kendi düzenini kurar.
import { useState } from 'react';
import { useT } from '../../i18n/i18n';
import { repo, useStore } from '../store';
import { uid } from '../../db/db';
import { addDays, clock, minutesOfDay, nowLocal } from '../../domain/time';
import type { Flexibility, Priority, Routine, ShortVersion, Weekday } from '../../domain/types';
import { formatClock, weekdayName } from '../format';
import { Icon } from '../Icon';

type Repeat = 'daily' | 'days' | 'biweekly';

export function RoutineForm({
  init,
  routine,
  onDone,
}: {
  init?: { date: string; start?: string; end?: string };
  routine?: Routine;
  onDone: () => void;
}) {
  const { t } = useT();
  const { profile, data, run } = useStore();
  const s = profile!.settings;
  const today = nowLocal(s.timeZone).date;
  const r = routine;

  const [title, setTitle] = useState(r?.title ?? '');
  const [categoryId, setCategoryId] = useState(r?.categoryId ?? '');
  const [start, setStart] = useState(r?.startTime ?? init?.start ?? '09:00');
  const [end, setEnd] = useState(
    r ? clock((minutesOfDay(r.startTime) + r.durationMin) % 1440) : (init?.end ?? clock((minutesOfDay(init?.start ?? '09:00') + 60) % 1440)),
  );
  const initialDays = r?.recurrence.byWeekday ?? [];
  const [repeat, setRepeat] = useState<Repeat>(
    !r ? 'days' : r.recurrence.freq === 'daily' ? 'daily' : r.recurrence.interval === 2 ? 'biweekly' : 'days',
  );
  const [days, setDays] = useState<Weekday[]>(initialDays.length ? initialDays : [1, 2, 3, 4, 5]);
  const [startDate, setStartDate] = useState(r?.recurrence.startDate ?? init?.date ?? today);
  const [hasEnd, setHasEnd] = useState(!!r?.recurrence.endDate);
  const [endDate, setEndDate] = useState(r?.recurrence.endDate ?? addDays(init?.date ?? today, 90));
  const [projectId, setProjectId] = useState(r?.projectId ?? '');
  const [newProject, setNewProject] = useState('');
  const [flex, setFlex] = useState<Flexibility>(
    r?.flex ?? { timing: 'flexible', priority: 'medium', shortenable: false, movable: true, protected: false },
  );
  const [shorts, setShorts] = useState<ShortVersion[]>(r?.shortVersions ?? []);
  const [error, setError] = useState<string | null>(null);

  const order = Array.from({ length: 7 }, (_, i) => ((((s.weekStart - 1 + i) % 7) + 1) as Weekday));
  const duration = ((minutesOfDay(end) - minutesOfDay(start) + 1440) % 1440) || 1440;

  const save = async () => {
    if (!title.trim()) return setError(t('add.needTitle'));
    if (repeat !== 'daily' && !days.length) return setError(t('routine.needDays'));
    if (hasEnd && endDate < startDate) return setError(t('add.badRange'));
    setError(null);
    let pid = projectId || undefined;
    const projectRow = projectId === '__new' && newProject.trim()
      ? { id: uid(), profileId: profile!.id, name: newProject.trim(), categoryId: categoryId || undefined }
      : undefined;
    if (projectId === '__new') pid = projectRow?.id;
    const next: Routine = {
      id: r?.id ?? uid(),
      profileId: profile!.id,
      title: title.trim(),
      categoryId: categoryId || undefined,
      projectId: pid,
      startTime: start,
      durationMin: duration,
      recurrence: {
        freq: repeat === 'daily' ? 'daily' : 'weekly',
        interval: repeat === 'biweekly' ? 2 : 1,
        ...(repeat !== 'daily' ? { byWeekday: [...days].sort() } : {}),
        startDate,
        ...(hasEnd ? { endDate } : {}),
      },
      flex,
      shortVersions: shorts.filter((x) => x.title.trim() && x.durationMin > 0),
      description: r?.description,
    };
    if (projectRow) await repo.putProject(projectRow);
    if (r) await run('routine.updated', () => repo.updateRoutine(r, next, today));
    else await run('routine.created', () => repo.putRoutine(next));
    onDone();
  };

  const removeFuture = async () => {
    if (!r || !confirm(t('routine.endConfirm', { title: r.title }))) return;
    await run('routine.ended', () => repo.endRoutineFrom(r, today));
    onDone();
  };
  const removeAll = async () => {
    if (!r || !confirm(t('item.deleteConfirm', { title: r.title }))) return;
    await run('item.deleted', () => repo.deleteRoutine(r));
    onDone();
  };

  const toggleDay = (w: Weekday) => setDays(days.includes(w) ? days.filter((x) => x !== w) : [...days, w]);
  const setF = <K extends keyof Flexibility>(k: K, v: Flexibility[K]) => setFlex({ ...flex, [k]: v });

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="field">
        <span>{t('add.name')}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('routine.namePlaceholder')} autoFocus={!r} />
      </label>
      <div className="field-row">
        <label className="field">
          <span>{t('add.start')}</span>
          <input type="time" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} required />
        </label>
        <label className="field">
          <span>{t('add.end')}</span>
          <input type="time" value={end} onChange={(e) => e.target.value && setEnd(e.target.value)} required />
        </label>
      </div>
      {end <= start && <p className="small muted">{t('add.nextDayNote', { time: formatClock(end, s) })}</p>}

      <fieldset className="field">
        <legend>{t('routine.repeat')}</legend>
        <div className="seg-control three">
          {(['daily', 'days', 'biweekly'] as const).map((k) => (
            <button type="button" key={k} className={repeat === k ? 'active' : ''} aria-pressed={repeat === k} onClick={() => setRepeat(k)}>
              {t(`routine.repeat.${k}`)}
            </button>
          ))}
        </div>
        {repeat !== 'daily' && (
          <div className="chips days">
            {order.map((w) => (
              <button
                type="button"
                key={w}
                className={`chip${days.includes(w) ? ' on' : ''}`}
                aria-pressed={days.includes(w)}
                aria-label={weekdayName(w, s)}
                onClick={() => toggleDay(w)}
              >
                {weekdayName(w, s).slice(0, 3)}
              </button>
            ))}
          </div>
        )}
      </fieldset>

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

      <details className="details">
        <summary>{t('add.details')}</summary>
        <div className="stack">
          <div className="field-row">
            <label className="field">
              <span>{t('routine.startDate')}</span>
              <input type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} />
            </label>
            {hasEnd && (
              <label className="field">
                <span>{t('add.endDate')}</span>
                <input type="date" value={endDate} min={startDate} onChange={(e) => e.target.value && setEndDate(e.target.value)} />
              </label>
            )}
          </div>
          <label className="choice">
            <input type="checkbox" checked={hasEnd} onChange={(e) => setHasEnd(e.target.checked)} />
            {t('routine.hasEnd')}
          </label>

          <label className="field">
            <span>{t('routine.project')}</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">{t('routine.noProject')}</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              <option value="__new">{t('routine.newProject')}</option>
            </select>
            <span className="small muted">{t('routine.projectHint')}</span>
          </label>
          {projectId === '__new' && (
            <label className="field">
              <span>{t('routine.newProjectName')}</span>
              <input value={newProject} onChange={(e) => setNewProject(e.target.value)} />
            </label>
          )}

          <fieldset className="field">
            <legend>{t('routine.timing')}</legend>
            <div className="seg-control">
              {(['fixed', 'flexible'] as const).map((k) => (
                <button type="button" key={k} className={flex.timing === k ? 'active' : ''} aria-pressed={flex.timing === k} onClick={() => setF('timing', k)}>
                  {t(k === 'fixed' ? 'day.fixed' : 'day.flexible')}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="field">
            <legend>{t('routine.priority')}</legend>
            <div className="seg-control three">
              {(['low', 'medium', 'high'] as Priority[]).map((k) => (
                <button type="button" key={k} className={flex.priority === k ? 'active' : ''} aria-pressed={flex.priority === k} onClick={() => setF('priority', k)}>
                  {t(`routine.priority.${k}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="choice">
            <input type="checkbox" checked={flex.shortenable} onChange={(e) => setF('shortenable', e.target.checked)} />
            {t('routine.shortenable')}
          </label>
          <label className="choice">
            <input type="checkbox" checked={flex.movable} onChange={(e) => setF('movable', e.target.checked)} />
            {t('routine.movable')}
          </label>
          <label className="choice">
            <input type="checkbox" checked={flex.protected} onChange={(e) => setF('protected', e.target.checked)} />
            <span>
              {t('routine.protected')}
              <br />
              <span className="small muted">{t('routine.protectedHint')}</span>
            </span>
          </label>

          <fieldset className="field">
            <legend>{t('item.shortVersions')}</legend>
            <span className="small muted">{t('routine.shortHint')}</span>
            {shorts.map((v, i) => (
              <div key={v.id} className="short-row">
                <input
                  value={v.title}
                  aria-label={t('add.name')}
                  placeholder={t('routine.shortPlaceholder')}
                  onChange={(e) => setShorts(shorts.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  aria-label={t('routine.minutes')}
                  value={v.durationMin}
                  onChange={(e) => setShorts(shorts.map((x, j) => (j === i ? { ...x, durationMin: Number(e.target.value) } : x)))}
                />
                <button type="button" className="icon-btn" aria-label={t('common.delete')} onClick={() => setShorts(shorts.filter((_, j) => j !== i))}>
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn ghost small-btn"
              onClick={() => setShorts([...shorts, { id: uid(), title: '', durationMin: shorts.length ? 5 : 15 }])}
            >
              <Icon name="plus" size={16} /> {t('routine.addShort')}
            </button>
          </fieldset>
        </div>
      </details>

      {r && <p className="small muted">{t('routine.editNote')}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row-btns">
        <button type="submit" className="btn primary">
          {t('common.save')}
        </button>
        <button type="button" className="btn ghost" onClick={onDone}>
          {t('common.cancel')}
        </button>
      </div>
      {r && (
        <div className="row-btns">
          <button type="button" className="btn ghost danger" onClick={removeFuture}>
            {t('routine.endFuture')}
          </button>
          <button type="button" className="btn ghost danger" onClick={removeAll}>
            <Icon name="trash" size={18} /> {t('routine.deleteAll')}
          </button>
        </div>
      )}
    </form>
  );
}
