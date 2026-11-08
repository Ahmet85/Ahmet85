import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n/i18n';
import { db, repo, useStore } from './store';
import { uid } from '../db/db';
import { BackupError, backupFileName, exportBackup, restoreBackup } from '../db/backup';
import { PALETTE, type PaletteKey } from '../domain/palette';
import type { ProfileSettings, Weekday } from '../domain/types';
import { nowLocal } from '../domain/time';
import { REGIONS, formatClock, formatLongDate, regionName, timeZones, weekdayName } from './format';
import { Icon, ICON_NAMES } from './Icon';
import { Welcome } from './Welcome';
import { appearanceOf, type Appearance, type FontModel, type FontSize, type ThemeName } from '../domain/types';
import { buildProgramIcs } from '../domain/ics';
import { startOfWeek } from '../domain/time';
import { PrintWeek } from './PrintWeek';
import { hashPin, markUnlocked } from './pin';
import { uiSound } from './alarm/sound';
import { requestImport } from './ImportHost';
import { useSheets } from './sheets/SheetHost';
import { alarmPrefs, type AlarmPrefs } from '../domain/types';
import { buildIcs } from '../domain/ics';
import { addDays } from '../domain/time';
import { alarmMessage } from './alarm/messages';
import { playAlarm, playSuccess } from './alarm/sound';
import { PermissionAsk } from './alarm/ReminderPicker';
import { latestNote, notesFor } from '../domain/notes';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function useStoragePersisted() {
  const [state, setState] = useState<boolean | null>(null);
  const refresh = async () => setState((await navigator.storage?.persisted?.()) ?? null);
  useEffect(() => {
    refresh();
  }, []);
  const ask = async () => {
    await navigator.storage?.persist?.();
    await refresh();
  };
  return { state, ask };
}

