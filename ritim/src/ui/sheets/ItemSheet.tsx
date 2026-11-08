// Bir öğeye dokununca açılan ayrıntı penceresi.
import { useT } from '../../i18n/i18n';
import { repo, useStore } from '../store';
import { isDone, type AgendaItem } from '../../domain/agenda';
import { clock } from '../../domain/time';
import type { ReminderTarget } from '../../domain/types';
import { formatClock, formatDayMonth, formatWeekdayShort } from '../format';
import { useCategories } from '../hooks';
import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { useSetStatus } from '../views/DayView';
import { useSheets } from './SheetHost';
import { latestNote } from '../../domain/notes';

export function ItemSheet({ item: initial, onClose }: { item: AgendaItem; onClose: () => void }) {
  const { t } = useT();
  const { profile, data, run } = useStore();
  const cats = useCategories();
  const sheets = useSheets();
  const setStatus = useSetStatus();
  const s = profile!.settings;

  // Güncel veriyle göster (durum değişince pencere de güncellenir)
  const event = initial.eventId ? data.events.find((e) => e.id === initial.eventId) : undefined;
  const task = initial.taskId ? data.tasks.find((x) => x.id === initial.taskId) : undefined;
  const record = initial.routineId
    ? data.records.find((r) => r.routineId === initial.routineId && r.originalDate === initial.originalDate)
    : undefined;
  const status = event?.status ?? task?.status ?? record?.status ?? initial.status;
  const item = { ...initial, status };
  const routine = item.routineId ? data.routines.find((r) => r.id === item.routineId) : undefined;
  const project = item.projectId ? data.projects.find((p) => p.id === item.projectId) : undefined;
  const c = item.categoryId ? cats.get(item.categoryId) : undefined;
  const lastNote = latestNote(data.notes, project?.id);

  const target: ReminderTarget | null = event ? { kind: 'event', eventId: event.id } : task ? { kind: 'task', taskId: task.id } : null;
  const reminders = target
    ? data.reminders.filter((r) =>
        target.kind === 'event'
          ? r.target.kind === 'event' && r.target.eventId === target.eventId
          : r.target.kind === 'task' && target.kind === 'task' && r.target.taskId === target.taskId,
      )
    : [];

  const startDate = event?.startDate ?? task?.date ?? item.date;
  const whenParts = [`${formatWeekdayShort(startDate, s)} ${formatDayMonth(startDate, s)}`];
  if (item.timed) {
    const start = item.continues ? undefined : item.startTime;
    if (start) whenParts.push(formatClock(start, s) + (item.endTime && item.kind !== 'task' ? `–${formatClock(item.endTime, s)}` : ''));
  } else if (item.kind === 'event') whenParts.push(t('day.allDay'));
  if (event && event.endDate !== event.startDate) whenParts.push(`→ ${formatDayMonth(event.endDate, s)}`);

  const remove = async () => {
    if (!confirm(t('item.deleteConfirm', { title: item.title }))) return;
    if (event) await run('item.deleted', () => repo.deleteEvent(event));
    if (task) await run('item.deleted', () => repo.deleteTask(task));
    onClose();
  };

  return (
    <Sheet title={item.title} onClose={onClose}>
      <div className="stack">
        <p className="item-when">
          {c && (
            <span className="cat-chip" style={{ background: c.color.bg, color: c.color.fg }}>
              <Icon name={c.icon} size={16} /> {c.name}
            </span>
          )}
          <span>{whenParts.join(' · ')}</span>
        </p>
        {status !== 'planned' && <p className="tag status">{t(`status.${status}`)}</p>}
        {routine && (
          <p className="small muted">
            {t(routine.flex.protected ? 'day.protected' : routine.flex.timing === 'fixed' ? 'day.fixed' : 'day.flexible')}
          </p>
        )}
        {project && (
          <section className="project-box">
            <div className="card-head">
              <span>
                <span className="muted small">{t('item.project')}: </span>
                <strong>{project.name}</strong>
              </span>
              <button className="btn ghost small-btn" onClick={() => sheets.openProject(project.id)}>
                {t('note.allNotes')}
              </button>
            </div>
            {lastNote ? (
              <div className="left-off quiet">
                <span className="small muted">{t('day.leftOff')}</span>
                <p className="hand mid">{lastNote.text}</p>
              </div>
            ) : (
              <p className="small muted">{t('note.none')}</p>
            )}
            <button
              className="btn small-btn"
              onClick={() => sheets.openNote({ projectId: project.id, routineId: item.routineId, originalDate: item.originalDate })}
            >
              <Icon name="plus" size={16} /> {t('note.add')}
            </button>
          </section>
        )}
        {routine && routine.shortVersions.length > 0 && (
          <div>
            <span className="muted small">{t('item.shortVersions')}</span>
            <ul className="goals">
              {routine.shortVersions.map((v) => (
                <li key={v.id}>{v.title}</li>
              ))}
            </ul>
          </div>
        )}
        {event?.location && (
          <p>
            <Icon name="pin" size={16} /> {event.location}
          </p>
        )}
        {event?.description && <p className="muted">{event.description}</p>}

        {target && (
          <section>
            <h3>{t('reminder.list')}</h3>
            {reminders.length === 0 ? (
              <p className="small muted">{t('reminder.none')}</p>
            ) : (
              <ul className="rem-list">
                {reminders.map((r) => (
                  <li key={r.id}>
                    <span>{t('reminder.offset', { offset: r.offsetMin })}</span>
                    <button className="icon-btn" aria-label={t('reminder.remove')} onClick={() => run('history.removeReminder', () => repo.removeReminder(r))}>
                      <Icon name="close" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="chips">
              {[0, 15, 30, ...(task ? [1440] : [])]
                .filter((m) => !reminders.some((r) => r.offsetMin === m))
                .map((m) => (
                  <button key={m} className="chip" onClick={() => run('reminder.added', () => repo.addReminder(profile!.id, target, m))}>
                    <Icon name="plus" size={14} /> {t('reminder.offset', { offset: m })}
                  </button>
                ))}
            </div>
          </section>
        )}

        <div className="row-btns">
          {item.kind !== 'task' &&
            (isDone(status) || status === 'skipped' ? (
              <button className="btn" onClick={() => setStatus(item, 'planned', 'item.statusChanged')}>
                {t('item.markPlanned')}
              </button>
            ) : (
              status !== 'cancelled' && (
                <>
                  <button className="btn" onClick={() => setStatus(item, 'done', 'day.doneToast')}>
                    {t('item.markDone')}
                  </button>
                  <button className="btn ghost" onClick={() => setStatus(item, 'skipped', 'day.skipToast')}>
                    {t('item.markSkipped')}
                  </button>
                </>
              )
            ))}
        </div>

        <div className="row-btns">
          {item.kind === 'routine' && item.timed && !item.continues && (
            <button
              className="btn primary"
              onClick={() =>
                sheets.openAdd({
                  date: item.date,
                  start: item.startTime,
                  end: clock(Math.min(item.endMin, item.startMin + 60) % 1440),
                })
              }
            >
              <Icon name="plus" size={18} /> {t('item.addHere')}
            </button>
          )}
          {status !== 'cancelled' && (
            <button className="btn" onClick={() => sheets.openMove(item)}>
              <Icon name="clock" size={18} /> {t('move.title')}
            </button>
          )}
          {routine && (
            <button className="btn" onClick={() => sheets.openRoutine(routine.id)}>
              <Icon name="edit" size={18} /> {t('routine.editTitle')}
            </button>
          )}
          {(event || task) && (
            <button className="btn" onClick={() => sheets.openAdd({ date: startDate, eventId: event?.id, taskId: task?.id })}>
              <Icon name="edit" size={18} /> {t('common.edit')}
            </button>
          )}
          {sheets.goDay && (
            <button
              className="btn ghost"
              onClick={() => {
                sheets.goDay!(item.date);
                onClose();
              }}
            >
              {t('item.goDay')}
            </button>
          )}
        </div>

        {(event || task) && (
          <div className="row-btns">
            {event && status !== 'cancelled' && (
              <button className="btn ghost danger" onClick={() => run('item.cancelled', () => repo.cancelEvent(event))}>
                {t('item.cancelEvent')}
              </button>
            )}
            <button className="btn ghost danger" onClick={remove}>
              <Icon name="trash" size={18} /> {t('common.delete')}
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
