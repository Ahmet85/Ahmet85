import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useDropMove } from '../sheets/MoveFlow';
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
interface Drag {
  item: AgendaItem;
  mode: 'move' | 'resize';
  grab: number; // bloğun içinde tutulan nokta (dakika)
  date: PlainDateStr;
  start: number;
  dur: number;
}

const snap = (m: number, step = 15) => Math.round(m / step) * step;
const LONG_PRESS_MS = 350;

function Table({ days, byDay, onOpenDay }: Props) {
  const { t } = useT();
  const { profile, dismissToast } = useStore();
  const { openAdd, openItem, openMove } = useSheets();
  const dropMove = useDropMove(openMove);
  const cats = useCategories();
  const s = profile!.settings;
  const now = useNow(s.timeZone);
  const scroller = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  const press = useRef<{ x: number; y: number; timer?: ReturnType<typeof setTimeout>; touch: boolean; start: () => void } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    // Sabah 06:00'ya kaydır
    scroller.current?.scrollTo({ top: 6 * HOUR_PX - 8 });
  }, []);

  /** İmlecin altındaki gün ve dakika */
  const pointAt = (x: number, y: number) => {
    const r = body.current!.getBoundingClientRect();
    const colW = (r.width - 52) / 7;
    const rtl = getComputedStyle(body.current!).direction === 'rtl';
    const rel = rtl ? r.right - x - 52 : x - r.left - 52;
    const idx = Math.max(0, Math.min(6, Math.floor(rel / colW)));
    return { date: days[idx], min: ((y - r.top) / HOUR_PX) * 60 };
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (p && !dragRef.current) {
        const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
        if (p.touch && dist > 8) {
          clearTimeout(p.timer); // kaydırma: taşıma başlamaz
          press.current = null;
        } else if (!p.touch && dist > 4) p.start();
        return;
      }
      const d = dragRef.current;
      if (!d) return;
      const pt = pointAt(e.clientX, e.clientY);
      if (d.mode === 'move') {
        setDrag({ ...d, date: pt.date, start: Math.max(0, Math.min(1440 - 15, snap(pt.min - d.grab))) });
      } else {
        setDrag({ ...d, dur: Math.max(15, Math.min(1440 - d.start, snap(pt.min - d.start))) });
      }
      // Kenara yaklaşınca kendiliğinden kaydır
      const sc = scroller.current!.getBoundingClientRect();
      if (e.clientY > sc.bottom - 40) scroller.current!.scrollTop += 14;
      else if (e.clientY < sc.top + 90) scroller.current!.scrollTop -= 14;
    };
    const up = () => {
      if (press.current) clearTimeout(press.current.timer);
      press.current = null;
      const d = dragRef.current;
      if (!d) return;
      setDrag(null);
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 50);
      dropMove(d.item, { date: d.date, startTime: clock(d.start), durationMin: d.dur });
    };
    // Sürüklerken sayfa kaymasın (iOS için dokunma olayında engellenir)
    const touchMove = (e: TouchEvent) => dragRef.current && e.preventDefault();
    const sc = scroller.current!;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    sc.addEventListener('touchmove', touchMove, { passive: false });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      sc.removeEventListener('touchmove', touchMove);
    };
  }); // her çizimde güncel kapanışla

  const begin = (e: React.PointerEvent, item: AgendaItem, mode: Drag['mode']) => {
    if (e.button !== 0 || item.continues) return;
    e.stopPropagation();
    const touch = e.pointerType !== 'mouse';
    const pt = pointAt(e.clientX, e.clientY);
    const start = () => {
      press.current = null;
      dismissToast();
      navigator.vibrate?.(12);
      setDrag({
        item,
        mode,
        grab: mode === 'move' ? Math.max(0, pt.min - item.startMin) : 0,
        date: item.date,
        start: item.startMin,
        dur: item.endMin - item.startMin,
      });
    };
    press.current = { x: e.clientX, y: e.clientY, touch, start, timer: touch ? setTimeout(start, LONG_PRESS_MS) : undefined };
  };

  const fmtRange = (d: Drag) => `${formatWeekdayShort(d.date, s)} ${+d.date.slice(8)} · ${formatClock(clock(d.start), s)}–${formatClock(clock((d.start + d.dur) % 1440), s)}`;

  return (
    <>
      <div className={`week-table${drag ? ' dragging' : ''}`} ref={scroller}>
        <div className="wt-head">
          <span />
          {days.map((d) => (
            <button key={d} className={`wt-day${d === now.date ? ' today' : ''}${drag?.date === d ? ' drop-target' : ''}`} onClick={() => onOpenDay(d)}>
              <span className="small muted">{formatWeekdayShort(d, s)}</span>
              <span className="strip-num">{+d.slice(8)}</span>
            </button>
          ))}
        </div>
        <div className="wt-body" style={{ height: 24 * HOUR_PX }} ref={body}>
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
                className={`wt-col${d === now.date ? ' today' : ''}${drag?.date === d ? ' drop-target' : ''}`}
                initial={{ rotateX: -75, opacity: 0 }}
                animate={{ rotateX: 0, opacity: 1 }}
                transition={{ delay: i * 0.045, type: 'spring', stiffness: 170, damping: 22 }}
                style={{ transformOrigin: 'top center' }}
                onClick={(e) => {
                  if (suppressClick.current) return;
                  // Boş bir saate dokununca o saate randevu ekle (yarım saate yuvarlanır)
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                  const start = Math.min(Math.max(0, Math.floor((y / HOUR_PX) * 2) * 30), 23 * 60 + 30);
                  openAdd({ date: d, start: clock(start), end: clock(Math.min(start + 60, 1439)) });
                }}
              >
                {assignLanes(
                  items.map((x) => {
                    const c = clampDay(x);
                    return { ...x, startMin: c.start, endMin: c.end, orig: x };
                  }),
                ).map(({ item: placed, lane, lanes }) => {
                  const item = placed.orig;
                  const c = item.categoryId ? cats.get(item.categoryId) : undefined;
                  const h = Math.max(16, ((placed.endMin - placed.startMin) / 60) * HOUR_PX - 2);
                  const isSrc = drag?.item.key === item.key && drag.item.date === item.date;
                  const canResize = !item.continues && !item.endsNextDay && h > 24;
                  return (
                    <div
                      key={item.key + item.date}
                      role="button"
                      tabIndex={0}
                      aria-label={`${item.title} ${item.continues ? '' : formatClock(item.startTime!, s)}`}
                      className={`wt-block${item.kind === 'event' ? ' event' : ''}${item.status === 'skipped' || item.status === 'postponed' ? ' faded' : ''}${isSrc ? ' drag-src' : ''}`}
                      style={{
                        ...catStyle(c),
                        top: (placed.startMin / 60) * HOUR_PX + 1,
                        height: h,
                        insetInlineStart: `${(lane / lanes) * 100}%`,
                        width: `${100 / lanes}%`,
                      }}
                      onPointerDown={(e) => begin(e, item, 'move')}
                      onContextMenu={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!suppressClick.current) openItem(item);
                      }}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openItem(item))}
                    >
                      <span className="wt-title">{item.title}</span>
                      {h > 34 && !item.continues && <span className="wt-time">{formatClock(item.startTime!, s)}</span>}
                      {canResize && (
                        <span
                          className="wt-resize"
                          aria-hidden
                          onPointerDown={(e) => begin(e, item, 'resize')}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </div>
                  );
                })}
                {drag && drag.date === d && (
                  <div
                    className="wt-ghost"
                    style={{ ...catStyle(drag.item.categoryId ? cats.get(drag.item.categoryId) : undefined), top: (drag.start / 60) * HOUR_PX + 1, height: Math.max(18, (drag.dur / 60) * HOUR_PX - 2) }}
                  >
                    <span className="wt-title">{drag.item.title}</span>
                    <span className="wt-time">
                      {formatClock(clock(drag.start), s)}–{formatClock(clock((drag.start + drag.dur) % 1440), s)}
                    </span>
                  </div>
                )}
                {d === now.date && <span className="wt-now" style={{ top: (now.minutes / 60) * HOUR_PX }} />}
              </motion.div>
            );
          })}
        </div>
      </div>
      {drag ? (
        <p className="drag-label" role="status">
          {drag.item.title} → {fmtRange(drag)}
        </p>
      ) : (
        <p className="muted small center">{t('drag.hint')}</p>
      )}
    </>
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
      {!table && <p className="muted small center">{t('week.rotateHint')}</p>}
    </div>
  );
}
