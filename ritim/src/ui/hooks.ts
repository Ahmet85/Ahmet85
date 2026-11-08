import { useEffect, useMemo, useState } from 'react';
import { nowLocal, minutesOfDay } from '../domain/time';
import type { Category } from '../domain/types';
import { useStore } from './store';

/** Profil saat dilimindeki "şimdi" (her 20 sn'de bir yenilenir). */
export function useNow(timeZone: string) {
  const [now, setNow] = useState(() => nowLocal(timeZone));
  useEffect(() => {
    const tick = () => setNow(nowLocal(timeZone));
    tick();
    const id = setInterval(tick, 20_000);
    const vis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [timeZone]);
  return { ...now, minutes: minutesOfDay(now.time) };
}

export function useMedia(query: string) {
  const [match, setMatch] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

export function useCategories() {
  const { data } = useStore();
  return useMemo(() => new Map<string, Category>(data.categories.map((c) => [c.id, c])), [data.categories]);
}

/** Tarayıcı belleğinde küçük tercihler (gizli pencerede sessizce çalışmaz). */
export function usePref<T extends string>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      return (localStorage.getItem(`ritim.${key}`) as T) ?? initial;
    } catch {
      return initial;
    }
  });
  const set = (x: T) => {
    setV(x);
    try {
      localStorage.setItem(`ritim.${key}`, x);
    } catch {
      /* yok say */
    }
  };
  return [v, set];
}
