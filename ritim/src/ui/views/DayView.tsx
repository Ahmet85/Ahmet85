import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n/i18n';
import { repo, useStore } from '../store';
import { buildDay, isDone, nowAndNext, type AgendaItem } from '../../domain/agenda';
import { monthKey } from '../../domain/time';
import type { Category, PlainDateStr, ProfileSettings, ShortVersion, Status } from '../../domain/types';
import { formatClock } from '../format';
import { useCategories, useNow } from '../hooks';
import { Icon } from '../Icon';
import { useSheets } from '../sheets/SheetHost';

export function useDuration() {
  const { t } = useT();
  return (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h && m ? t('day.hm', { h, m }) : h ? t('day.h', { h }) : t('day.m', { m });
  };
}

export const catStyle = (c?: Category) =>
  (c ? { '--cat-bg': c.color.bg, '--cat-fg': c.color.fg, '--cat-accent': c.color.accent } : {}) as React.CSSProperties;

/** Öğenin durumunu değiştir (rutin: yalnızca o tarih; şablon bozulmaz). */
export function useSetStatus() {
  const { profile, data, run } = useStore();
  return (item: AgendaItem, status: Status, toastKey: string, sv?: ShortVersion) => {
    const pid = profile!.id;
    if (item.kind === 'routine') {
      const dur = item.endMin - item.startMin;
      return run(toastKey, () =>
        repo.patchOccurrence(pid, item.routineId!, item.originalDate!, {
          status,
          shortVersionId: sv?.id,
          actualMin: status === 'done' ? dur : sv ? sv.durationMin : undefined,
        }),
      );
    }
    if (item.kind === 'event') {
      const e = data.events.find((x) => x.id === item.eventId)!;
      return run(toastKey, () => repo.putEvent({ ...e, status }));
    }
    const k = data.tasks.find((x) => x.id === item.taskId)!;
    return run(toastKey, () => repo.putTask({ ...k, status }));
  };
}

function timeLabel(i: AgendaItem, s: ProfileSettings, t: (k: string) => string) {
  if (!i.timed) return t('day.allDay');
  if (i.continues) return t('day.continues');
  return formatClock(i.startTime!, s);
}

function Badges({ item }: { item: AgendaItem }) {
  const { t } = useT();
  const tags: string[] = [];
  if (item.kind === 'event') tags.push('day.appointment');
  else if (item.flex?.protected) tags.push('day.protected');
  else if (item.flex) tags.push(item.flex.timing === 'fixed' ? 'day.fixed' : 'day.flexible');
  return (
    <>
      {tags.map((b) => (
        <span key={b} className="tag">
          {b === 'day.protected' && <Icon name="lock" size={12} />} {t(b)}
        </span>
      ))}
      {item.status !== 'planned' && <span className="tag status">{t(`status.${item.status}`)}</span>}
    </>
  );
}

