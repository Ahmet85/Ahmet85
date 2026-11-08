// Önerilen başlangıç kategori renkleri (tarif bölüm 16). Kullanıcı değiştirebilir.
import type { CategoryColor } from './types';

export const PALETTE = {
  yesil: { bg: '#DDE7D9', fg: '#3A5536', accent: '#6F8A6A' },
  kiremit: { bg: '#F3DFD3', fg: '#8A3C1E', accent: '#C2643F' },
  hardal: { bg: '#F5E6C4', fg: '#6E5110', accent: '#D9A93F' },
  mavi: { bg: '#DCE4F0', fg: '#2F4A73', accent: '#7A93B8' },
  lacivert: { bg: '#E1E4EC', fg: '#2F3B57', accent: '#3E4C6B' },
  bej: { bg: '#EDE3D1', fg: '#4A4136', accent: '#C9BB9F' },
} satisfies Record<string, CategoryColor>;

export type PaletteKey = keyof typeof PALETTE;

/**
 * Yeni profil için önerilen kategoriler. Adlar çeviri anahtarıdır; profil
 * oluşturulurken o anki dile çevrilip kaydedilir.
 */
export const SUGGESTED_CATEGORIES: { nameKey: string; color: PaletteKey; icon: string }[] = [
  { nameKey: 'category.suggested.health', color: 'yesil', icon: 'leaf' },
  { nameKey: 'category.suggested.work', color: 'lacivert', icon: 'briefcase' },
  { nameKey: 'category.suggested.learning', color: 'mavi', icon: 'book' },
  { nameKey: 'category.suggested.creative', color: 'kiremit', icon: 'note' },
  { nameKey: 'category.suggested.people', color: 'hardal', icon: 'heart' },
  { nameKey: 'category.suggested.rest', color: 'bej', icon: 'moon' },
];
