// Çakışma seçenekleri ve önizleme satırları: ekleme ve taşıma akışları ortak kullanır.
import { useMemo } from 'react';
import { useT } from '../../i18n/i18n';
import { useStore } from '../store';
import { freeStarts, suggestDays, type Placed, type Resolution, type Span } from '../../domain/conflicts';
import type { AgendaItem } from '../../domain/agenda';
import { addDays, clock, minutesOfDay } from '../../domain/time';
import type { PlainDateStr } from '../../domain/types';
import { formatClock, formatDayMonth, formatWeekdayShort } from '../format';

export type Choices = Record<string, Resolution | undefined>;

/** Çakışan öğenin kendi günü ve o güne göre başlangıcı/süresi. */
export function home(p: Placed, baseDate: PlainDateStr) {
  const k = Math.floor(p.start / 1440);
  return { date: addDays(baseDate, k), start: p.start - k * 1440, dur: p.end - p.start, off: k * 1440 };
}

/**
 * Her çakışma için öneriler. Yeni/taşınan öğenin saati ve diğer çakışmalar için
 * seçilen yeni saatler dolu sayılır: öneriler yeni çakışma yaratmaz.
 */
export function useSuggestions(
  conflicts: Placed[],
  baseDate: PlainDateStr,
  primary: Span | null,
  choices: Choices,
  ignoreExtra: (i: AgendaItem) => boolean,
) {
  const { data } = useStore();
  return useMemo(
    () =>
      conflicts.map((p, idx) => {
        const h = home(p, baseDate);
        const extraBusy: Span[] = [];
        if (primary) extraBusy.push({ start: primary.start - h.off, end: primary.end - h.off });
        conflicts.forEach((q, j) => {
          const r = choices[q.item.key];
          const hq = home(q, baseDate);
          if (j !== idx && r?.action === 'move' && hq.date === h.date)
            extraBusy.push({ start: minutesOfDay(r.startTime), end: minutesOfDay(r.startTime) + hq.dur });
        });
        const ignore = (i: AgendaItem) => i.key === p.item.key || ignoreExtra(i);
        return {
          moves: freeStarts(data, h.date, h.dur, h.start, { extraBusy, ignore, max: 4 }).filter((m) => m !== h.start),
          days: suggestDays(data, h.date, h.dur, h.start, { ignore, max: 3 }),
        };
      }),
    [conflicts, choices, data, baseDate, primary?.start, primary?.end], // eslint-disable-line
  );
}

export function ConflictChoices(props: {
  conflicts: Placed[];
  baseDate: PlainDateStr;
  primary: Span | null;
  choices: Choices;
  setChoices: (c: Choices) => void;
  ignore: (i: AgendaItem) => boolean;
}) {
  const { t } = useT();
  const { profile } = useStore();
  const s = profile!.settings;
  const { conflicts, choices, baseDate } = props;
  const sug = useSuggestions(conflicts, baseDate, props.primary, choices, props.ignore);
  const choose = (key: string, r: Resolution) => props.setChoices({ ...choices, [key]: r });

  return (
    <>
      <p>{t('conflict.intro')}</p>
      {conflicts.map((p, idx) => {
        const key = p.item.key;
        const res = choices[key];
        const h = home(p, baseDate);
        const time = `${formatClock(clock(h.start), s)}–${formatClock(clock((h.start + h.dur) % 1440), s)}`;
        return (
          <section key={key} className="card conflict">
            <p className="conflict-q">
              <strong>{t('conflict.item', { title: p.item.title, time })}</strong>
            </p>
            {p.item.flex?.protected && <p className="small muted">{t('conflict.protected')}</p>}
            <div className={`opt${res?.action === 'move' ? ' selected' : ''}`}>
              <span className="opt-label">{t('conflict.move')}</span>
              {sug[idx].moves.length ? (
                <div className="chips">
                  {sug[idx].moves.map((m) => {
                    const st = clock(m);
                    const on = res?.action === 'move' && res.startTime === st;
                    return (
                      <button key={m} className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => choose(key, { action: 'move', startTime: st })}>
                        {formatClock(st, s)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span className="small muted">{t('conflict.moveNone')}</span>
              )}
            </div>
            <div className={`opt${res?.action === 'postpone' ? ' selected' : ''}`}>
              <span className="opt-label">{t('conflict.postpone')}</span>
              {sug[idx].days.length ? (
                <div className="chips">
                  {sug[idx].days.map((d) => {
                    const on = res?.action === 'postpone' && res.date === d.date && res.startTime === d.startTime;
                    return (
                      <button
                        key={d.date}
                        className={`chip${on ? ' on' : ''}`}
                        aria-pressed={on}
                        onClick={() => choose(key, { action: 'postpone', date: d.date, startTime: d.startTime })}
                      >
                        {formatWeekdayShort(d.date, s)} {formatDayMonth(d.date, s)} · {formatClock(d.startTime, s)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span className="small muted">{t('conflict.postponeNone')}</span>
              )}
            </div>
            <div className="chips">
              <button className={`chip${res?.action === 'skip' ? ' on' : ''}`} aria-pressed={res?.action === 'skip'} onClick={() => choose(key, { action: 'skip' })}>
                {t(p.item.kind === 'routine' ? 'conflict.skip' : 'conflict.skipEvent')}
              </button>
              <button className={`chip${res?.action === 'keep' ? ' on' : ''}`} aria-pressed={res?.action === 'keep'} onClick={() => choose(key, { action: 'keep' })}>
                {t('conflict.keep')}
              </button>
            </div>
          </section>
        );
      })}
      {conflicts.some((p) => p.item.kind === 'routine') && <p className="small muted">{t('conflict.onlyThisDate')}</p>}
      {!conflicts.every((p) => choices[p.item.key]) && <p className="small muted">{t('conflict.chooseAll')}</p>}
    </>
  );
}

/** Önizleme satırları (çakışma çözümleri). */
export function ResolutionLines({ conflicts, choices, baseDate }: { conflicts: Placed[]; choices: Choices; baseDate: PlainDateStr }) {
  const { t } = useT();
  const { profile } = useStore();
  const s = profile!.settings;
  return (
    <>
      {conflicts.map((p) => {
        const r = choices[p.item.key]!;
        const h = home(p, baseDate);
        const txt =
          r.action === 'move'
            ? t('preview.move', { title: p.item.title, from: formatClock(clock(h.start), s), to: formatClock(r.startTime, s) })
            : r.action === 'postpone'
              ? t('preview.postpone', { title: p.item.title, to: `${formatWeekdayShort(r.date, s)} ${formatDayMonth(r.date, s)} ${formatClock(r.startTime, s)}` })
              : t(r.action === 'skip' ? 'preview.skip' : 'preview.keep', { title: p.item.title });
        return (
          <li key={p.item.key} className={`pv-${r.action}`}>
            {txt}
          </li>
        );
      })}
    </>
  );
}

/** Repo'ya gidecek çözüm listesi (taşınan öğenin günü doğru verilir). */
export const toResolutions = (conflicts: Placed[], choices: Choices, baseDate: PlainDateStr) =>
  conflicts.map((p) => ({ target: { ...p.item, date: home(p, baseDate).date }, resolution: choices[p.item.key]! }));
