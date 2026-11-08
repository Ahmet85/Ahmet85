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

      {profile && <Categories />}

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
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<PaletteKey>('yesil');
  const [icon, setIcon] = useState('leaf');
  const cats = [...data.categories].sort((a, b) => a.order - b.order);

  const save = async () => {
    if (!name.trim() || !profile) return;
    await run('history.saveCategory', () =>
      repo.putCategory({
        id: uid(),
        profileId: profile.id,
        name: name.trim(),
        color: PALETTE[color],
        icon,
        order: cats.length,
      }),
    );
    setName('');
    setAdding(false);
  };

  return (
    <Section title={t('settings.categories')}>
      {cats.length === 0 && <p className="muted">{t('settings.categoriesEmpty')}</p>}
      <ul className="cat-list">
        {cats.map((c) => (
          <li key={c.id} style={{ background: c.color.bg, color: c.color.fg }}>
            <Icon name={c.icon} size={18} /> {c.name}
          </li>
        ))}
      </ul>
      {adding ? (
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
            <button className="btn ghost" onClick={() => setAdding(false)}>
              {t('settings.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> {t('settings.addCategory')}
        </button>
      )}
    </Section>
  );
}
