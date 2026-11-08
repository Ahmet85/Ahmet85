// "Günüm değişti" (tarif bölüm 9): neden → (isteğe bağlı) müsait olunan saat →
// önerilen düzen (her öğe değiştirilebilir) → onay → "Geri al".
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useT } from '../../i18n/i18n';
import { repo, useStore } from '../store';
import { replan, type Lock, type PlanEntry, type Reason } from '../../domain/replan';
import { clock, minutesOfDay } from '../../domain/time';
import { formatClock, formatDayMonth, formatWeekdayShort } from '../format';
import { useNow } from '../hooks';
import { Icon } from '../Icon';
import { Sheet } from '../Sheet';

const REASONS: Reason[] = ['work', 'tired', 'urgent', 'other'];

export function ReplanFlow({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const { profile, data, run } = useStore();
  const s = profile!.settings;
  const now = useNow(s.timeZone);
  const [reason, setReason] = useState<Reason | null>(null);
  const [useFrom, setUseFrom] = useState(false);
  const [from, setFrom] = useState(clock(Math.min(Math.ceil((now.minutes + 30) / 30) * 30, 23 * 60)));
  const [step, setStep] = useState<'reason' | 'plan'>('reason');
  const [locks, setLocks] = useState<Record<string, Lock>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);

  const plan = useMemo(
    () =>
      reason
        ? replan({
            src: data,
            date: now.date,
            nowMin: now.minutes,
            availableFrom: useFrom ? minutesOfDay(from) : undefined,
            reason,
            locks,
          })
        : [],
    [data, now.date, now.minutes, reason, useFrom, from, locks],
  );
  const flex = plan.filter((e) => !e.anchor);
  const changes = flex.filter((e) => e.decision.action !== 'keep');

  const fmt = (m: number) => formatClock(clock(((m % 1440) + 1440) % 1440), s);
  const decisionText = (e: PlanEntry) => {
    const d = e.decision;
    const orig = fmt(e.item.startMin);
    switch (d.action) {
      case 'keep':
        return e.anchor ? t(e.item.flex?.protected ? 'replan.protected' : 'replan.fixed') : t('replan.keep', { time: orig });
      case 'move':
        return t('replan.move', { from: orig, to: fmt(d.start) });
      case 'shorten':
        return t('replan.shorten', { version: d.version.title, time: fmt(d.start) });
      case 'postpone':
        return t('replan.postpone', { when: `${formatWeekdayShort(d.date, s)} ${formatDayMonth(d.date, s)} ${formatClock(d.startTime, s)}` });
      case 'skip':
        return t('replan.skip');
    }
  };

  const setLock = (key: string, l: Lock | null) => {
    const next = { ...locks };
    if (l) next[key] = l;
    else delete next[key];
    setLocks(next);
  };

  const apply = async () => {
    await run('replan.applied', () => repo.applyReplan(profile!.id, plan));
    onClose();
  };

  return (
    <Sheet title={t('day.dayChanged')} onClose={onClose}>
      {step === 'reason' && (
        <div className="stack">
          <p>{t('replan.ask')}</p>
          <div className="chips big">
            {REASONS.map((r) => (
              <button key={r} className={`chip${reason === r ? ' on' : ''}`} aria-pressed={reason === r} onClick={() => {
                  setReason(r);
                  setLocks({});
                }}>
                {t(`replan.reason.${r}`)}
              </button>
            ))}
          </div>
          <label className="choice">
            <input type="checkbox" checked={useFrom} onChange={(e) => setUseFrom(e.target.checked)} />
            {t('replan.availableFrom')}
          </label>
          {useFrom && (
            <label className="field">
              <span>{t('replan.fromLabel')}</span>
              <input type="time" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
            </label>
          )}
          <div className="row-btns">
            <button className="btn primary" disabled={!reason} onClick={() => setStep('plan')}>
              {t('replan.suggest')}
            </button>
            <button className="btn ghost" onClick={onClose}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {step === 'plan' && reason && (
        <div className="stack">
          <p className={`hand mid tone-${reason}`}>{t(`replan.tone.${reason}`)}</p>
          {flex.length === 0 ? (
            <p className="muted">{t('replan.nothing')}</p>
          ) : (
            <p className="small muted">{t('replan.summary', { count: changes.length })}</p>
          )}
          <ol className="replan-list">
            {plan.map((e) => (
              <motion.li
                key={e.item.key}
                layout
                className={`replan-row ${e.anchor ? 'anchor' : `act-${e.decision.action}`}`}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <button
                  className="replan-head"
                  disabled={e.anchor}
                  aria-expanded={e.anchor ? undefined : openKey === e.item.key}
                  onClick={() => setOpenKey(openKey === e.item.key ? null : e.item.key)}
                >
                  <span className="replan-title">
                    {e.anchor && <Icon name="lock" size={14} />} {e.item.title}
                    {e.locked && <span className="tag">{t('replan.yourChoice')}</span>}
                  </span>
                  <span className="replan-dec">
                    {decisionText(e)}
                    {!e.anchor && <Icon name={openKey === e.item.key ? 'up' : 'down'} size={16} />}
                  </span>
                </button>
                {!e.anchor && openKey === e.item.key && (
                  <div className="chips small-chips" role="group" aria-label={e.item.title}>
                    {(
                      [
                        [null, 'replan.opt.auto'],
                        ['place', 'replan.opt.place'],
                        ...(e.item.shortVersions.length ? [['shorten', 'replan.opt.shorten']] : []),
                        ['postpone', 'replan.opt.postpone'],
                        ['skip', 'replan.opt.skip'],
                      ] as [Lock | null, string][]
                    ).map(([l, label]) => {
                      const on = (e.locked ?? null) === l;
                      return (
                        <button key={label} className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setLock(e.item.key, l)}>
                          {t(label)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.li>
            ))}
          </ol>
          <p className="small muted">{t('replan.note')}</p>
          <div className="row-btns">
            <button className="btn primary" disabled={!changes.length} onClick={apply}>
              {t('preview.confirm')}
            </button>
            <button className="btn ghost" onClick={() => setStep('reason')}>
              {t('common.back')}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
