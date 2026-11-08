// Tek zaman ekseni: Gün → Hafta → Ay → Yıl. Yakınlaşma = ayrıntıya inmek,
// uzaklaşma = büyük resme çıkmak (tarif bölüm 6 ve 17). İki parmakla kıstırma,
// trackpad kıstırma (ctrl+tekerlek) ve düğmelerle çalışır.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, type Variants } from 'motion/react';
import { useT } from '../i18n/i18n';
import { useStore } from './store';
import { addDays, addMonths, monthKey, startOfWeek, weekdayOf } from '../domain/time';
import type { PlainDateStr, Weekday } from '../domain/types';
import { formatLongDate, formatMonthYear, formatRange } from './format';
import { useMedia, useNow, usePref } from './hooks';
import { Icon } from './Icon';
import { DayView } from './views/DayView';
import { WeekView, weekDays } from './views/WeekView';
import { MonthView, monthGrid } from './views/MonthView';
import { YearView } from './views/YearView';

export const LEVELS = ['day', 'week', 'month', 'year'] as const;
export type Level = (typeof LEVELS)[number];

function periodKey(level: Level, d: PlainDateStr, ws: Weekday) {
  return level === 'day' ? d : level === 'week' ? startOfWeek(d, ws) : level === 'month' ? monthKey(d) : d.slice(0, 4);
}

function shift(level: Level, d: PlainDateStr, n: number) {
  return level === 'day' ? addDays(d, n) : level === 'week' ? addDays(d, 7 * n) : addMonths(d, level === 'month' ? n : 12 * n);
}

/**
 * Kamera hissi: daha büyük resimdeki konuma doğru yaklaş/uzaklaş.
 * Örn. ay → yıl geçişinde ay görünümü, yıldaki ay kartının yerine küçülür.
 */
function originFor(a: Level, b: Level, d: PlainDateStr, ws: Weekday, cols: number): string {
  const outer = LEVELS.indexOf(a) > LEVELS.indexOf(b) ? a : b;
  if (outer === 'week') {
    const idx = (weekdayOf(d) - ws + 7) % 7;
    return `50% ${10 + ((idx + 0.5) / 7) * 80}%`;
  }
  if (outer === 'month') {
    const cells = monthGrid(monthKey(d), ws);
    const row = Math.floor(cells.indexOf(startOfWeek(d, ws)) / 7);
    const rows = cells.length / 7;
    return `50% ${30 + ((Math.max(row, 0) + 0.5) / rows) * 65}%`;
  }
  const m = +d.slice(5, 7) - 1;
  const rows = Math.ceil(12 / cols);
  return `${((m % cols) + 0.5) / cols * 100}% ${18 + ((Math.floor(m / cols) + 0.5) / rows) * 80}%`;
}

type Move = { kind: 'zoom' | 'slide'; dir: number; origin: string };

const variants: Variants = {
  enter: (m: Move) =>
    m.kind === 'zoom'
      ? { opacity: 0, scale: m.dir > 0 ? 1.18 : 0.82, transformOrigin: m.origin }
      : { opacity: 0, x: 48 * m.dir },
  center: { opacity: 1, scale: 1, x: 0, transition: { type: 'spring', stiffness: 240, damping: 28, mass: 0.9 } },
  exit: (m: Move) =>
    m.kind === 'zoom'
      ? { opacity: 0, scale: m.dir > 0 ? 0.82 : 1.2, transformOrigin: m.origin, transition: { duration: 0.22 } }
      : { opacity: 0, x: -48 * m.dir, transition: { duration: 0.18 } },
};

