import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useT } from '../../i18n/i18n';
import { repo, useStore } from '../store';
import { buildRange, summarize } from '../../domain/agenda';
import { addDays, daysInMonth, monthKey, startOfWeek } from '../../domain/time';
import type { PlainDateStr } from '../../domain/types';
import { formatLongDate, formatWeekdayNarrow } from '../format';
import { useCategories, useNow } from '../hooks';
import { Icon } from '../Icon';

/** Başlık + en fazla N satır hedef düzenleyici (ay teması ve yıl hedefleri ortak). */
export function GoalsEditor(props: {
  withTheme: boolean;
  theme?: string;
  goals: string[];
  max: number;
  goalLabel: string;
  onSave: (theme: string, goals: string[]) => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const [theme, setTheme] = useState(props.theme ?? '');
  const [goals, setGoals] = useState<string[]>(() => Array.from({ length: props.max }, (_, i) => props.goals[i] ?? ''));
  return (
    <div className="stack">
      {props.withTheme && (
        <label className="field">
          <span>{t('month.themeLabel')}</span>
          <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder={t('month.themePlaceholder')} autoFocus />
        </label>
      )}
      {goals.map((g, i) => (
        <label key={i} className="field">
          <span>{t(props.goalLabel, { n: i + 1 })}</span>
          <input
            value={g}
            placeholder={t('month.goalPlaceholder')}
            onChange={(e) => setGoals(goals.map((x, j) => (j === i ? e.target.value : x)))}
          />
        </label>
      ))}
      <div className="row-btns">
        <button className="btn primary" onClick={() => props.onSave(theme.trim(), goals.map((x) => x.trim()).filter(Boolean))}>
          {t('settings.save')}
        </button>
        <button className="btn ghost" onClick={props.onCancel}>
          {t('settings.cancel')}
        </button>
      </div>
    </div>
  );
}

function ThemeCard({ month }: { month: string }) {
  const { t } = useT();
  const { profile, data, run } = useStore();
  const [editing, setEditing] = useState(false);
  const m = data.monthThemes.find((x) => x.month === month);
  const pid = profile!.id;

  if (editing)
    return (
      <section className="card">
        <GoalsEditor
          withTheme
          theme={m?.theme}
          goals={m?.goals ?? []}
          max={4}
          goalLabel="month.goalLabel"
          onCancel={() => setEditing(false)}
          onSave={async (theme, goals) => {
            await run('history.saveMonthTheme', () => repo.putMonthTheme({ id: `${pid}:${month}`, profileId: pid, month, theme, goals }));
            setEditing(false);
          }}
        />
      </section>
    );

  return (
    <section className="card theme-card">
      {m?.theme || m?.goals.length ? (
        <>
          <div className="card-head">
            <span className="small muted">{t('month.theme')}</span>
            <button className="icon-btn" aria-label={t('month.edit')} onClick={() => setEditing(true)}>
              <Icon name="edit" size={18} />
            </button>
          </div>
          {m.theme && <p className="hand big">{m.theme}</p>}
          {m.goals.length > 0 && (
            <ul className="goals">
              {m.goals.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="card-head">
          <span className="muted">{t('month.noTheme')}</span>
          <button className="btn small-btn" onClick={() => setEditing(true)}>
            <Icon name="plus" size={16} /> {t('month.addTheme')}
          </button>
        </div>
      )}
    </section>
  );
}

/** Tamamlama halkası (renge ek olarak sayıyla da okunur). */
export function Ring({ ratio, size = 30 }: { ratio: number; size?: number }) {
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={2.5} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--ring)"
        strokeWidth={2.5}
        strokeDasharray={`${c * ratio} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function monthGrid(month: string, weekStart: number) {
  const first = `${month}-01`;
  const start = startOfWeek(first, weekStart as 1);
  const n = daysInMonth(+month.slice(0, 4), +month.slice(5, 7));
  const end = addDays(first, n - 1);
  const cells: PlainDateStr[] = [];
  for (let d = start; d <= end || cells.length % 7; d = addDays(d, 1)) cells.push(d);
  return cells;
}

export function MonthView({ date, onOpenDay }: { date: PlainDateStr; onOpenDay: (d: PlainDateStr) => void }) {
  const { t } = useT();
  const { profile, data } = useStore();
  const cats = useCategories();
  const s = profile!.settings;
  const now = useNow(s.timeZone);
  const month = monthKey(date);
  const cells = monthGrid(month, s.weekStart);
  const byDay = useMemo(() => buildRange(data, cells[0], cells[cells.length - 1]), [data, month, s.weekStart]); // eslint-disable-line

  return (
    <div className="stack">
      <ThemeCard month={month} />
      <section className="card month-card">
        <div className="month-grid head" aria-hidden>
          {cells.slice(0, 7).map((d) => (
            <span key={d}>{formatWeekdayNarrow(d, s)}</span>
          ))}
        </div>
        <div className="month-grid">
          {cells.map((d, i) => {
            const sum = summarize(byDay.get(d)!);
            const inMonth = monthKey(d) === month;
            const showRatio = d <= now.date && sum.ratio !== null && sum.done > 0;
            const parts = [
              showRatio ? t('month.completed', { value: Math.round(sum.ratio! * 100) }) : '',
              sum.events ? t('month.hasEvents') : '',
              sum.tasks ? t('month.hasTasks') : '',
            ].filter(Boolean);
            return (
              <motion.button
                key={d}
                className={`mcell${inMonth ? '' : ' out'}${d === now.date ? ' today' : ''}`}
                onClick={() => onOpenDay(d)}
                aria-label={t('month.dayLabel', { date: formatLongDate(d, s), summary: parts.join(', ') })}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.006, 0.2), duration: 0.25 }}
              >
                <span className="mnum">
                  {showRatio && <Ring ratio={sum.ratio!} />}
                  <span>{+d.slice(8)}</span>
                </span>
                <span className="mdots" aria-hidden>
                  {sum.categoryIds.slice(0, 3).map((id) => (
                    <span key={id} className="mdot" style={{ background: cats.get(id)?.color.accent }} />
                  ))}
                </span>
                <span className="mmarks" aria-hidden>
                  {sum.events > 0 && <span className="mark-sq" />}
                  {sum.tasks > 0 && <span className="mark-tri" />}
                </span>
              </motion.button>
            );
          })}
        </div>
        <p className="small muted legend">{t('month.legend')}</p>
      </section>
    </div>
  );
}
