// İnce çizgili, kodla çizilen ikonlar (emoji yok). Görsel dosya gerekmez.
const PATHS: Record<string, string> = {
  sun: 'M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  leaf: 'M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7',
  briefcase: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  note: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z',
  moon: 'M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5z',
  heart: 'M12 19s-7-4.4-7-9.5A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 2.5C19 14.6 12 19 12 19z',
  book: 'M5 5h5a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H5zM19 5h-5a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h5z',
  left: 'M14.5 6l-6 6 6 6',
  right: 'M9.5 6l6 6-6 6',
  today: 'M5 6h14v13H5zM5 10h14M9 4v4M15 4v4M11 14h2v2h-2z',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
  undo: 'M9 7L5 11l4 4M5 11h9a5 5 0 0 1 0 10h-2',
  lock: 'M7 11h10v8H7zM9 11V8a3 3 0 0 1 6 0v3',
  download: 'M12 4v11M7 10l5 5 5-5M5 19h14',
  upload: 'M12 15V4M7 9l5-5 5 5M5 19h14',
  plus: 'M12 5v14M5 12h14',
  clock: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM12 8v4l3 2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12',
  close: 'M6 6l12 12M18 6L6 18',
  dot: 'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
};

export const ICON_NAMES = ['sun', 'leaf', 'briefcase', 'note', 'moon', 'heart', 'book', 'clock', 'user'];

export function Icon({ name, size = 22, label }: { name: string; size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name] ?? PATHS.dot} />
    </svg>
  );
}