export function ItemRow({ item, highlight, onOpen }: { item: AgendaItem; highlight?: boolean; onOpen?: () => void }) {
  const { t } = useT();
  const { profile } = useStore();
  const cats = useCategories();
  const s = profile!.settings;
  const c = item.categoryId ? cats.get(item.categoryId) : undefined;
  return (
    <li
      className={`block${highlight ? ' now' : ''}${isDone(item.status) ? ' done' : ''}${item.status === 'skipped' || item.status === 'cancelled' ? ' faded' : ''}`}
      style={catStyle(c)}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={(e) => onOpen && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
    >
      <div className="block-time">
        <span className={item.continues ? 'small' : ''}>{timeLabel(item, s, t)}</span>
        {item.endTime && item.kind !== 'task' && (
          <span className="muted small">
            {formatClock(item.endTime, s)}
            {item.endsNextDay ? ` · ${t('day.endsNextDay')}` : ''}
          </span>
        )}
      </div>
      <div className="block-body">
        <div className="block-title">
          {c && (
            <span className="cat-icon" aria-hidden>
              <Icon name={c.icon} size={18} />
            </span>
          )}
          <span>{item.title}</span>
        </div>
        <div className="tags">
          {highlight && <span className="tag now-tag">{t('day.now')}</span>}
          {c && <span className="tag">{c.name}</span>}
          <Badges item={item} />
        </div>
      </div>
    </li>
  );
}

function NowCard({ items, nowMin }: { items: AgendaItem[]; nowMin: number }) {
  const { t } = useT();
  const { profile, data } = useStore();
  const cats = useCategories();
  const dur = useDuration();
  const setStatus = useSetStatus();
  const [choosing, setChoosing] = useState(false);
  const s = profile!.settings;
  const { current, next, remainingMin } = nowAndNext(items, nowMin);

  if (!current) {
    return (
      <section className="now-card empty">
        <p className="hand mid">{next[0] ? t('day.freeNow') : t('day.dayOver')}</p>
        {next[0] && <p className="muted">{t('day.nextAt', { time: formatClock(next[0].startTime!, s), title: next[0].title })}</p>}
      </section>
    );
  }
  const c = current.categoryId ? cats.get(current.categoryId) : undefined;
  const note = current.projectId
    ? [...data.notes].filter((n) => n.projectId === current.projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    : undefined;
  const sealed = isDone(current.status);

  return (
    <motion.section
      key={current.key}
      className="now-card"
      style={catStyle(c)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      <div className="now-top">
        <span className="tag now-tag">{t('day.now')}</span>
        {c && <span className="tag">{c.name}</span>}
        <Badges item={current} />
      </div>
      <h2 className="now-title">
        {c && (
          <span className="cat-icon big" aria-hidden>
            <Icon name={c.icon} size={22} />
          </span>
        )}
        {current.title}
      </h2>
      <p className="now-time">
        {current.continues ? t('day.continues') : formatClock(current.startTime!, s)} – {formatClock(current.endTime!, s)}
        <span className="dot-sep">·</span>
        {t('day.remaining', { time: dur(remainingMin) })}
      </p>
      {note && (
        <div className="left-off">
          <span className="small muted">{t('day.leftOff')}</span>
          <p className="hand mid">{note.text}</p>
        </div>
      )}

      <AnimatePresence>
        {sealed && (
          <motion.div
            className="seal"
            aria-hidden
            initial={{ scale: 2.2, opacity: 0, rotate: -28 }}
            animate={{ scale: 1, opacity: 1, rotate: -12 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 18 }}
          >
            {t(current.status === 'done_short' ? 'day.sealedShort' : 'day.sealed')}
          </motion.div>
        )}
      </AnimatePresence>

      {!sealed && current.status === 'planned' && (
        <div className="now-actions">
          {choosing ? (
            <>
              <span className="small muted">{t('day.chooseShort')}</span>
              {current.shortVersions.map((sv) => (
                <button key={sv.id} className="btn" onClick={() => {
                    setChoosing(false);
                    setStatus(current, 'done_short', 'day.shortToast', sv);
                  }}>
                  {sv.title}
                </button>
              ))}
              <button className="btn ghost" onClick={() => setChoosing(false)}>
                {t('settings.cancel')}
              </button>
            </>
          ) : (
            <>
              <button className="btn primary" onClick={() => setStatus(current, 'done', 'day.doneToast')}>
                {t('day.done')}
              </button>
              {current.shortVersions.length > 0 && (
                <button
                  className="btn"
                  onClick={() =>
                    current.shortVersions.length === 1
                      ? setStatus(current, 'done_short', 'day.shortToast', current.shortVersions[0])
                      : setChoosing(true)
                  }
                >
                  {t('day.short')}
                </button>
              )}
              <button className="btn ghost" onClick={() => setStatus(current, 'skipped', 'day.skipToast')}>
                {t('day.notToday')}
              </button>
            </>
          )}
        </div>
      )}
    </motion.section>
  );
}

function Tasks({ items, title }: { items: AgendaItem[]; title: string }) {
  const { profile } = useStore();
  const { openItem } = useSheets();
  const setStatus = useSetStatus();
  if (!items.length) return null;
  return (
    <section className="card">
      <h2>{title}</h2>
      <ul className="task-list">
        {items.map((k) => (
          <li key={k.key}>
            <label className="choice">
              <input
                type="checkbox"
                checked={isDone(k.status)}
                onChange={(e) =>
                  setStatus(k, e.target.checked ? 'done' : 'planned', e.target.checked ? 'day.taskDone' : 'day.taskReopen')
                }
              />
              <span className={isDone(k.status) ? 'struck' : ''}>{k.title}</span>
              {k.startTime && <span className="muted small">{formatClock(k.startTime, profile!.settings)}</span>}
            </label>
            <button className="icon-btn" aria-label={k.title} onClick={() => openItem(k)}>
              <Icon name="right" size={18} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DayView({ date }: { date: PlainDateStr }) {
  const { t } = useT();
  const { profile, data, notify } = useStore();
  const { openItem } = useSheets();
  const s = profile!.settings;
  const now = useNow(s.timeZone);
  const isToday = date === now.date;
  const items = useMemo(() => buildDay(data, date), [data, date]);
  const [showAll, setShowAll] = useState(!isToday);
  const blocks = items.filter((i) => i.kind !== 'task');
  const tasks = items.filter((i) => i.kind === 'task');
  const { current, next } = nowAndNext(items, now.minutes);
  const theme = data.monthThemes.find((m) => m.month === monthKey(date));

  const hour = Number(now.time.slice(0, 2));
  const greet =
    hour < 5 ? 'greeting.night' : hour < 12 ? 'greeting.morning' : hour < 18 ? 'greeting.afternoon' : hour < 22 ? 'greeting.evening' : 'greeting.night';

  return (
    <div className="stack">
      {isToday && <p className="hand big greet">{t(greet, { name: profile!.name })}</p>}
      {theme?.theme && <p className="muted small theme-line">{t('day.monthTheme', { theme: theme.theme })}</p>}

      {isToday && (
        <>
          <NowCard items={items} nowMin={now.minutes} />
          <button className="btn day-changed" onClick={() => notify('day.dayChangedSoon')}>
            <Icon name="undo" size={18} /> {t('day.dayChanged')}
          </button>
          {next.length > 0 && (
            <section>
              <h2 className="section-title">{t('day.upNext')}</h2>
              <ol className="blocks">
                {next.map((i) => (
                  <ItemRow key={i.key} item={i} onOpen={() => openItem(i)} />
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      <Tasks items={tasks} title={t(isToday ? 'day.tasks' : 'day.tasksOther')} />

      {blocks.length === 0 && tasks.length === 0 ? (
        <p className="card muted">{t('day.empty')}</p>
      ) : (
        blocks.length > 0 && (
          <section>
            {isToday ? (
              <button className="section-toggle" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
                <h2 className="section-title">{t('day.whole')}</h2>
                <Icon name={showAll ? 'up' : 'down'} size={18} />
              </button>
            ) : (
              <h2 className="section-title">{t('day.whole')}</h2>
            )}
            {showAll && (
              <ol className="blocks">
                {blocks.map((i) => (
                  <ItemRow
                    key={i.key}
                    item={i}
                    highlight={isToday && current?.key === i.key && current.date === i.date}
                    onOpen={() => openItem(i)}
                  />
                ))}
              </ol>
            )}
          </section>
        )
      )}
    </div>
  );
}
