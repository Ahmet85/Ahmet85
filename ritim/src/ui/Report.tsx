// Haftalık karne ekranı (tarif bölüm 11).
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useT } from '../i18n/i18n';
import { repo, useStore } from './store';
import { weeklyReport, type Outcome, type Suggestion } from '../domain/report';
import { streakInfo } from '../domain/streaks';
import { addDays, monthKey, startOfWeek, weekdayOf } from '../domain/time';
import type { Weekday } from '../domain/types';
import { formatDayMonth, formatPercent, formatRange, weekdayName } from './format';
import { useCategories, useNow } from './hooks';
import { Icon } from './Icon';
import { useDuration } from './views/DayView';
import { useSheets } from './sheets/SheetHost';
import { buildDay } from '../domain/agenda';

const OUTCOMES: Outcome[] = ['done', 'done_short', 'postponed', 'skipped', 'conscious', 'unmarked'];

function BigRing({ ratio }: { ratio: number }) {
  const size = 148;
  const r = 62;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="big-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={12} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--ring)"
        strokeWidth={12}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        initial={{ strokeDasharray: `0 ${c}` }}
        animate={{ strokeDasharray: `${c * ratio} ${c}` }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
      />
    </svg>
  );
}

export function Report() {
  const { t } = useT();
  const { profile, data, run } = useStore();
  const { openMove } = useSheets();
  const cats = useCategories();
  const dur = useDuration();
  const s = profile!.settings;
  const now = useNow(s.timeZone);
  const [week, setWeek] = useState(() => startOfWeek(now.date, s.weekStart));
  const report = useMemo(() => weeklyReport(data, week, now.date, now.minutes), [data, week, now.date, now.minutes]);
  const streak = useMemo(() => streakInfo(data, now.date), [data, now.date]);
  const theme = data.monthThemes.find((m) => m.month === monthKey(now.date));
  const isCurrent = week === startOfWeek(now.date, s.weekStart);
  const maxCat = Math.max(1, ...report.categories.map((c) => Math.max(c.plannedMin, c.actualMin)));

  const suggestionText = (sg: Suggestion) => {
    const p = sg.params;
    switch (sg.kind) {
      case 'notEnoughData':
        return t('report.sg.notEnough', { days: p.days });
      case 'oftenPostponed':
        return t(p.altWeekday ? 'report.sg.postponed' : 'report.sg.postponedNoAlt', {
          title: p.title,
          weekday: p.weekday ? weekdayName(p.weekday as Weekday, s) : t('report.usually'),
          part: t(`report.part.${p.part}`),
          count: p.count,
          alt: p.altWeekday ? `${weekdayName(p.altWeekday as Weekday, s)} ${t(`report.partAcc.${p.altPart}`)}` : '',
        });
      case 'usuallyShort':
        return t('report.sg.short', { title: p.title, count: p.count });
      case 'strongCategory':
        return t('report.sg.strong', { category: cats.get(String(p.categoryId))?.name ?? '', percent: p.percent });
      case 'heavyWeek':
        return t('report.sg.heavy');
      default:
        return '';
    }
  };

  const tryIt = (sg: Suggestion) => {
    const m = sg.tryMove!;
    const item = buildDay(data, m.originalDate).find((i) => i.routineId === m.routineId && !i.continues);
    if (item) openMove(item, { date: m.date, startTime: m.startTime, durationMin: item.endMin - item.startMin });
  };

  return (
    <div className="stack report">
      <div className="cal-nav">
        <button className="icon-btn" aria-label={t('cal.prev.week')} onClick={() => setWeek(addDays(week, -7))}>
          <Icon name="left" />
        </button>
        <div className="cal-title">
          <h1 className="report-title">{t('report.title')}</h1>
          <span className="small muted">{formatRange(week, addDays(week, 6), s)}</span>
        </div>
        <button className="icon-btn" aria-label={t('cal.next.week')} disabled={isCurrent} onClick={() => setWeek(addDays(week, 7))}>
          <Icon name="right" />
        </button>
      </div>

      <section className="card ring-card">
        {report.ratio !== null ? (
          <>
            <div className="ring-wrap">
              <BigRing ratio={report.ratio} />
              <div className="ring-center">
                <strong>{formatPercent(report.ratio, s)}</strong>
                <span className="small muted">{t('report.doneOf', { done: report.done, total: report.denominator })}</span>
              </div>
            </div>
            <ul className="outcomes">
              {OUTCOMES.filter((o) => report.counts[o] > 0).map((o) => (
                <li key={o} className={`oc oc-${o}`}>
                  <span className="oc-dot" aria-hidden />
                  {t(`report.outcome.${o}`)} <strong>{report.counts[o]}</strong>
                </li>
              ))}
            </ul>
            {report.counts.conscious > 0 && <p className="small muted">{t('report.consciousNote')}</p>}
          </>
        ) : (
          <p className="muted">{t('report.empty')}</p>
        )}
        {(streak.streak >= 2 || streak.comeback) && isCurrent && (
          <p className="streak-line">
            <Icon name={streak.comeback ? 'heart' : 'leaf'} size={16} />{' '}
            {streak.comeback ? t('report.comeback') : t('badge.streak', { days: streak.streak })}
          </p>
        )}
      </section>

      {report.plannedMin > 0 && (
        <section className="card">
          <h2>{t('report.time')}</h2>
          <p className="time-total">
            <span>
              {t('report.planned')}: <strong>{dur(report.plannedMin)}</strong>
            </span>
            <span>
              {t('report.actual')}: <strong>{dur(report.actualMin)}</strong>
            </span>
          </p>
          <p className="small muted">{t('report.protectedNote')}</p>
          <ul className="cat-bars">
            {report.categories.filter((c) => c.plannedMin > 0).map((c) => {
              const cat = c.categoryId ? cats.get(c.categoryId) : undefined;
              return (
                <li key={c.categoryId ?? 'none'}>
                  <div className="cat-bar-head">
                    <span>
                      {cat && <Icon name={cat.icon} size={14} />} {cat?.name ?? t('add.noCategory')}
                    </span>
                    <span className="small muted">
                      {dur(c.actualMin)} / {dur(c.plannedMin)} · {t('report.doneOf', { done: c.done, total: c.total })}
                    </span>
                  </div>
                  <div className="bar" role="img" aria-label={`${cat?.name ?? ''}: ${dur(c.actualMin)} / ${dur(c.plannedMin)}`}>
                    <span className="bar-planned" style={{ width: `${(c.plannedMin / maxCat) * 100}%` }} />
                    <motion.span
                      className="bar-actual"
                      style={{ background: cat?.color.accent }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(c.actualMin / maxCat) * 100}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {report.bestDay && (
        <section className="card best-day">
          <Icon name="sun" size={22} />
          <p>
            {t('report.bestDay', {
              day: `${weekdayName(weekdayOf(report.bestDay.date), s)} (${formatDayMonth(report.bestDay.date, s)})`,
              done: report.bestDay.done,
              total: report.bestDay.total,
            })}
          </p>
        </section>
      )}

      {report.oftenPostponed.length > 0 && (
        <section className="card">
          <h2>{t('report.oftenPostponed')}</h2>
          <ul className="goals">
            {report.oftenPostponed.map((o) => (
              <li key={o.routineId}>
                {o.weekday
                  ? t('report.postponedItem', { title: o.title, weekday: weekdayName(o.weekday, s), count: o.count })
                  : t('report.postponedItemAny', { title: o.title, count: o.count })}
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.suggestions.length > 0 && (
        <section className="stack">
          <h2 className="section-title">{t('report.coach')}</h2>
          {report.suggestions.map((sg, i) => (
            <motion.div
              key={i}
              className={`card coach coach-${sg.kind}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08 }}
            >
              <p className="hand mid">{suggestionText(sg)}</p>
              {sg.tryMove && isCurrent && (
                <button className="btn small-btn" onClick={() => tryIt(sg)}>
                  {t('report.tryIt')}
                </button>
              )}
            </motion.div>
          ))}
        </section>
      )}

      {theme && (theme.theme || theme.goals.length > 0) && (
        <section className="card theme-card">
          <span className="small muted">{t('month.theme')}</span>
          {theme.theme && <p className="hand mid">{theme.theme}</p>}
          {theme.goals.length > 0 && (
            <ul className="goals">
              {theme.goals.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <label className="field">
        <span>{t('report.reportDay')}</span>
        <select
          value={s.reportDay ?? 7}
          onChange={(e) =>
            run('history.updateProfile', () => repo.updateProfile({ ...profile!, settings: { ...s, reportDay: Number(e.target.value) as Weekday } }), {
              undo: false,
            })
          }
        >
          {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((w) => (
            <option key={w} value={w}>
              {weekdayName(w, s)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
