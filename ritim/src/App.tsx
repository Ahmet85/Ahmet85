import { useEffect, useState } from 'react';
import { I18nProvider, useT } from './i18n/i18n';
import { StoreProvider, useStore } from './ui/store';
import { Today } from './ui/Today';
import { Settings } from './ui/Settings';
import { Welcome } from './ui/Welcome';
import { Icon } from './ui/Icon';

type Tab = 'today' | 'settings';

function Shell() {
  const { t } = useT();
  const { ready, profile, toast, undo, dismissToast } = useStore();
  const [tab, setTab] = useState<Tab>('today');

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(dismissToast, 6000);
    return () => clearTimeout(id);
  }, [toast, dismissToast]);

  if (!ready) return null;

  return (
    <div className="app">
      <main className="content">
        {tab === 'today' && (profile ? <Today key={profile.id} /> : <Welcome />)}
        {tab === 'settings' && <Settings />}
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
            ['settings', 'settings', 'nav.settings'],
          ] as const
        ).map(([id, icon, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} aria-current={tab === id} onClick={() => setTab(id)}>
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
  return (
    <I18nProvider language={s.language} region={s.region} timeZone={s.timeZone}>
      <Shell />
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
