import { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n/i18n';
import { useStore } from './store';
import { occurrencesForDay } from '../domain/recurrence';
import { addDays, minutesOfDay, nowLocal } from '../domain/time';
import type { Category, PlainDateStr } from '../domain/types';
import { formatClock, formatLongDate } from './format';
import { Icon } from './Icon';

interface Row {
  key: string;
  title: string;
  start?: string;
  end?: string;
  category?: Category;
  badges: string[];
  status: string;
  continues?: boolean;
  endsNextDay?: boolean;
  isNow?: boolean;
}

function useClock(timeZone: string) {
  const [now, setNow] = useState(() => nowLocal(timeZone));
  useEffect(() => {
    setNow(nowLocal(timeZone));
    const id = setInterval(() => setNow(nowLocal(timeZone)), 30_000);
    return () => clearInterval(id);
  }, [timeZone]);
  return now;
}

export function Today() {
  const { t } = useT();
  const { profile, data } = useStore();
  const s = profile!.settings;
  const now = useClock(s.timeZone);
  const [date, setDate] = useState<PlainDateStr>(now.date);
  const isToday = date === now.date;

  const rows = useMemo<Row[]>(() => {
    const cat = new Map(data.categories.map((c) => [c.id, c]));
    const routine = new Map(data.routines.map((r) => [r.id, r]));
    const nowMin = minutesOfDay(now.time);
    const out: Row[] = [];

    for (const { instance: o, continuesFromPrevDay } of occurrencesForDay(data.routines, data.records, date)) {
      const r = routine.get(o.routineId)!;
      const startMin = continuesFromPrevDay ? 0 : minutesOfDay(o.startTime);
      const endMin = o.endDate > date ? 24 * 60 : minutesOfDay(o.endTime);
      out.push({
        key: `${o.routineId}@${o.originalDate}`,
        title: r.title,
        start: o.startTime,
        end: o.endTime,
        category: r.categoryId ? cat.get(r.categoryId) : undefined,
        badges: [r.flex.protected ? 'today.protected' : r.flex.timing === 'fixed' ? 'today.fixed' : 'today.flexible'],
        status: o.status,
        continues: continuesFromPrevDay,
        endsNextDay: !continuesFromPrevDay && o.endDate > date,
        isNow: isToday && nowMin >= startMin && nowMin < endMin,
      });
    }
    for (const e of data.events) {
      if (date < e.startDate || date > e.endDate) continue;
      out.push({
        key: `e:${e.id}`,
        title: e.title,
        start: e.startDate === date ? e.startTime : undefined,
        end: e.endDate === date ? e.endTime : undefined,
        category: e.categoryId ? cat.get(e.categoryId) : undefined,
        badges: [],
        status: e.status,
      });
    }
    for (const k of data.tasks.filter((x) => x.date === date))
      out.push({ key: `t:${k.id}`, title: k.title, start: k.time, badges: [], status: k.status });

    return out.sort((a, b) => (a.continues ? -1 : b.continues ? 1 : (a.start ?? '').localeCompare(b.start ?? '')));
  }, [data, date, now.time, isToday]);

  const hour = Number(now.time.slice(0, 2));
  const greet =
    hour < 5 ? 'greeting.night' : hour < 12 ? 'greeting.morning' : hour < 18 ? 'greeting.afternoon' : hour < 22 ? 'greeting.evening' : 'greeting.night';

  return (
    <section>
      <header className="day-head">
        <p className="hand big">{t(greet, { name: profile!.name })}</p>
        <div className="day-nav">
          <button className="icon-btn" aria-label={t('today.prevDay')} onClick={() => setDate(addDays(date, -1))}>
            <Icon name="left" />
          </button>
          <div className="day-title">
            <h1>{formatLongDate(date, s)}</h1>
            <span className="muted small">{t('today.blockCount', { count: rows.length })}</span>
          </div>
          <button className="icon-btn" aria-label={t('today.nextDay')} onClick={() => setDate(addDays(date, 1))}>
            <Icon name="right" />
          </button>
        </div>
        {!isToday && (
          <button className="btn ghost small-btn" onClick={() => setDate(now.date)}>
            {t('today.backToToday')}
          </button>
        )}
      </header>

      {rows.length === 0 ? (
        <p className="card muted">{t('today.empty')}</p>
      ) : (
        <ol className="blocks">
          {rows.map((r) => (
            <li
              key={r.key}
              className={`block${r.isNow ? ' now' : ''}`}
              style={
                r.category
                  ? ({ '--cat-bg': r.category.color.bg, '--cat-fg': r.category.color.fg, '--cat-accent': r.category.color.accent } as React.CSSProperties)
                  : undefined
              }
            >
              <div className="block-time">
                {r.continues ? (
                  <span className="small">{t('today.continues')}</span>
                ) : (
                  r.start && <span>{formatClock(r.start, s)}</span>
                )}
                {r.end && (
                  <span className="muted small">
                    {formatClock(r.end, s)}
                    {r.endsNextDay ? ` · ${t('today.endsNextDay')}` : ''}
                  </span>
                )}
              </div>
              <div className="block-body">
                <div className="block-title">
                  {r.category && (
                    <span className="cat-icon" aria-hidden>
                      <Icon name={r.category.icon} size={18} />
                    </span>
                  )}
                  <span>{r.title}</span>
                </div>
                <div className="tags">
                  {r.isNow && <span className="tag now-tag">{t('today.now')}</span>}
                  {r.category && <span className="tag">{r.category.name}</span>}
                  {r.badges.map((b) => (
                    <span key={b} className="tag">
                      {b === 'today.protected' && <Icon name="lock" size={12} />} {t(b)}
                    </span>
                  ))}
                  {r.status !== 'planned' && <span className="tag status">{t(`status.${r.status}`)}</span>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="muted small note">{t('today.stepNote')}</p>
    </section>
  );
}