export function Settings() {
  const { t } = useT();
  const { profiles, profile, run, switchProfile, loadSample, reload, defaults } = useStore();
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const storage = useStoragePersisted();

  const s: ProfileSettings = profile?.settings ?? defaults;
  const setSetting = <K extends keyof ProfileSettings>(k: K, v: ProfileSettings[K]) =>
    profile && run('history.updateProfile', () => repo.updateProfile({ ...profile, settings: { ...profile.settings, [k]: v } }));

  const download = async () => {
    const b = await exportBackup(db);
    const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = backupFileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const restore = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text());
      if (!confirm(t('settings.restoreConfirm'))) return;
      await restoreBackup(db, raw);
      await reload();
      setMessage(t('settings.restoreDone'));
    } catch (e) {
      setMessage(t(e instanceof BackupError && e.code === 'newerVersion' ? 'settings.restoreNewer' : 'settings.restoreInvalid'));
    }
  };

  const now = nowLocal(s.timeZone);

  return (
    <div className="stack">
      <h1 className="page-title">{t('settings.title')}</h1>

      <Section title={t('settings.profiles')}>
        {profiles.length > 0 && (
          <div className="profile-list" role="radiogroup" aria-label={t('settings.activeProfile')}>
            {profiles.map((p) => (
              <label key={p.id} className={`choice row${p.id === profile?.id ? ' selected' : ''}`}>
                <input type="radio" checked={p.id === profile?.id} onChange={() => switchProfile(p.id)} />
                <Icon name="user" size={18} />
                <span>{p.name}</span>
                {p.isSample && <span className="tag">{t('settings.sampleBadge')}</span>}
              </label>
            ))}
          </div>
        )}
        {creating ? (
          <Welcome onDone={() => setCreating(false)} />
        ) : (
          <div className="row-btns">
            <button className="btn" onClick={() => setCreating(true)}>
              <Icon name="plus" size={18} /> {t('settings.newProfile')}
            </button>
            {profile && <PinControl />}
            {profile && (
              <button
                className="btn ghost danger"
                onClick={() =>
                  confirm(t('settings.deleteConfirm', { name: profile.name })) &&
                  run('history.deleteProfile', () => repo.deleteProfile(profile.id), { global: true })
                }
              >
                <Icon name="trash" size={18} /> {t('settings.deleteProfile')}
              </button>
            )}
          </div>
        )}
      </Section>

      {profile && <AppearanceSection />}
      {profile && (
        <Section title={t('settings.region')}>
          <label className="field">
            <span>{t('settings.language')}</span>
            <select value={s.language} onChange={(e) => setSetting('language', e.target.value)}>
              <option value="tr">{t('settings.languageTr')}</option>
            </select>
            <span className="muted small">{t('settings.languageMore')}</span>
          </label>
          <label className="field">
            <span>{t('settings.regionLabel')}</span>
            <select value={s.region} onChange={(e) => setSetting('region', e.target.value)}>
              {[...new Set([s.region, ...REGIONS])].map((r) => (
                <option key={r} value={r}>
                  {regionName(r, s)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('settings.timeZone')}</span>
            <select value={s.timeZone} onChange={(e) => setSetting('timeZone', e.target.value)}>
              {timeZones(s.timeZone).map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('settings.weekStart')}</span>
            <select value={s.weekStart} onChange={(e) => setSetting('weekStart', Number(e.target.value) as Weekday)}>
              {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((w) => (
                <option key={w} value={w}>
                  {weekdayName(w, s)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('settings.hourCycle')}</span>
            <select value={s.hourCycle} onChange={(e) => setSetting('hourCycle', e.target.value as 'h23' | 'h12')}>
              <option value="h23">{t('settings.h23')}</option>
              <option value="h12">{t('settings.h12')}</option>
            </select>
          </label>
          <p className="muted small">
            {t('settings.preview', { value: `${formatLongDate(now.date, s)} · ${formatClock(now.time, s)}` })}
          </p>
        </Section>
      )}

      {profile && <Alarms />}
      {profile && <Categories />}
      {profile && <Projects />}

      {profile && <ExportSection />}
      <Section title={t('settings.backup')}>
        <p className="muted">{t('settings.backupBody')}</p>
        <div className="row-btns">
          <button className="btn" onClick={download}>
            <Icon name="download" size={18} /> {t('settings.backupDownload')}
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={18} /> {t('settings.backupRestore')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) restore(f);
              e.target.value = '';
            }}
          />
        </div>
        {message && <p role="status">{message}</p>}
        <h3>{t('settings.storage')}</h3>
        <p className="muted small">
          {storage.state === null
            ? t('settings.storageUnknown')
            : storage.state
              ? t('settings.storagePersisted')
              : t('settings.storageNotPersisted')}
        </p>
        {storage.state === false && (
          <button className="btn ghost" onClick={storage.ask}>
            {t('settings.storageAsk')}
          </button>
        )}
      </Section>

      <ImportByLink />

      <Section title={t('settings.developer')}>
        <p className="muted small">{t('settings.loadSampleBody')}</p>
        <button className="btn" onClick={loadSample}>
          {t('settings.loadSample')}
        </button>
      </Section>

      <p className="muted small center">
        {t('settings.about', { version: __APP_VERSION__ })}
      </p>
    </div>
  );
}

function Categories() {
  const { t } = useT();
  const { profile, data, run } = useStore();
  const [editing, setEditing] = useState<string | null>(null); // kategori id veya 'new'
  const [name, setName] = useState('');
  const [color, setColor] = useState<PaletteKey>('yesil');
  const [icon, setIcon] = useState('leaf');
  const cats = [...data.categories].sort((a, b) => a.order - b.order);
  const current = cats.find((c) => c.id === editing);

  const open = (id: string | 'new') => {
    const c = cats.find((x) => x.id === id);
    setEditing(id);
    setName(c?.name ?? '');
    setIcon(c?.icon ?? 'leaf');
    setColor((Object.keys(PALETTE) as PaletteKey[]).find((k) => PALETTE[k].bg === c?.color.bg) ?? 'yesil');
  };

  const save = async () => {
    if (!name.trim() || !profile) return;
    await run('history.saveCategory', () =>
      repo.putCategory({
        id: current?.id ?? uid(),
        profileId: profile.id,
        name: name.trim(),
        color: PALETTE[color],
        icon,
        order: current?.order ?? cats.length,
      }),
    );
    setEditing(null);
  };

  const remove = async () => {
    if (!current || !confirm(t('settings.deleteCategoryConfirm', { name: current.name }))) return;
    await run('history.deleteCategory', () => repo.deleteCategory(current));
    setEditing(null);
  };

  return (
    <Section title={t('settings.categories')}>
      {cats.length === 0 && <p className="muted">{t('settings.categoriesEmpty')}</p>}
      <ul className="cat-list">
        {cats.map((c) => (
          <li key={c.id} style={{ background: c.color.bg, color: c.color.fg }}>
            <button aria-label={`${t('settings.editCategory')}: ${c.name}`} onClick={() => open(c.id)}>
              <Icon name={c.icon} size={18} /> {c.name}
            </button>
          </li>
        ))}
      </ul>
      {editing ? (
        <div className="stack">
          <label className="field">
            <span>{t('settings.categoryName')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <div className="swatches" role="radiogroup">
            {(Object.keys(PALETTE) as PaletteKey[]).map((k) => (
              <button
                key={k}
                role="radio"
                aria-checked={color === k}
                aria-label={t(`color.${k}`)}
                className={`swatch${color === k ? ' selected' : ''}`}
                style={{ background: PALETTE[k].bg, color: PALETTE[k].fg }}
                onClick={() => setColor(k)}
              >
                <Icon name={color === k ? 'dot' : 'plus'} size={14} />
              </button>
            ))}
          </div>
          <div className="swatches" role="radiogroup">
            {ICON_NAMES.map((i) => (
              <button
                key={i}
                role="radio"
                aria-checked={icon === i}
                aria-label={t(`icon.${i}`)}
                className={`swatch${icon === i ? ' selected' : ''}`}
                onClick={() => setIcon(i)}
              >
                <Icon name={i} size={18} />
              </button>
            ))}
          </div>
          <div className="row-btns">
            <button className="btn primary" onClick={save}>
              {t('settings.save')}
            </button>
            <button className="btn ghost" onClick={() => setEditing(null)}>
              {t('settings.cancel')}
            </button>
            {current && (
              <button className="btn ghost danger" onClick={remove}>
                <Icon name="trash" size={18} /> {t('settings.deleteCategory')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <button className="btn" onClick={() => open('new')}>
          <Icon name="plus" size={18} /> {t('settings.addCategory')}
        </button>
      )}
    </Section>
  );
}

function Projects() {
  const { t } = useT();
  const { profile, data, run } = useStore();
  const { openProject } = useSheets();
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const projects = [...data.projects].filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name, profile!.settings.language));

  const add = async () => {
    if (!name.trim()) return;
    await run('history.saveProject', () => repo.putProject({ id: uid(), profileId: profile!.id, name: name.trim() }));
    setName('');
    setAdding(false);
  };

  return (
    <Section title={t('project.title')}>
      <p className="muted small">{t('project.intro')}</p>
      {projects.length > 0 && (
        <ul className="project-list">
          {projects.map((p) => {
            const last = latestNote(data.notes, p.id);
            const count = notesFor(data.notes, p.id).length;
            return (
              <li key={p.id}>
                <button onClick={() => openProject(p.id)}>
                  <span className="project-name">{p.name}</span>
                  <span className="small muted">{t('project.noteCount', { count })}</span>
                  {last && <span className="hand project-last">{last.text}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {adding ? (
        <div className="field-row align-end">
          <label className="field">
            <span>{t('project.name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder={t('project.placeholder')} />
          </label>
          <div className="row-btns">
            <button className="btn primary" onClick={add}>
              {t('common.add')}
            </button>
            <button className="btn ghost" onClick={() => setAdding(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> {t('project.add')}
        </button>
      )}
    </Section>
  );
}

function Alarms() {
  const { t } = useT();
  const { profile, data, run } = useStore();
  const p = profile!;
  const prefs = alarmPrefs(p.settings);
  const setPrefs = (patch: Partial<AlarmPrefs>) =>
    run('history.updateProfile', () => repo.updateProfile({ ...p, settings: { ...p.settings, alarm: { ...prefs, ...patch } } }), { undo: false });
  const celebrations = p.settings.celebrations !== false;
  const today = nowLocal(p.settings.timeZone).date;
  const count = data.reminders.length;

  const exportIcs = () => {
    const routineDur = new Map(data.routines.map((r) => [r.id, r.durationMin]));
    const ics = buildIcs(data.reminders, data, {
      from: today,
      to: addDays(today, 30),
      timeZone: p.settings.timeZone,
      calendarName: `${t('app.name')} · ${p.name}`,
      alarmText: (f, off) => alarmMessage(t, f, off),
      durationOf: (f) => (f.source.routineId ? (routineDur.get(f.source.routineId) ?? 30) : 30),
    });
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ritim-alarmlar-${today}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  };

  return (
    <Section title={t('alarmSettings.title')}>
      <div className="field-row">
        <label className="field">
          <span>{t('alarmSettings.sound')}</span>
          <select value={prefs.sound} onChange={(e) => setPrefs({ sound: e.target.value as AlarmPrefs['sound'] })}>
            <option value="bell">{t('alarmSettings.bell')}</option>
            <option value="marimba">{t('alarmSettings.marimba')}</option>
            <option value="silent">{t('alarmSettings.silent')}</option>
          </select>
        </label>
        <label className="field">
          <span>{t('alarmSettings.volume')}</span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.1}
            value={prefs.volume}
            onChange={(e) => setPrefs({ volume: Number(e.target.value) })}
            aria-valuetext={`${Math.round(prefs.volume * 100)}%`}
          />
        </label>
      </div>
      <button className="btn ghost small-btn" onClick={() => playAlarm({ ...prefs, quietFrom: undefined }, 0)}>
        {t('alarmSettings.test')}
      </button>
      <label className="choice">
        <input type="checkbox" checked={prefs.vibrate} onChange={(e) => setPrefs({ vibrate: e.target.checked })} />
        {t('alarmSettings.vibrate')}
      </label>
      <label className="choice">
        <input
          type="checkbox"
          checked={!!prefs.quietFrom}
          onChange={(e) => setPrefs(e.target.checked ? { quietFrom: '23:00', quietTo: '07:00' } : { quietFrom: undefined, quietTo: undefined })}
        />
        {t('alarmSettings.quiet')}
      </label>
      {prefs.quietFrom && (
        <div className="field-row">
          <label className="field">
            <span>{t('alarmSettings.quietFrom')}</span>
            <input type="time" value={prefs.quietFrom} onChange={(e) => e.target.value && setPrefs({ quietFrom: e.target.value })} />
          </label>
          <label className="field">
            <span>{t('alarmSettings.quietTo')}</span>
            <input type="time" value={prefs.quietTo} onChange={(e) => e.target.value && setPrefs({ quietTo: e.target.value })} />
          </label>
        </div>
      )}
      <label className="choice">
        <input
          type="checkbox"
          checked={celebrations}
          onChange={(e) => {
            run('history.updateProfile', () => repo.updateProfile({ ...p, settings: { ...p.settings, celebrations: e.target.checked } }), { undo: false });
            if (e.target.checked) playSuccess(prefs);
          }}
        />
        {t('alarmSettings.celebrations')}
      </label>

      <h3>{t('alarmSettings.closedTitle')}</h3>
      <p className="muted small">{t('alarmSettings.closedBody')}</p>
      <button className="btn" disabled={!count} onClick={exportIcs}>
        <Icon name="download" size={18} /> {t('alarmSettings.export', { count })}
      </button>
      <details className="details">
        <summary>{t('alarmSettings.howTitle')}</summary>
        <ol className="how small">
          <li>{t('alarmSettings.how1')}</li>
          <li>{t('alarmSettings.how2')}</li>
          <li>{t('alarmSettings.how3')}</li>
        </ol>
      </details>
      <h3>{t('alarmSettings.openTitle')}</h3>
      <p className="muted small">{t('alarmSettings.openBody')}</p>
      <PermissionAsk />
    </Section>
  );
}

const THEMES: { id: ThemeName; bg: string; card: string; accent: string; text: string }[] = [
  { id: 'krem', bg: '#F6F0E4', card: '#FBF7EE', accent: '#A9532F', text: '#2E2A24' },
  { id: 'kil', bg: '#F3E6DD', card: '#FAF1EA', accent: '#9E4E30', text: '#33251E' },
  { id: 'zeytin', bg: '#EEEEE1', card: '#F7F7EE', accent: '#5E6B2E', text: '#2A2C21' },
  { id: 'bal', bg: '#F8EFD9', card: '#FDF7E8', accent: '#E0A43A', text: '#33291A' },
  { id: 'gece', bg: '#221D19', card: '#2E2722', accent: '#E08A62', text: '#F3EBDD' },
];
const FONTS: { id: FontModel; family: string }[] = [
  { id: 'samimi', family: 'Nunito' },
  { id: 'defter', family: 'Lora' },
  { id: 'yuvarlak', family: 'Quicksand' },
];

function AppearanceSection() {
  const { t } = useT();
  // Önizlemeler için tüm yazı tiplerini yükle
  useEffect(() => {
    import('@fontsource/lora/400.css');
    import('@fontsource/lora/700.css');
    import('@fontsource/quicksand/400.css');
    import('@fontsource/quicksand/700.css');
  }, []);
  const { profile, run } = useStore();
  const p = profile!;
  const a = appearanceOf(p.settings);
  const set = (patch: Partial<Appearance>) =>
    run('history.updateProfile', () => repo.updateProfile({ ...p, settings: { ...p.settings, appearance: { ...a, ...patch } } }), { undo: false });

  return (
    <Section title={t('look.title')}>
      <fieldset className="field">
        <legend>{t('look.theme')}</legend>
        <div className="theme-grid" role="radiogroup">
          {THEMES.map((th) => (
            <button
              key={th.id}
              role="radio"
              aria-checked={a.theme === th.id}
              className={`theme-swatch${a.theme === th.id ? ' selected' : ''}`}
              style={{ background: th.bg, color: th.text }}
              onClick={() => set({ theme: th.id })}
            >
              <span className="ts-card" style={{ background: th.card }}>
                <span className="ts-dot" style={{ background: th.accent }} />
              </span>
              <span className="ts-name">{t(`look.theme.${th.id}`)}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <label className="choice">
        <input type="checkbox" checked={a.autoNight} onChange={(e) => set({ autoNight: e.target.checked })} />
        <span>
          {t('look.autoNight')}
          <br />
          <span className="small muted">{t('look.autoNightHint')}</span>
        </span>
      </label>

      <fieldset className="field">
        <legend>{t('look.font')}</legend>
        <div className="font-list" role="radiogroup">
          {FONTS.map((f) => (
            <button
              key={f.id}
              role="radio"
              aria-checked={a.font === f.id}
              className={`font-choice${a.font === f.id ? ' selected' : ''}`}
              style={{ fontFamily: `'${f.family}', system-ui` }}
              onClick={() => set({ font: f.id })}
            >
              <strong>{t(`look.font.${f.id}`)}</strong>
              <span className="small">{t('look.fontSample')}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend>{t('look.size')}</legend>
        <div className="seg-control four">
          {(['small', 'normal', 'large', 'xlarge'] as FontSize[]).map((k, i) => (
            <button key={k} className={a.fontSize === k ? 'active' : ''} aria-pressed={a.fontSize === k} onClick={() => set({ fontSize: k })} style={{ fontSize: `${0.8 + i * 0.12}rem` }}>
              {t(`look.size.${k}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <h3>{t('look.motionSound')}</h3>
      <label className="choice">
        <input type="checkbox" checked={a.reduceMotion} onChange={(e) => set({ reduceMotion: e.target.checked })} />
        <span>
          {t('look.reduceMotion')}
          <br />
          <span className="small muted">{t('look.reduceMotionHint')}</span>
        </span>
      </label>
      <label className="choice">
        <input
          type="checkbox"
          checked={a.uiSound}
          onChange={(e) => {
            set({ uiSound: e.target.checked });
          }}
        />
        <span>
          {t('look.uiSound')}
          <br />
          <span className="small muted">{t('look.uiSoundHint')}</span>
        </span>
      </label>
      {a.uiSound && (
        <div className="field-row align-end">
          <label className="field">
            <span>{t('alarmSettings.volume')}</span>
            <input type="range" min={0.1} max={1} step={0.1} value={a.uiVolume} onChange={(e) => set({ uiVolume: Number(e.target.value) })} />
          </label>
          <div className="row-btns">
            <button className="btn ghost small-btn" onClick={() => uiSound('paper')}>
              {t('look.testPaper')}
            </button>
            <button className="btn ghost small-btn" onClick={() => uiSound('tick')}>
              {t('look.testTick')}
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

function ExportSection() {
  const { t } = useT();
  const { profile, data } = useStore();
  const p = profile!;
  const s = p.settings;
  const today = nowLocal(s.timeZone).date;
  const [printing, setPrinting] = useState(false);
  const [weeks, setWeeks] = useState(8);

  const exportProgram = () => {
    const ics = buildProgramIcs(data, {
      from: today,
      to: addDays(today, weeks * 7 - 1),
      timeZone: s.timeZone,
      calendarName: `${t('app.name')} · ${p.name}`,
      categoryName: (id) => data.categories.find((c) => c.id === id)?.name,
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    a.download = `ritim-program-${today}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  };

  return (
    <Section title={t('export.title')}>
      <p className="muted small">{t('export.icsBody')}</p>
      <div className="field-row align-end">
        <label className="field">
          <span>{t('export.weeks')}</span>
          <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
            {[1, 4, 8, 13, 26].map((w) => (
              <option key={w} value={w}>
                {t('export.weeksOpt', { count: w })}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" onClick={exportProgram}>
          <Icon name="download" size={18} /> {t('export.ics')}
        </button>
      </div>
      <p className="muted small">{t('export.printBody')}</p>
      <button className="btn" onClick={() => setPrinting(true)}>
        <Icon name="table" size={18} /> {t('export.print')}
      </button>
      {printing && <PrintWeek weekStart={startOfWeek(today, s.weekStart)} onClose={() => setPrinting(false)} />}
    </Section>
  );
}

function PinControl() {
  const { t } = useT();
  const { profile, run } = useStore();
  const p = profile!;
  const [editing, setEditing] = useState(false);
  const [pin, setPin] = useState('');
  const save = async () => {
    if (!/^\d{4,8}$/.test(pin)) return;
    const pinHash = await hashPin(p.id, pin);
    markUnlocked(p.id);
    await run('pin.saved', () => repo.updateProfile({ ...p, pinHash }), { undo: false });
    setEditing(false);
    setPin('');
  };
  if (editing)
    return (
      <div className="field-row align-end pin-row">
        <label className="field">
          <span>{t('pin.new')}</span>
          <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoFocus />
        </label>
        <button className="btn primary" disabled={!/^\d{4,8}$/.test(pin)} onClick={save}>
          {t('common.save')}
        </button>
        <button className="btn ghost" onClick={() => setEditing(false)}>
          {t('common.cancel')}
        </button>
      </div>
    );
  return p.pinHash ? (
    <button className="btn ghost" onClick={() => run('pin.removed', () => repo.updateProfile({ ...p, pinHash: undefined }), { undo: false })}>
      <Icon name="lock" size={18} /> {t('pin.remove')}
    </button>
  ) : (
    <button className="btn ghost" onClick={() => setEditing(true)}>
      <Icon name="lock" size={18} /> {t('pin.set')}
    </button>
  );
}

function ImportByLink() {
  const { t } = useT();
  const [text, setText] = useState('');
  return (
    <Section title={t('import.sectionTitle')}>
      <p className="muted small">{t('import.sectionBody')}</p>
      <label className="field">
        <span>{t('import.pasteLabel')}</span>
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="https://…#import=…" />
      </label>
      <button className="btn" disabled={!text.trim()} onClick={() => requestImport(text)}>
        <Icon name="upload" size={18} /> {t('import.check')}
      </button>
    </Section>
  );
}
