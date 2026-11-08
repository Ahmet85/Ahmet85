// Bağlantıyla program ekleme: adres "#import=..." içeriyorsa ya da Ayarlar'dan
// bir bağlantı yapıştırılırsa, programı önizleyip yeni profil olarak ekler.
import { useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { useT } from '../i18n/i18n';
import { useStore } from './store';
import { codeFromLink, decodePackage, type ProgramPackage } from '../domain/profilePackage';
import { Sheet } from './Sheet';

export const requestImport = (text: string) => window.dispatchEvent(new CustomEvent('ritim:import', { detail: text }));

export function ImportHost() {
  const { t } = useT();
  const { importProgram } = useStore();
  const [pkg, setPkg] = useState<ProgramPackage | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const handle = async (text: string) => {
      const code = codeFromLink(text);
      if (!code) return setError(true);
      try {
        setPkg(await decodePackage(code));
        setError(false);
      } catch {
        setError(true);
      }
    };
    if (location.hash.startsWith('#import=')) {
      handle(location.hash);
      // Bağlantıdaki programı adres çubuğunda bırakma
      history.replaceState(null, '', location.pathname + location.search);
    }
    const on = (e: Event) => handle((e as CustomEvent<string>).detail);
    window.addEventListener('ritim:import', on);
    return () => window.removeEventListener('ritim:import', on);
  }, []);

  const close = () => {
    setPkg(null);
    setError(false);
  };
  const days = (p: ProgramPackage) => new Set(p.routines.flatMap((r) => r.days)).size;

  return (
    <AnimatePresence>
      {(pkg || error) && (
        <Sheet title={t('import.title')} onClose={close}>
          {pkg ? (
            <div className="stack">
              <p className="hand big">{pkg.name}</p>
              <p>{t('import.summary', { blocks: pkg.routines.length, categories: pkg.categories.length, days: days(pkg) })}</p>
              <ul className="cat-list">
                {pkg.categories.map((c) => (
                  <li key={c.key} style={{ background: c.color.bg, color: c.color.fg }}>
                    {c.name}
                  </li>
                ))}
              </ul>
              <p className="small muted">{t('import.note')}</p>
              <div className="row-btns">
                <button
                  className="btn primary"
                  onClick={async () => {
                    await importProgram(pkg);
                    close();
                  }}
                >
                  {t('import.add')}
                </button>
                <button className="btn ghost" onClick={close}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="stack">
              <p className="error">{t('import.invalid')}</p>
              <button className="btn" onClick={close}>
                {t('common.close')}
              </button>
            </div>
          )}
        </Sheet>
      )}
    </AnimatePresence>
  );
}