export function Calendar() {
  const { t } = useT();
  const { profile } = useStore();
  const s = profile!.settings;
  const now = useNow(s.timeZone);
  const [level, setLevelPref] = usePref<Level>('level', 'day');
  const [date, setDate] = useState<PlainDateStr>(now.date);
  const [move, setMove] = useState<Move>({ kind: 'zoom', dir: 0, origin: '50% 50%' });
  const [weekPref, setWeekPref] = usePref<'auto' | 'table' | 'strips'>('weekMode', 'auto');
  const landscapePhone = useMedia('(orientation: landscape) and (max-height: 520px)');
  const wide = useMedia('(min-width: 768px)');
  const w900 = useMedia('(min-width: 900px)');
  const w600 = useMedia('(min-width: 600px)');
  const cols = w900 ? 4 : w600 ? 3 : 2;
  const table = landscapePhone || weekPref === 'table' || (wide && weekPref !== 'strips');

  const go = (to: Level, d: PlainDateStr = date) => {
    if (to === level && d === date) return;
    const dir = LEVELS.indexOf(to) - LEVELS.indexOf(level);
    setMove({ kind: 'zoom', dir: Math.sign(dir), origin: originFor(level, to, d, s.weekStart, cols) });
    setDate(d);
    setLevelPref(to);
  };
  const zoom = (delta: number) => {
    const i = LEVELS.indexOf(level) + delta;
    if (i >= 0 && i < LEVELS.length) go(LEVELS[i]);
  };
  const step = (n: number) => {
    setMove({ kind: 'slide', dir: n, origin: '50% 50%' });
    setDate(shift(level, date, n));
  };
  const toToday = () => {
    setMove({ kind: 'slide', dir: date < now.date ? 1 : -1, origin: '50% 50%' });
    setDate(now.date);
  };

  // ---- Kıstırma (pinch) ----
  const area = useRef<HTMLDivElement>(null);
  const pinch = useRef<{ d0: number; scale: number } | null>(null);
  const [live, setLive] = useState(1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  useEffect(() => {
    const el = area.current!;
    const dist = (e: TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) pinch.current = { d0: dist(e), scale: 1 };
    };
    const moveH = (e: TouchEvent) => {
      if (!pinch.current || e.touches.length !== 2) return;
      e.preventDefault();
      pinch.current.scale = dist(e) / pinch.current.d0;
      setLive(Math.min(1.12, Math.max(0.88, pinch.current.scale)));
    };
    const end = () => {
      const p = pinch.current;
      if (!p) return;
      pinch.current = null;
      setLive(1);
      if (p.scale < 0.8) zoomRef.current(1); // parmaklar yaklaştı → uzaklaş
      else if (p.scale > 1.25) zoomRef.current(-1); // parmaklar açıldı → yakınlaş
    };
    let acc = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // trackpad kıstırma
      e.preventDefault();
      acc += e.deltaY;
      clearTimeout(timer);
      timer = setTimeout(() => (acc = 0), 250);
      if (Math.abs(acc) > 60) {
        zoomRef.current(acc > 0 ? 1 : -1);
        acc = 0;
      }
    };
    const gesture = (e: Event) => e.preventDefault(); // iOS sayfa yakınlaştırmasını engelle
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', moveH, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('gesturestart', gesture);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', moveH);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('gesturestart', gesture);
    };
  }, []);

  const title =
    level === 'day'
      ? formatLongDate(date, s)
      : level === 'week'
        ? (() => {
            const days = weekDays(date, s.weekStart);
            return formatRange(days[0], days[6], s);
          })()
        : level === 'month'
          ? formatMonthYear(date, s)
          : date.slice(0, 4);
  const containsToday = periodKey(level, date, s.weekStart) === periodKey(level, now.date, s.weekStart);

  return (
    <div className={`calendar level-${level}${table && level === 'week' ? ' with-table' : ''}`}>
      <div className="cal-top">
        <div className="levels" role="tablist" aria-label={t('level.zoomHint')}>
          {LEVELS.map((l) => (
            <button key={l} role="tab" aria-selected={level === l} className={level === l ? 'active' : ''} onClick={() => go(l)}>
              {level === l && <motion.span layoutId="level-pill" className="pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className="lbl">{t(`level.${l}`)}</span>
            </button>
          ))}
        </div>
        <div className="cal-nav">
          <button className="icon-btn" aria-label={t(`cal.prev.${level}`)} onClick={() => step(-1)}>
            <Icon name="left" />
          </button>
          <h1 className="cal-title" aria-live="polite">
            {title}
          </h1>
          <button className="icon-btn" aria-label={t(`cal.next.${level}`)} onClick={() => step(1)}>
            <Icon name="right" />
          </button>
        </div>
        {(!containsToday || (level === 'week' && !landscapePhone)) && (
        <div className="cal-tools">
          {!containsToday && (
            <button className="btn ghost small-btn" onClick={toToday}>
              {t('cal.today')}
            </button>
          )}
          <span className="spacer" />
          {level === 'week' && !landscapePhone && (
            <button
              className="icon-btn"
              aria-label={t(table ? 'week.strips' : 'week.table')}
              onClick={() => setWeekPref(table ? 'strips' : 'table')}
            >
              <Icon name={table ? 'strips' : 'table'} />
            </button>
          )}
        </div>
        )}
      </div>

      <div className="cal-stage" ref={area} style={{ transform: live !== 1 ? `scale(${live})` : undefined }}>
        <AnimatePresence mode="popLayout" custom={move} initial={false}>
          <motion.div
            key={`${level}:${periodKey(level, date, s.weekStart)}:${level === 'week' ? String(table) : ''}`}
            custom={move}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            className="cal-view"
          >
            {level === 'day' && <DayView date={date} />}
            {level === 'week' && <WeekView date={date} table={table} onOpenDay={(d) => go('day', d)} />}
            {level === 'month' && <MonthView date={date} onOpenDay={(d) => go('day', d)} />}
            {level === 'year' && <YearView date={date} onOpenMonth={(d) => go('month', d)} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
