import { useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { useT } from '../../i18n/i18n';
import { useStore } from '../store';
import { assignLanes, buildRange, summarize, type AgendaItem } from '../../domain/agenda';
import { addDays, startOfWeek } from '../../domain/time';
import type { PlainDateStr } from '../../domain/types';
import { formatClock, formatPercent, formatWeekdayShort } from '../format';
import { useCategories, useNow } from '../hooks';
import { catStyle } from './DayView';
import { useSheets } from '../sheets/SheetHost';
import { clock } from '../../domain/time';

const HOUR_PX = 44;

export function weekDays(date: PlainDateStr, weekStart: number) {
  const first = startOfWeek(date, weekStart as 1);
  return Array.from({ length: 7 }, (_, i) => addDays(first, i));
}

const clampDay = (i: AgendaItem) => ({ start: Math.max(0, i.startMin), end: Math.min(1440, i.endMin) });

/** Dikte: 7 günlük sade şeritler. Her şerit günün 24 saatlik özetidir. */
function Strips({ days, byDay, onOpenDay }: Props) {
  const { t } = useT();
  const { profile } = useStore();
  const cats = useCategories();
  const s = profile!.settings;
  const now = useNow(s.timeZone);
  return (
    <ol className="strips">
      {days.map((d, i) => {
        const items = byDay.get(d)!;
        const sum = summarize(items);
        const blocks = items.filter((x) => x.kind !== 'task' && x.timed);
        const isToday = d === now.date;
        return (
          <motion.li
            key={d}
            className={`strip${isToday ? ' today' : ''}`}
            initial={{ opacity: 0, scaleY: 0.6 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 30 }}
          >
            <button className="strip-btn" onClick={() => onOpenDay(d)} aria-label={`${formatWeekdayShort(d, s)} ${+d.slice(8)}`}>
              <span className="strip-day">
                <span className="small muted">{formatWeekdayShort(d, s)}</span>
                <span className="strip-num">{+d.slice(8)}</span>
              </span>
              <span className="strip-main">
                <span className="strip-bar" aria-hidden>
                  {blocks.map((b) => {
                    const { start, end } = clampDay(b);
                    const c = b.categoryId ? cats.get(b.categoryId) : undefined;
                    return (
                      <span
                        key={b.key + b.date}
                        className={`seg${b.kind === 'event' ? ' event' : ''}${b.status === 'skipped' || b.status === 'postponed' ? ' faded' : ''}`}
                        style={{ ...catStyle(c), insetInlineStart: `${(start / 1440) * 100}%`, width: `${((end - start) / 1440) * 100}%` }}
                      />
                    );
                  })}
                  {isToday && <span className="now-line" style={{ insetInlineStart: `${(now.minutes / 1440) * 100}%` }} />}
                </span>
                <span className="strip-meta small muted">
                  {d <= now.date && sum.ratio !== null && sum.done > 0 && (
                    <span>{t('week.completed', { value: formatPercent(sum.ratio, s) })}</span>
                  )}
                  {sum.events > 0 && <span className="mark event-mark">{t('week.events', { count: sum.events })}</span>}
                  {sum.tasks > 0 && <span className="mark task-mark">{t('week.tasks', { count: sum.tasks })}</span>}
                </span>
              </span>
            </button>
          </motion.li>
        );
      })}
    </ol>
  );
}

interface Props {
  days: PlainDateStr[];
  byDay: Map<PlainDateStr, AgendaItem[]>;
  onOpenDay: (d: PlainDateStr) => void;
}

/** Büyük haftalık tablo. Sütunlar kâğıt gibi açılarak gelir. */
function Table({ days, byDay, onOpenDay }: Props) {
  const { profile } = useStore();
  const { openAdd, openItem } = useSheets();
  const cats = useCategories();
  const s = profile!.settings;
  const now = useNow(s.timeZone);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Sabah 06:00'ya kaydır
    scroller.current?.scrollTo({ top: 6 * HOUR_PX - 8 });
  }, []);

  return (
    <div className="week-table" ref={scroller}>
      <div className="wt-head">
        <span />
        {days.map((d) => (
          <button key={d} className={`wt-day${d === now.date ? ' today' : ''}`} onClick={() => onOpenDay(d)}>
            <span className="small muted">{formatWeekdayShort(d, s)}</span>
            <span className="strip-num">{+d.slice(8)}</span>
          </button>
        ))}
      </div>
      <div className="wt-body" style={{ height: 24 * HOUR_PX }}>
        <div className="wt-hours" aria-hidden>
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} style={{ top: h * HOUR_PX }}>
              {h > 0 ? formatClock(`${String(h).padStart(2, '0')}:00`, s) : ''}
            </span>
          ))}
        </div>
        {days.map((d, i) => {
          const items = byDay.get(d)!.filter((x) => x.kind !== 'task' && x.timed);
          return (
            <motion.div
              key={d}
              className={`wt-col${d === now.date ? ' today' : ''}`}
              initial={{ rotateX: -75, opacity: 0 }}
              animate={{ rotateX: 0, opacity: 1 }}
              transition={{ delay: i * 0.045, type: 'spring', stiffness: 170, damping: 22 }}
              style={{ transformOrigin: 'top center' }}
              onClick={(e) => {
                // Boş bir saate dokununca o saate randevu ekle (yarım saate yuvarlanır)
                const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                const start = Math.min(Math.max(0, Math.floor((y / HOUR_PX) * 2) * 30), 23 * 60 + 30);
                openAdd({ date: d, start: clock(start), end: clock(Math.min(start + 60, 1439)) });
              }}
            >
              {assignLanes(items.map((x) => { const c = clampDay(x); return { ...x, startMin: c.start, endMin: c.end }; })).map(
                ({ item, lane, lanes }) => {
                  const c = item.categoryId ? cats.get(item.categoryId) : undefined;
                  const h = Math.max(16, ((item.endMin - item.startMin) / 60) * HOUR_PX - 2);
                  return (
                    <button
                      key={item.key + item.date}
                      className={`wt-block${item.kind === 'event' ? ' event' : ''}${item.status === 'skipped' || item.status === 'postponed' ? ' faded' : ''}`}
                      style={{
                        ...catStyle(c),
                        top: (item.startMin / 60) * HOUR_PX + 1,
                        height: h,
                        insetInlineStart: `${(lane / lanes) * 100}%`,
                        width: `${100 / lanes}%`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openItem(item);
                      }}
                      title={item.title}
                    >
                      <span className="wt-title">{item.title}</span>
                      {h > 34 && !item.continues && <span className="wt-time">{formatClock(item.startTime!, s)}</span>}
                    </button>
                  );
                },
              )}
              {d === now.date && <span className="wt-now" style={{ top: (now.minutes / 60) * HOUR_PX }} />}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export function WeekView({ date, table, onOpenDay }: { date: PlainDateStr; table: boolean; onOpenDay: (d: PlainDateStr) => void }) {
  const { t } = useT();
  const { profile, data } = useStore();
  const days = weekDays(date, profile!.settings.weekStart);
  const byDay = useMemo(() => buildRange(data, days[0], days[6]), [data, days[0]]); // eslint-disable-line
  return (
    <div className="stack">
      {table ? <Table days={days} byDay={byDay} onOpenDay={onOpenDay} /> : <Strips days={days} byDay={byDay} onOpenDay={onOpenDay} />}
      <p className="muted small center">{t(table ? 'week.tapToAdd' : 'week.rotateHint')}</p>
    </div>
  );
}
