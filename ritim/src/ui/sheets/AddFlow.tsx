// Randevu / etkinlik / tek seferlik görev ekleme akışı (tarif bölüm 7):
// form → (çakışma varsa) seçenekler → önizleme → onay → hatırlatma teklifi.
import { useState } from 'react';
import { useT } from '../../i18n/i18n';
import { repo, useStore } from '../store';
import { uid } from '../../db/db';
import { findConflicts, type Placed, type Span } from '../../domain/conflicts';
import { ConflictChoices, ResolutionLines, toResolutions, type Choices } from './ConflictParts';
import { RoutineForm } from './RoutineForm';
import { PermissionAsk, ReminderPicker } from '../alarm/ReminderPicker';
import { addDays, clock, minutesOfDay, toDayNumber } from '../../domain/time';
import type { DatedTask, EventItem, ReminderTarget } from '../../domain/types';
import { formatClock, formatDayMonth, formatWeekdayShort } from '../format';
import { Sheet } from '../Sheet';
import type { AddInit } from './SheetHost';

type Step = 'form' | 'conflicts' | 'preview' | 'reminder';

export function AddFlow({ init, onClose }: { init: AddInit; onClose: () => void }) {
  const { t } = useT();
  const { profile, data, run } = useStore();
  const s = profile!.settings;
  const editing = init.eventId ? data.events.find((e) => e.id === init.eventId) : undefined;
  const editingTask = init.taskId ? data.tasks.find((x) => x.id === init.taskId) : undefined;
  const isEdit = !!(editing || editingTask);

  // ---- Form durumu ----
  const [kind, setKind] = useState<'event' | 'task' | 'routine'>(editingTask ? 'task' : (init.kind ?? 'event'));
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
  const [choices, setChoices] = useState<Choices>({});
  const [saved, setSaved] = useState<ReminderTarget | null>(null);

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

  const allChosen = conflicts.every((p) => choices[p.item.key]);

  const save = async (resolutions: ReturnType<typeof toResolutions>) => {
    const item = buildRow();
    await run(isEdit ? 'add.updated' : 'add.saved', () =>
      repo.saveWithResolutions(
        profile!.id,
        item.table === 'events' ? 'history.saveEvent' : 'history.saveTask',
        item,
        resolutions,
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

  const sheetTitle =
    step === 'conflicts' ? t('conflict.title') : step === 'preview' ? t('preview.title') : step === 'reminder' ? t('reminder.ask') : t(isEdit ? 'add.titleEdit' : 'add.titleNew');

  return (
    <Sheet title={sheetTitle} onClose={onClose}>
      {step === 'form' && kind === 'routine' && (
        <>
          <div className="seg-control three" role="radiogroup">
            {(['event', 'task', 'routine'] as const).map((k) => (
              <button type="button" key={k} role="radio" aria-checked={kind === k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>
                {t(k === 'event' ? 'add.kindEvent' : k === 'task' ? 'add.kindTask' : 'add.kindRoutine')}
              </button>
            ))}
          </div>
          <RoutineForm init={{ date, start, end }} onDone={onClose} />
        </>
      )}
      {step === 'form' && kind !== 'routine' && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            submitForm();
          }}
        >
          {!isEdit && (
            <div className="seg-control three" role="radiogroup">
              {(['event', 'task', 'routine'] as const).map((k) => (
                <button type="button" key={k} role="radio" aria-checked={kind === k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>
                  {t(k === 'event' ? 'add.kindEvent' : k === 'task' ? 'add.kindTask' : 'add.kindRoutine')}
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
          <ConflictChoices conflicts={conflicts} baseDate={date} primary={span} choices={choices} setChoices={setChoices} ignore={ignoreSelf} />
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
            <ResolutionLines conflicts={conflicts} choices={choices} baseDate={date} />
          </ul>
          <div className="row-btns">
            <button className="btn primary" onClick={() => save(toResolutions(conflicts, choices, date))}>
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
          <ReminderPicker noLabel onNo={onClose} dayBefore={kind === 'task'} onPick={addReminder} />
          <PermissionAsk />
          <p className="small muted">{t('reminder.note')}</p>
        </div>
      )}
    </Sheet>
  );
}
