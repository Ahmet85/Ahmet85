// Başarı kutlamaları (tarif bölüm 14 ve 17): abartısız, kapatılabilir.
// Küçük: kart mühürlenir + hafif parıltı + kısa ses. Büyük: gün tamamlandı,
// seri dönüm noktası, ara sonrası geri dönüş.
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../i18n/i18n';
import { alarmPrefs } from '../domain/types';
import { useStore } from './store';
import { playSuccess } from './alarm/sound';
import { Icon } from './Icon';

export type Celebration = { kind: 'day' } | { kind: 'streak'; days: number } | { kind: 'comeback' };

interface Ctx {
  /** Küçük kutlama (parıltı + ses) */
  sparkle: () => void;
  /** Büyük kutlama */
  celebrate: (c: Celebration) => void;
}
const C = createContext<Ctx>({ sparkle: () => {}, celebrate: () => {} });
export const useCelebrate = () => useContext(C);

const COLORS = ['#C2643F', '#D9A93F', '#6F8A6A', '#7A93B8', '#C9BB9F'];

export function CelebrateHost({ children }: { children: ReactNode }) {
  const { t } = useT();
  const { profile } = useStore();
  const [big, setBig] = useState<(Celebration & { n: number }) | null>(null);
  const [spark, setSpark] = useState(0);
  const enabled = profile?.settings.celebrations !== false;
  const prefs = alarmPrefs(profile?.settings ?? {});

  const sparkle = useCallback(() => {
    if (!enabled) return;
    playSuccess(prefs);
    setSpark(Date.now());
  }, [enabled, prefs]);

  const celebrate = useCallback(
    (c: Celebration) => {
      if (!enabled) return;
      playSuccess(prefs, true);
      setBig({ ...c, n: Date.now() });
    },
    [enabled, prefs],
  );

  const text =
    big?.kind === 'day' ? t('celebrate.day') : big?.kind === 'comeback' ? t('celebrate.comeback') : big ? t('celebrate.streak', { days: big.days }) : '';

  return (
    <C.Provider value={{ sparkle, celebrate }}>
      {children}
      <AnimatePresence>
        {spark > 0 && (
          <motion.div
            key={spark}
            className="sparkle"
            aria-hidden
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.1, delay: 0.4 }}
            onAnimationComplete={() => setSpark(0)}
          >
            {Array.from({ length: 10 }, (_, i) => (
              <motion.span
                key={i}
                style={{ background: COLORS[i % COLORS.length] }}
                initial={{ x: 0, y: 0, scale: 0.4 }}
                animate={{ x: Math.cos((i / 10) * Math.PI * 2) * 70, y: Math.sin((i / 10) * Math.PI * 2) * 70, scale: 1 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            ))}
          </motion.div>
        )}
        {big && (
          <motion.div
            key={big.n}
            className="celebrate-root"
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setBig(null)}
          >
            <div className="confetti" aria-hidden>
              {Array.from({ length: 36 }, (_, i) => (
                <motion.span
                  key={i}
                  style={{ background: COLORS[i % COLORS.length], left: `${(i * 37) % 100}%` }}
                  initial={{ y: -40, rotate: 0, opacity: 1 }}
                  animate={{ y: '105vh', rotate: (i % 2 ? 1 : -1) * 540, opacity: [1, 1, 0.8] }}
                  transition={{ duration: 2.4 + (i % 5) * 0.25, delay: (i % 9) * 0.06, ease: 'easeIn' }}
                />
              ))}
            </div>
            <motion.div
              className="celebrate-card"
              initial={{ scale: 0.6, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >
              <span className="celebrate-badge" aria-hidden>
                <Icon name={big.kind === 'comeback' ? 'heart' : big.kind === 'day' ? 'sun' : 'leaf'} size={34} />
              </span>
              <p className="hand big">{text}</p>
              <p className="muted">{t(`celebrate.${big.kind}Sub`)}</p>
              <button className="btn primary" onClick={() => setBig(null)}>
                {t('celebrate.thanks')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </C.Provider>
  );
}
