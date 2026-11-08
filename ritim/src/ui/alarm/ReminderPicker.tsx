// Hatırlatma zamanı seçici (tam vaktinde, 5/10/15/30 dk önce, özel; görevde
// 1 gün önce) ve bildirim izni kartı (ilk ihtiyaç anında, nedeniyle).
import { useState } from 'react';
import { useT } from '../../i18n/i18n';
import { Icon } from '../Icon';

export const OFFSETS = [0, 5, 10, 15, 30];

export function ReminderPicker({
  existing = [],
  dayBefore,
  onPick,
  noLabel,
  onNo,
}: {
  existing?: number[];
  dayBefore?: boolean;
  onPick: (offset: number) => void;
  noLabel?: boolean;
  onNo?: () => void;
}) {
  const { t } = useT();
  const [custom, setCustom] = useState(false);
  const [min, setMin] = useState('45');
  const opts = [...OFFSETS, ...(dayBefore ? [1440] : [])].filter((m) => !existing.includes(m));
  return (
    <div className="stack">
      <div className="chips big">
        {noLabel && (
          <button className="chip" onClick={onNo}>
            {t('reminder.no')}
          </button>
        )}
        {opts.map((m) => (
          <button key={m} className="chip" onClick={() => onPick(m)}>
            {!noLabel && <Icon name="plus" size={14} />} {t('reminder.offset', { offset: m })}
          </button>
        ))}
        <button className={`chip${custom ? ' on' : ''}`} aria-pressed={custom} onClick={() => setCustom(!custom)}>
          {t('reminder.custom')}
        </button>
      </div>
      {custom && (
        <div className="field-row align-end">
          <label className="field">
            <span>{t('reminder.customLabel')}</span>
            <input type="number" inputMode="numeric" min={0} max={10080} value={min} onChange={(e) => setMin(e.target.value)} />
          </label>
          <button className="btn primary" onClick={() => onPick(Math.max(0, Math.min(10080, Math.round(Number(min) || 0))))}>
            {t('common.add')}
          </button>
        </div>
      )}
    </div>
  );
}

/** Bildirim izni: yalnızca gerektiğinde ve nedeni açıklanarak istenir. */
export function PermissionAsk() {
  const { t } = useT();
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [perm, setPerm] = useState(supported ? Notification.permission : 'unsupported');
  if (perm === 'granted') return null;
  return (
    <div className="perm-card">
      <Icon name="clock" size={20} />
      <div>
        <p className="small">{t(perm === 'denied' ? 'perm.denied' : perm === 'unsupported' ? 'perm.unsupported' : 'perm.why')}</p>
        {perm === 'default' && (
          <button className="btn small-btn" onClick={async () => setPerm(await Notification.requestPermission())}>
            {t('perm.allow')}
          </button>
        )}
      </div>
    </div>
  );
}
