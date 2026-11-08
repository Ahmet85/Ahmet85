// Haftanın A4 yatay yazdırılabilir hâli (tarif bölüm 15).
import { createPortal } from 'react-dom';
import { useT } from '../i18n/i18n';
import { useStore } from './store';
import { buildRange } from '../domain/agenda';
import { addDays, monthKey } from '../domain/time';
import type { PlainDateStr } from '../domain/types';
import { formatClock, formatDayMonth, formatRange, formatWeekdayShort } from './format';
import { useCategories } from './hooks';
import { Icon } from './Icon';

export function PrintWeek({ weekStart, onClose }: { weekStart: PlainDateStr; onClose: () => void }) {
  const { t } = useT();
  const { profile, data } = useStore();
  const cats = useCategories();
  const s = profile!.settings;
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const range = buildRange(data, days[0], days[6]);
  const theme = data.monthThemes.find((m) => m.month === monthKey(weekStart))?.theme;

  return createPortal(
    <div className="print-root">
      <div className="print-tools no-print">
        <button className="btn primary" onClick={() => window.print()}>
          <Icon name="download" size={18} /> {t('export.printNow')}
        </button>
        <button className="btn ghost" onClick={onClose}>
          {t('common.close')}
        </button>
        <span className="small muted">{t('export.printHint')}</span>
      </div>
      <div className="print-page">
        <header className="print-head">
          <h1>
            {profile!.name} · {formatRange(days[0], days[6], s)}
          </h1>
          {theme && <p className="hand">{t('day.monthTheme', { theme })}</p>}
        </header>
        <div className="print-grid">
          {days.map((d) => (
            <section key={d} className="print-day">
              <h2>
                {formatWeekdayShort(d, s)} {formatDayMonth(d, s)}
              </h2>
              <ul>
                {range
                  .get(d)!
                  .filter((i) => i.status !== 'cancelled')
                  .map((i) => {
                    const c = i.categoryId ? cats.get(i.categoryId) : undefined;
                    return (
                      <li key={i.key + i.date} style={{ borderInlineStartColor: c?.color.accent ?? '#C9BB9F' }}>
                        <span className="pt">
                          {i.continues ? '…' : i.timed && i.startTime ? formatClock(i.startTime, s) : t('day.allDay')}
                          {i.kind !== 'task' && i.timed && i.endTime ? `–${formatClock(i.endTime, s)}` : ''}
                        </span>{' '}
                        <span className={i.status === 'skipped' ? 'struck' : ''}>{i.title}</span>
                        {i.kind === 'task' && ' ☐'}
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
