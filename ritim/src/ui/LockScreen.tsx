// PIN'li profil için kilit ekranı.
import { useState } from 'react';
import { useT } from '../i18n/i18n';
import { useStore } from './store';
import { checkPin, markUnlocked } from './pin';
import { Icon } from './Icon';

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useT();
  const { profile, profiles, switchProfile } = useStore();
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const p = profile!;
  const others = profiles.filter((x) => x.id !== p.id);

  const open = async () => {
    if (await checkPin(p.id, p.pinHash!, pin)) {
      markUnlocked(p.id);
      onUnlock();
    } else {
      setWrong(true);
      setPin('');
      navigator.vibrate?.([40, 40, 40]);
    }
  };

  return (
    <section className="card lock">
      <span className="lock-icon" aria-hidden>
        <Icon name="lock" size={30} />
      </span>
      <h1>{t('pin.title', { name: p.name })}</h1>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          open();
        }}
      >
        <label className="field">
          <span>{t('pin.enter')}</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={8}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''));
              setWrong(false);
            }}
            autoFocus
          />
        </label>
        {wrong && (
          <p className="error" role="alert">
            {t('pin.wrong')}
          </p>
        )}
        <button className="btn primary" disabled={pin.length < 4}>
          {t('pin.open')}
        </button>
      </form>
      {others.length > 0 && (
        <div className="stack">
          <span className="small muted">{t('pin.other')}</span>
          <div className="chips">
            {others.map((o) => (
              <button key={o.id} className="chip" onClick={() => switchProfile(o.id)}>
                {o.pinHash && <Icon name="lock" size={14} />} {o.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="small muted">{t('pin.note')}</p>
    </section>
  );
}
