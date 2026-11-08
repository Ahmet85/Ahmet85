import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useT } from '../../i18n/i18n';
import { repo, useStore } from '../store';
import { buildRange, summarize } from '../../domain/agenda';
import { addDays, monthKey } from '../../domain/time';
import type { PlainDateStr } from '../../domain/types';
import { formatMonthName, formatPercent } from '../format';
import { useNow } from '../hooks';
import { Icon } from '../Icon';
import { GoalsEditor, Ring, monthGrid } from './MonthView';

function YearGoalsCard({ year }: { year: number }) {
  const { t } = useT();
  const { profile, data, run } = useStore();
  const [editing, setEditing] = useState(false);
  const y = data.yearGoals.find((x) => x.year === year);
  const pid = profile!.id;

  if (editing)
    return (
      <section className="card">
        <h2>{t('year.goals')}</h2>
        <GoalsEditor
          withTheme={false}
          goals={y?.goals ?? []}
          max={3}
          goalLabel="year.goalLabel"
          onCancel={() => setEditing(false)}
          onSave={async (_theme, goals) => {
            await run('history.saveYearGoals', () => repo.putYearGoals({ id: `${pid}:${year}`, profileId: pid, year, goals }));
            setEditing(false);
          }}
        />
      </section>
    );

  return (
    <section className="card theme-card">
      <div className="card-head">
        <h2>{t('year.goals')}</h2>
        {y?.goals.length ? (
          <button className="icon-btn" aria-label={t('month.edit')} onClick={() => setEditing(true)}>
            <Icon name="edit" size={18} />
          </button>
        ) : null}
      </div>
      {y?.goals.length ? (
        <ol className="goals numbered">
          {y.goals.map((g) => (
            <li key={g} className="hand mid">
              {g}
            </li>
          ))}
        </ol>
      ) : (
        <div className="card-head">
          <span className="muted">{t('year.noGoals')}</span>
          <button className="btn small-btn" onClick={() => setEditing(true)}>
            <Icon name="plus" size={16} /> {t('year.addGoals')}
          </button>
        </div>
      )}
    </section>
  );
}

export function YearView({ date, onOpenMonth }: { date: PlainDateStr; onOpenMonth: (d: PlainDateStr) => void }) {
  const { t } = useT();
  const { profile, data } = useStore();
  const s = profile!.settings;
  const now = useNow(s.timeZone);
  const year = +date.slice(0, 4);
  const byDay = useMemo(() => buildRange(data, `${year}-01-01`, `${year}-12-31`), [data, year]);
  const focusMonth = monthKey(date);

  return (
    <div className="stack">
      <YearGoalsCard year={year} />
      <div className="year-grid">
        {Array.from({ length: 12 }, (_, i) => {
          const month = `${year}-${String(i + 1).padStart(2, '0')}`;
          const theme = data.monthThemes.find((m) => m.month === month)?.theme;
          let done = 0;
          let total = 0;
          let eventDays = 0;
          const cells = monthGrid(month, s.weekStart);
          for (let d = `${month}-01`; monthKey(d) === month; d = addDays(d, 1)) {
            const sum = summarize(byDay.get(d)!);
            if (sum.events || sum.tasks) eventDays++;
            if (d <= now.date && sum.done > 0) {
              done += sum.done;
              total += sum.total;
            }
          }
          const ratio = total ? done / total : null;
          return (
            <motion.button
              key={month}
              className={`ycard${month === monthKey(now.date) ? ' current' : ''}${month === focusMonth ? ' focus' : ''}`}
              onClick={() => onOpenMonth(`${month}-01`)}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.025, type: 'spring', stiffness: 260, damping: 24 }}
            >
              <span className="ycard-head">
                <span className="ycard-name">{formatMonthName(`${month}-01`, s)}</span>
                {ratio !== null && (
                  <span className="ycard-ratio small" title={t('year.monthCompleted', { value: formatPercent(ratio, s) })}>
                    <Ring ratio={ratio} size={22} />
                    {formatPercent(ratio, s)}
                  </span>
                )}
              </span>
              <span className="ycard-theme hand">{theme ?? ''}</span>
              <span className="ymini" aria-hidden>
                {cells.map((d) => {
                  const inMonth = monthKey(d) === month;
                  const sum = inMonth ? summarize(byDay.get(d)!) : null;
                  return (
                    <span
                      key={d}
                      className={`yd${inMonth ? '' : ' out'}${sum && (sum.events || sum.tasks) ? ' ev' : ''}${d === now.date ? ' today' : ''}`}
                    />
                  );
                })}
              </span>
              {eventDays > 0 && <span className="small muted">{t('year.eventDays', { count: eventDays })}</span>}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
