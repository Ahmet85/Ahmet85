// "Gün ve saati değiştir" (sürükleyemeyenler için) ve sürükle-bırakta
// çakışma çıkarsa açılan akış: form → çakışma seçenekleri → önizleme → onay.
import { useState } from 'react';
import { useT } from '../../i18n/i18n';
import { repo, useStore } from '../store';
import { findConflicts, type Placed } from '../../domain/conflicts';
import type { AgendaItem, AgendaSource } from '../../domain/agenda';
import type { Scope } from '../../domain/moves';
import { clock, localEnd, minutesOfDay } from '../../domain/time';
import { formatClock, formatDayMonth, formatWeekdayShort } from '../format';
import { Sheet } from '../Sheet';
import { ConflictChoices, ResolutionLines, toResolutions, type Choices } from './ConflictParts';

export interface MoveTo {
  date: string;
  startTime?: string;
  durationMin: number;
}

const durationOf = (i: AgendaItem) => (i.kind === 'task' ? 0 : i.endMin - i.startMin);

/** Taşınan öğenin yeni yerindeki çakışmalar (kendisi hariç). */
export function moveConflicts(data: AgendaSource, item: AgendaItem, to: MoveTo): Placed[] {
  if (item.kind === 'task' || !to.startTime) return [];
  const start = minutesOfDay(to.startTime);
  return findConflicts(data, to.date, { start, end: start + to.durationMin }, (i) => i.key === item.key);
}

export function MoveFlow({ item, to: initialTo, onClose }: { item: AgendaItem; to?: MoveTo; onClose: () => void }) {
  const { t } = useT();
  const { profile, data, run } = useStore();
  const s = profile!.settings;
  const dur0 = durationOf(item);

  const [date, setDate] = useState(initialTo?.date ?? item.date);
  const [start, setStart] = useState(initialTo?.startTime ?? item.startTime ?? '');
  const [end, setEnd] = useState(() => {
    const st = initialTo?.startTime ?? item.startTime;
    return st ? clock((minutesOfDay(st) + (initialTo?.durationMin ?? dur0)) % 1440) : '';
  });
  const [scope, setScope] = useState<Scope>('one');
  const [step, setStep] = useState<'form' | 'conflicts' | 'preview'>(initialTo ? 'conflicts' : 'form');
  const [choices, setChoices] = useState<Choices>({});

  const to: MoveTo =
    item.kind === 'task'
      ? { date, startTime: start || undefined, durationMin: 0 }
      : { date, startTime: start || undefined, durationMin: start && end ? ((minutesOfDay(end) - minutesOfDay(start) + 1440) % 1440) || 1440 : dur0 };
  const conflicts = moveConflicts(data, item, to);
  const span = to.startTime ? { start: minutesOfDay(to.startTime), end: minutesOfDay(to.startTime) + to.durationMin } : null;
  const allChosen = conflicts.every((p) => choices[p.item.key]);

  const apply = async () => {
    await run('move.done', () => repo.moveItem(profile!.id, item, to, scope, toResolutions(conflicts, choices, date)));
    onClose();
  };

  const next = () => (conflicts.length ? setStep('conflicts') : apply());

  const whenTxt = (d: string, st?: string, du?: number) => {
    const base = `${formatWeekdayShort(d, s)} ${formatDayMonth(d, s)}`;
    if (!st) return base;
    const e = localEnd(d, st, du ?? 0);
    return `${base} ${formatClock(st, s)}${du ? `–${formatClock(e.time, s)}` : ''}${e.date !== d ? ` (${t('day.endsNextDay')})` : ''}`;
  };

  return (
    <Sheet title={step === 'form' ? t('move.title') : step === 'conflicts' ? t('conflict.title') : t('preview.title')} onClose={onClose}>
      {step === 'form' && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
        >
          <p className="muted">{item.title}</p>
          <label className="field">
            <span>{t('add.date')}</span>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
          {item.timed && (
            <div className="field-row">
              <label className="field">
                <span>{t('add.start')}</span>
                <input type="time" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
              </label>
              {item.kind !== 'task' && (
                <label className="field">
                  <span>{t('add.end')}</span>
                  <input type="time" value={end} onChange={(e) => e.target.value && setEnd(e.target.value)} />
                </label>
              )}
            </div>
          )}
          {item.kind === 'routine' && (
            <fieldset className="field">
              <legend>{t('move.scope')}</legend>
              <label className="choice">
                <input type="radio" checked={scope === 'one'} onChange={() => setScope('one')} />
                {t('move.scopeOne')}
              </label>
              <label className="choice">
                <input type="radio" checked={scope === 'future'} onChange={() => setScope('future')} />
                {t('move.scopeFuture')}
              </label>
            </fieldset>
          )}
          <div className="row-btns">
            <button type="submit" className="btn primary">
              {t('common.save')}
            </button>
            <button type="button" className="btn ghost" onClick={onClose}>
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {step === 'conflicts' && (
        <div className="stack">
          <p className="muted">{t('move.summary', { title: item.title, when: whenTxt(to.date, to.startTime, to.durationMin) })}</p>
          <ConflictChoices conflicts={conflicts} baseDate={to.date} primary={span} choices={choices} setChoices={setChoices} ignore={(i) => i.key === item.key} />
          <div className="row-btns">
            <button className="btn primary" disabled={!allChosen} onClick={() => setStep('preview')}>
              {t('conflict.toPreview')}
            </button>
            <button className="btn ghost" onClick={() => (initialTo ? onClose() : setStep('form'))}>
              {t(initialTo ? 'common.cancel' : 'common.back')}
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="stack">
          <p className="muted">{t('preview.intro')}</p>
          <ul className="preview-list">
            <li className="pv-add">
              {t('move.previewMain', {
                title: item.title,
                from: whenTxt(item.date, item.continues ? undefined : item.startTime, dur0),
                to: whenTxt(to.date, to.startTime, to.durationMin),
              })}
              {item.kind === 'routine' && <div className="small muted">{t(scope === 'one' ? 'move.scopeOne' : 'move.scopeFuture')}</div>}
            </li>
            <ResolutionLines conflicts={conflicts} choices={choices} baseDate={to.date} />
          </ul>
          <div className="row-btns">
            <button className="btn primary" onClick={apply}>
              {t('preview.confirm')}
            </button>
            <button className="btn ghost" onClick={() => setStep('conflicts')}>
              {t('common.back')}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** Sürükle-bırak sonrası: çakışma yoksa hemen uygula (Geri al ile), varsa seçenekleri aç. */
export function useDropMove(openMove: (item: AgendaItem, to: MoveTo) => void) {
  const { profile, data, run } = useStore();
  return async (item: AgendaItem, to: MoveTo) => {
    const same = to.date === item.date && to.startTime === item.startTime && to.durationMin === durationOf(item);
    if (same) return;
    if (moveConflicts(data, item, to).length) return openMove(item, to);
    await run(item.kind === 'routine' ? 'move.doneOne' : 'move.done', () => repo.moveItem(profile!.id, item, to, 'one'));
  };
}
