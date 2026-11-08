// Renk modeli, yazı tipi, yazı boyutu, hareket ve arayüz sesleri (tarif bölüm 15–17).
import { useEffect } from 'react';
import { appearanceOf, type Appearance, type ProfileSettings } from '../domain/types';
import { useMedia } from './hooks';

const FONT_SIZES = { small: '15px', normal: '17px', large: '19px', xlarge: '21px' };
const THEME_BG = { krem: '#F6F0E4', kil: '#F3E6DD', zeytin: '#EEEEE1', bal: '#F8EFD9', gece: '#221D19' };

// Yazı tipleri yalnızca seçilince yüklenir
const fontLoaders: Record<string, () => Promise<unknown>> = {
  defter: () => Promise.all([import('@fontsource/lora/400.css'), import('@fontsource/lora/600.css'), import('@fontsource/lora/700.css')]),
  yuvarlak: () =>
    Promise.all([import('@fontsource/quicksand/400.css'), import('@fontsource/quicksand/600.css'), import('@fontsource/quicksand/700.css')]),
};

/** Arayüz seslerinin şu anki tercihi (ses modülü buradan okur) */
export let currentAppearance: Appearance = appearanceOf({});

export function useApplyAppearance(settings: ProfileSettings) {
  const a = appearanceOf(settings);
  const systemDark = useMedia('(prefers-color-scheme: dark)');
  const theme = a.autoNight && systemDark ? 'gece' : a.theme;
  currentAppearance = a;
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = theme;
    html.dataset.font = a.font;
    html.style.setProperty('--fs', FONT_SIZES[a.fontSize]);
    if (a.reduceMotion) html.dataset.reduceMotion = '';
    else delete html.dataset.reduceMotion;
    fontLoaders[a.font]?.().catch(() => undefined);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', THEME_BG[theme]));
  }, [theme, a.font, a.fontSize, a.reduceMotion]);
  return { ...a, effectiveTheme: theme };
}
