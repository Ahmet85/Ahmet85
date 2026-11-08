import { useEffect, useState } from 'react';
import { I18nProvider, useT } from './i18n/i18n';
import { StoreProvider, useStore } from './ui/store';
import { Calendar } from './ui/Calendar';
import { SheetHost } from './ui/sheets/SheetHost';
import { CelebrateHost } from './ui/Celebrate';
import { AlarmHost } from './ui/alarm/AlarmHost';
import { Report } from './ui/Report';
import { useApplyAppearance } from './ui/appearance';
import { LockScreen } from './ui/LockScreen';
import { isUnlocked } from './ui/pin';
import { uiSound } from './ui/alarm/sound';
import { MotionConfig } from 'motion/react';
import { Settings } from './ui/Settings';
import { Welcome } from './ui/Welcome';
import { Icon } from './ui/Icon';

type Tab = 'today' | 'report' | 'settings';

function Shell() {
  const { t } = useT();
  const { ready, profile, toast, undo, dismissToast } = useStore();
  const [tab, setTab] = useState<Tab>('today');
  const [, setUnlockTick] = useState(0);
  // Başka ekranlardan sekme değiştirme (ör. "Karnen hazır" kartı)
  useEffect(() => {
    const on = (e: Event) => setTab((e as CustomEvent<Tab>).detail);
    window.addEventListener('ritim:tab', on);
    return () => window.removeEventListener('ritim:tab', on);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(dismissToast, 6000);
    return () => clearTimeout(id);
  }, [toast, dismissToast]);

  if (!ready) return null;
  if (profile?.pinHash && !isUnlocked(profile.id))
    return (
      <div className="app">
        <main className="content">
          <LockScreen onUnlock={() => setUnlockTick((n) => n + 1)} />
        </main>
      </div>
    );

  return (
    <div className="app">
      <main className="content">
        {tab === 'today' && (profile ? <Calendar key={profile.id} /> : <Welcome />)}
        {tab === 'report' &&
          (profile ? (
            <SheetHost>
              <Report key={profile.id} />
            </SheetHost>
          ) : (
            <Welcome />
          ))}
        {tab === 'settings' && (
          <SheetHost>
            <Settings />
          </SheetHost>
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          <span>{t(toast.key)}</span>
          {toast.undo && (
            <button className="btn small-btn" onClick={undo}>
              <Icon name="undo" size={16} /> {t('undo.action')}
            </button>
          )}
          <button className="icon-btn" aria-label="×" onClick={dismissToast}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      <nav className="tabbar" aria-label={t('app.name')}>
        {(
          [
            ['today', 'today', 'nav.today'],
            ['report', 'ring', 'nav.report'],
            ['settings', 'settings', 'nav.settings'],
          ] as const
        ).map(([id, icon, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} aria-current={tab === id} onClick={() => {
              if (tab !== id) uiSound('tick');
              setTab(id);
            }}>
            <Icon name={icon} />
            <span>{t(label)}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function WithIntl() {
  const { profile, defaults } = useStore();
  const s = profile?.settings ?? defaults;
  const look = useApplyAppearance(s);
  return (
    <I18nProvider language={s.language} region={s.region} timeZone={s.timeZone}>
      {/* Sistemde "hareketi azalt" açıksa animasyonlar sade geçişe döner */}
      <MotionConfig reducedMotion={look.reduceMotion ? 'always' : 'user'}>
        <CelebrateHost>
          <Shell />
          {profile && (!profile.pinHash || isUnlocked(profile.id)) && <AlarmHost key={profile.id} />}
        </CelebrateHost>
      </MotionConfig>
    </I18nProvider>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <WithIntl />
    </StoreProvider>
  );
}
