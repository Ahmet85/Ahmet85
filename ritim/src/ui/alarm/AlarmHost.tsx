// Uygulama açıkken hatırlatmalar: vakti gelince sevimli bir "dürtme" kartı,
// yumuşak ses, titreşim; arka plandaysa (izin verildiyse) sistem bildirimi.
// Uygulama kapalıyken güvenilir alarm için takvime aktarma (.ics) kullanılır.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n/i18n';
import { db, repo, useStore } from '../store';
import { fireTimes, type FireTime } from '../../domain/reminders';
import { addDays, nowLocal, Temporal } from '../../domain/time';
import { alarmPrefs } from '../../domain/types';
import { formatClock } from '../format';
import { playAlarm, unlockAudio } from './sound';
import { alarmMessage } from './messages';

/** Uygulama bu kadar süre kapalı kaldıysa eski hatırlatmalar bir anda çalmaz */
const STALE_MIN = 10;

interface Due extends FireTime {
  key: string;
  offsetMin: number;
}

export function AlarmHost() {
  const { t } = useT();
  const { profile, data, run } = useStore();
  const [queue, setQueue] = useState<Due[]>([]);
  const fired = useRef<Set<string>>(new Set());
  const snoozes = useRef<{ due: Due; at: number }[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    unlockAudio();
    db.meta.get('firedReminders').then((r) => {
      (r?.value as string[] | undefined)?.forEach((k) => fired.current.add(k));
      loaded.current = true;
    });
  }, []);

  const check = useCallback(() => {
    if (!profile || !loaded.current) return;
    const s = profile.settings;
    const now = nowLocal(s.timeZone);
    const nowMs = Temporal.Now.instant().epochMilliseconds;
    const offsets = new Map(data.reminders.map((r) => [r.id, r.offsetMin]));
    const due: Due[] = [];
    for (const f of fireTimes(data.reminders, data, addDays(now.date, -1), addDays(now.date, 2), s.timeZone)) {
      const ms = f.at.epochMilliseconds;
      const key = `${f.reminderId}|${f.date}|${f.time}`;
      if (ms > nowMs || ms < nowMs - STALE_MIN * 60000 || fired.current.has(key)) continue;
      fired.current.add(key);
      due.push({ ...f, key, offsetMin: offsets.get(f.reminderId) ?? 0 });
    }
    // Ertelenenler
    for (const sn of [...snoozes.current]) {
      if (sn.at <= nowMs) {
        due.push(sn.due);
        snoozes.current = snoozes.current.filter((x) => x !== sn);
      }
    }
    if (!due.length) return;
    db.meta.put({ key: 'firedReminders', value: [...fired.current].slice(-300) });
    const prefs = alarmPrefs(s);
    const nowMin = +now.time.slice(0, 2) * 60 + +now.time.slice(3, 5);
    playAlarm(prefs, nowMin);
    if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker?.ready
        .then((reg) =>
          due.forEach((d) =>
            reg.showNotification(t('app.name'), {
              body: alarmMessage(t, d, d.offsetMin),
              icon: 'icon-192.png',
              tag: d.key,
              silent: prefs.sound === 'silent',
            }),
          ),
        )
        .catch(() => undefined);
    }
    setQueue((q) => [...q, ...due]);
  }, [profile, data, t]);

  useEffect(() => {
    check();
    const id = setInterval(check, 15_000);
    const vis = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [check]);

  const current = queue[0];
  const done = () => setQueue((q) => q.slice(1));

  const started = () => {
    done();
  };
  const snooze = () => {
    snoozes.current.push({ due: current, at: Temporal.Now.instant().epochMilliseconds + 5 * 60000 });
    done();
  };
  const notToday = async () => {
    const src = current.source;
    const pid = profile!.id;
    if (src.routineId) await run('day.skipToast', () => repo.patchOccurrence(pid, src.routineId!, src.originalDate!, { status: 'skipped' }));
    else if (src.eventId) {
      const e = data.events.find((x) => x.id === src.eventId);
      if (e) await run('day.skipToast', () => repo.putEvent({ ...e, status: 'skipped' }));
    } else if (src.taskId) {
      const k = data.tasks.find((x) => x.id === src.taskId);
      if (k) await run('day.skipToast', () => repo.putTask({ ...k, status: 'skipped' }));
    }
    done();
  };

  return (
    <AnimatePresence>
      {current && profile && (
        <motion.div
          key={current.key}
          className="nudge"
          role="alertdialog"
          aria-label={t('alarm.title')}
          initial={{ y: -120, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        >
          <motion.img
            src="icon.svg"
            alt=""
            className="nudge-icon"
            animate={{ rotate: [0, -12, 10, -6, 0] }}
            transition={{ duration: 0.9, delay: 0.25 }}
          />
          <div className="nudge-body">
            <p className="nudge-text">{alarmMessage(t, current, current.offsetMin)}</p>
            <p className="small muted">
              {current.title} · {formatClock(current.time, profile.settings)}
              {queue.length > 1 && ` · ${t('alarm.more', { count: queue.length - 1 })}`}
            </p>
            <div className="nudge-actions">
              <button className="btn primary small-btn" onClick={started}>
                {t('alarm.started')}
              </button>
              <button className="btn small-btn" onClick={snooze}>
                {t('alarm.snooze')}
              </button>
              <button className="btn ghost small-btn" onClick={notToday}>
                {t('day.notToday')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
