// Randevu / etkinlik / tek seferlik görev ekleme akışı (tarif bölüm 7):
// form → (çakışma varsa) seçenekler → önizleme → onay → hatırlatma teklifi.
import { useMemo, useState } from 'react';
import { useT } from '../../i18n/i18n';
import { repo, useStore } from '../store';
import { uid } from '../../db/db';
import {
  findConflicts,
  freeStarts,
  suggestDays,
  type Placed,
  type Resolution,
  type Span,
} from '../../domain/conflicts';
import { addDays, clock, minutesOfDay, toDayNumber } from '../../domain/time';
import type { DatedTask, EventItem, ReminderTarget } from '../../domain/types';
import { formatClock, formatDayMonth, formatWeekdayShort } from '../format';
import { Sheet } from '../Sheet';
import type { AddInit } from './SheetHost';

type Step = 'form' | 'conflicts' | 'preview' | 'reminder';

interface Choice {
  res?: Resolution;
}

export function AddFlow({ init, onClose }: { init: AddInit; onClose: () => void }) {
  const { t } = useT();
  const { profile, data, run } = useStore();
  const s = profile!.settings;
  const editing = init.eventId ? data.events.find((e) => e.id === init.eventId) : undefined;
  const editingTask = init.taskId ? data.tasks.find((x) => x.id === init.taskId) : undefined;
  const isEdit = !!(editing || editingTask);

  // ---- Form durumu ----
  const [kind, setKind] = useState<'event' | 'task'>(editingTask ? 'task' : (init.kind ?? 'event'));
  const [title, setTitle] = useState(editing?.title ?? editingTask?.title ?? '');
  const [date, setDate] = useState(editing?.startDate ?? editingTask?.date ?? init.date);
  const [allDay, setAllDay] = useState(editing ? !editing.startTime : false);
  const [start, setStart] = useState(editing?.startTime ?? init.start ?? '09:00');
  const [end, setEnd] = useState(editing?.endTime ?? init.end ?? clock((minutesOfDay(init.start ?? '09:00') + 60) % 1440));
  const [multiDay, setMultiDay] = useState(
    !!editing &&
      toDayNumber(editing.endDate) - toDayNumber(editing.startDate) >
        (editing.startTime && editing.endTime && editing.endTime <= editing.startTime ? 1 : 0),
  );
  const [endDate, setEndDate] = useState(editing?.endDate ?? init.date);
  const [taskTime, setTaskTime] = useState(editingTask?.time ?? init.start ?? '');
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? editingTask?.categoryId ?? '');
  const [location, setLocation] = useState(editing?.location ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('form');
  const [conflicts, setConflicts] = useState<Placed[]>([]);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [saved, setSaved] = useState<ReminderTarget | null>(null);
  const [customMin, setCustomMin] = useState('10');
  const [showCustom, setShowCustom] = useState(false);

  // ---- Türetilen kayıt ----
  const timedEvent = kind === 'event' && !allDay;
  const evEndDate = allDay ? (multiDay ? endDate : date) : multiDay ? endDate : end <= start ? addDays(date, 1) : date;
  const span: Span | null = timedEvent
    ? { start: minutesOfDay(start), end: (toDayNumber(evEndDate) - toDayNumber(date)) * 1440 + minutesOfDay(end) }
    : null;

  const buildRow = (): { table: 'events'; row: EventItem } | { table: 'tasks'; row: DatedTask } =>
    kind === 'event'
      ? {
          table: 'events',
          row: {
            id: editing?.id ?? uid(),
            profileId: profile!.id,
            title: title.trim(),
            startDate: date,
            startTime: allDay ? undefined : start,
            endDate: evEndDate,
            endTime: allDay ? undefined : end,
            categoryId: categoryId || undefined,
            location: location.trim() || undefined,
            description: description.trim() || undefined,
            status: editing && editing.status !== 'cancelled' ? editing.status : 'planned',
            actualMin: editing?.actualMin,
          },
        }
      : {
          table: 'tasks',
          row: {
            id: editingTask?.id ?? uid(),
            profileId: profile!.id,
            title: title.trim(),
            date,
            time: taskTime || undefined,
            categoryId: categoryId || undefined,
            status: editingTask?.status ?? 'planned',
          },
        };

  const ignoreSelf = (i: { eventId?: string }) => !!editing && i.eventId === editing.id;

  const submitForm = () => {
    if (!title.trim()) return setError(t('add.needTitle'));
    if (span && span.end <= span.start) return setError(t('add.badRange'));
    if (kind === 'event' && allDay && multiDay && endDate < date) return setError(t('add.badRange'));
    setError(null);
    const found = span ? findConflicts(data, date, span, ignoreSelf) : [];
    if (found.length) {
      setConflicts(found);
      setChoices({});
      setStep('conflicts');
    } else save([]);
  };

  // ---- Çakışma önerileri ----
  /** Çakışan öğenin kendi günü ve o güne göre başlangıcı */
  const home = (p: Placed) => {
    const k = Math.floor(p.start / 1440);
    return { date: addDays(date, k), start: p.start - k * 1440, dur: p.end - p.start, off: k * 1440 };
  };

  const suggestions = useMemo(
    () =>
      conflicts.map((p, idx) => {
        const h = home(p);
        const extraBusy: Span[] = [];
        if (span) extraBusy.push({ start: span.start - h.off, end: span.end - h.off });
        conflicts.forEach((q, j) => {
          const r = choices[q.item.key]?.res;
          if (j !== idx && r?.action === 'move' && home(q).date === h.date)
            extraBusy.push({ start: minutesOfDay(r.startTime), end: minutesOfDay(r.startTime) + home(q).dur });
        });
        const ignore = (i: { key: string; eventId?: string }) => i.key === p.item.key || ignoreSelf(i);
        return {
          moves: freeStarts(data, h.date, h.dur, h.start, { extraBusy, ignore, max: 4 }).filter((m) => m !== h.start),
          days: suggestDays(data, h.date, h.dur, h.start, { ignore, max: 3 }),
        };
      }),
    [conflicts, choices, data, date, span?.start, span?.end], // eslint-disable-line
  );

  const allChosen = conflicts.every((p) => choices[p.item.key]?.res);
  const choose = (key: string, res: Resolution) => setChoices({ ...choices, [key]: { res } });

  const save = async (resolutions: { target: Placed; resolution: Resolution }[]) => {
    const item = buildRow();
    await run(isEdit ? 'add.updated' : 'add.saved', () =>
      repo.saveWithResolutions(
        profile!.id,
        item.table === 'events' ? 'history.saveEvent' : 'history.saveTask',
        item,
        resolutions.map((r) => ({ target: { ...r.target.item, date: home(r.target).date }, resolution: r.resolution })),
      ),
    );
    // Hatırlatma teklifi yalnızca yeni kayıtta (düzenlemede mevcutlar kendiliğinden güncellenir)
    if (!isEdit) {
      setSaved(item.table === 'events' ? { kind: 'event', eventId: item.row.id } : { kind: 'task', taskId: item.row.id });
      setStep('reminder');
    } else onClose();
  };

  const addReminder = async (offset: number) => {
    if (saved) await run('reminder.added', () => repo.addReminder(profile!.id, saved, offset), { undo: true });
    onClose();
  };

  const when = () => {
    const d = `${formatDayMonth(date, s)} ${formatWeekdayShort(date, s)}`;
    if (kind === 'task') return taskTime ? `${d} ${formatClock(taskTime, s)}` : d;
    if (allDay) return multiDay ? `${d} – ${formatDayMonth(endDate, s)}` : d;
    const endTxt = evEndDate !== date ? `${formatDayMonth(evEndDate, s)} ${formatClock(end, s)}` : formatClock(end, s);
    return `${d} ${formatClock(start, s)}–${endTxt}`;
  };

  const placedTime = (p: Placed) => {
    const h = home(p);
    return `${formatClock(clock(h.start), s)}–${formatClock(clock((h.start + h.dur) % 1440), s)}`;
  };

  const sheetTitle =
    step === 'conflicts' ? t('conflict.title') : step === 'preview' ? t('preview.title') : step === 'reminder' ? t('reminder.ask') : t(isEdit ? 'add.titleEdit' : 'add.titleNew');

  return (
    <Sheet title={sheetTitle} onClose={onClose}>
      {step === 'form' && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            submitForm();
          }}
        >
          {!isEdit && (
            <div className="seg-control" role="radiogroup">
              {(['event', 'task'] as const).map((k) => (
                <button type="button" key={k} role="radio" aria-checked={kind === k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>
                  {t(k === 'event' ? 'add.kindEvent' : 'add.kindTask')}
                </button>
              ))}
            </div>
          )}
          <label className="field">
            <span>{t('add.name')}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(kind === 'event' ? 'add.namePlaceholderEvent' : 'add.namePlaceholderTask')}
              autoFocus={!isEdit}
              enterKeyHint="done"
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span>{t('add.date')}</span>
              <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} required />
            </label>
            {kind === 'task' && (
              <label className="field">
                <span>{t('add.time')}</span>
                <input type="time" value={taskTime} onChange={(e) => setTaskTime(e.target.value)} />
              </label>
            )}
          </div>

          {kind === 'event' && (
            <>
              <label className="choice">
                <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
                {t('add.allDay')}
              </label>
              {!allDay && (
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
              )}
              {!allDay && !multiDay && end <= start && <p className="small muted">{t('add.nextDayNote', { time: formatClock(end, s) })}</p>}
              <label className="choice">
                <input
                  type="checkbox"
                  checked={multiDay}
                  onChange={(e) => {
                    setMultiDay(e.target.checked);
                    if (e.target.checked && endDate <= date) setEndDate(addDays(date, 1));
                  }}
                />
                {t('add.multiDay')}
              </label>
              {multiDay && (
                <label className="field">
                  <span>{t('add.endDate')}</span>
                  <input type="date" value={endDate} min={date} onChange={(e) => e.target.value && setEndDate(e.target.value)} />
                </label>
              )}
            </>
          )}

          <details className="details">
            <summary>{t('add.details')}</summary>
            <div className="stack">
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
              {kind === 'event' && (
                <>
                  <label className="field">
                    <span>{t('add.location')}</span>
                    <input value={location} onChange={(e) => setLocation(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>{t('add.description')}</span>
                    <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                  </label>
                </>
              )}
            </div>
          </details>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="row-btns">
            <button type="submit" className="btn primary">
              {t('common.save')}
            </button>
            <button type="button" className="btn ghost" onClick={onClose}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {step === 'conflicts' && (
        <div className="stack">
          <p>{t('conflict.intro')}</p>
          {conflicts.map((p, idx) => {
            const key = p.item.key;
            const res = choices[key]?.res;
            const sug = suggestions[idx];
            const isRoutine = p.item.kind === 'routine';
            return (
              <section key={key} className="card conflict">
                <p className="conflict-q">
                  <strong>{t('conflict.item', { title: p.item.title, time: placedTime(p) })}</strong>
                </p>
                {p.item.flex?.protected && <p className="small muted">{t('conflict.protected')}</p>}

                <div className={`opt${res?.action === 'move' ? ' selected' : ''}`}>
                  <span className="opt-label">{t('conflict.move')}</span>
                  {sug.moves.length ? (
                    <div className="chips">
                      {sug.moves.map((m) => {
                        const st = clock(m);
                        const on = res?.action === 'move' && res.startTime === st;
                        return (
                          <button key={m} className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => choose(key, { action: 'move', startTime: st })}>
                            {formatClock(st, s)}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="small muted">{t('conflict.moveNone')}</span>
                  )}
                </div>

                <div className={`opt${res?.action === 'postpone' ? ' selected' : ''}`}>
                  <span className="opt-label">{t('conflict.postpone')}</span>
                  {sug.days.length ? (
                    <div className="chips">
                      {sug.days.map((d) => {
                        const on = res?.action === 'postpone' && res.date === d.date && res.startTime === d.startTime;
                        return (
                          <button
                            key={d.date}
                            className={`chip${on ? ' on' : ''}`}
                            aria-pressed={on}
                            onClick={() => choose(key, { action: 'postpone', date: d.date, startTime: d.startTime })}
                          >
                            {formatWeekdayShort(d.date, s)} {formatDayMonth(d.date, s)} · {formatClock(d.startTime, s)}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="small muted">{t('conflict.postponeNone')}</span>
                  )}
                </div>

                <div className="chips">
                  <button className={`chip${res?.action === 'skip' ? ' on' : ''}`} aria-pressed={res?.action === 'skip'} onClick={() => choose(key, { action: 'skip' })}>
                    {t(isRoutine ? 'conflict.skip' : 'conflict.skipEvent')}
                  </button>
                  <button className={`chip${res?.action === 'keep' ? ' on' : ''}`} aria-pressed={res?.action === 'keep'} onClick={() => choose(key, { action: 'keep' })}>
                    {t('conflict.keep')}
                  </button>
                </div>
              </section>
            );
          })}
          {conflicts.some((p) => p.item.kind === 'routine') && <p className="small muted">{t('conflict.onlyThisDate')}</p>}
          {!allChosen && <p className="small muted">{t('conflict.chooseAll')}</p>}
          <div className="row-btns">
            <button className="btn primary" disabled={!allChosen} onClick={() => setStep('preview')}>
              {t('conflict.toPreview')}
            </button>
            <button className="btn ghost" onClick={() => setStep('form')}>
              {t('common.back')}
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="stack">
          <p className="muted">{t('preview.intro')}</p>
          <ul className="preview-list">
            <li className="pv-add">{t(isEdit ? 'preview.update' : 'preview.add', { title: title.trim(), when: when() })}</li>
            {conflicts.map((p) => {
              const r = choices[p.item.key]!.res!;
              const h = home(p);
              const txt =
                r.action === 'move'
                  ? t('preview.move', { title: p.item.title, from: formatClock(clock(h.start), s), to: formatClock(r.startTime, s) })
                  : r.action === 'postpone'
                    ? t('preview.postpone', {
                        title: p.item.title,
                        to: `${formatWeekdayShort(r.date, s)} ${formatDayMonth(r.date, s)} ${formatClock(r.startTime, s)}`,
                      })
                    : t(r.action === 'skip' ? 'preview.skip' : 'preview.keep', { title: p.item.title });
              return (
                <li key={p.item.key} className={`pv-${r.action}`}>
                  {txt}
                </li>
              );
            })}
          </ul>
          <div className="row-btns">
            <button className="btn primary" onClick={() => save(conflicts.map((p) => ({ target: p, resolution: choices[p.item.key]!.res! })))}>
              {t('preview.confirm')}
            </button>
            <button className="btn ghost" onClick={() => setStep('conflicts')}>
              {t('common.back')}
            </button>
          </div>
        </div>
      )}

      {step === 'reminder' && (
        <div className="stack">
          <div className="chips big">
            <button className="chip" onClick={onClose}>
              {t('reminder.no')}
            </button>
            <button className="chip" onClick={() => addReminder(0)}>
              {t('reminder.onTime')}
            </button>
            {[15, 30].map((m) => (
              <button key={m} className="chip" onClick={() => addReminder(m)}>
                {t('reminder.before', { min: m })}
              </button>
            ))}
            {kind === 'task' && (
              <button className="chip" onClick={() => addReminder(1440)}>
                {t('reminder.dayBefore')}
              </button>
            )}
            <button className={`chip${showCustom ? ' on' : ''}`} onClick={() => setShowCustom(!showCustom)}>
              {t('reminder.custom')}
            </button>
          </div>
          {showCustom && (
            <div className="field-row align-end">
              <label className="field">
                <span>{t('reminder.customLabel')}</span>
                <input type="number" inputMode="numeric" min={0} max={10080} value={customMin} onChange={(e) => setCustomMin(e.target.value)} />
              </label>
              <button className="btn primary" onClick={() => addReminder(Math.max(0, Math.min(10080, Number(customMin) || 0)))}>
                {t('common.add')}
              </button>
            </div>
          )}
          <p className="small muted">{t('reminder.note')}</p>
        </div>
      )}
    </Sheet>
  );
}
