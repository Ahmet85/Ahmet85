import { useState } from 'react';
import { useT } from '../i18n/i18n';
import { useStore } from './store';
import { PALETTE, SUGGESTED_CATEGORIES } from '../domain/palette';

export function Welcome({ onDone }: { onDone?: () => void }) {
  const { t } = useT();
  const { createProfile } = useStore();
  const [name, setName] = useState('');
  const [withSuggested, setWithSuggested] = useState(true);

  const submit = async () => {
    const cats = withSuggested
      ? SUGGESTED_CATEGORIES.map((c, i) => ({ name: t(c.nameKey), color: PALETTE[c.color], icon: c.icon, order: i }))
      : [];
    await createProfile(name.trim() || t('app.name'), cats);
    onDone?.();
  };

  return (
    <section className="card welcome">
      <p className="hand big">{t('welcome.title')}</p>
      <p>{t('welcome.body')}</p>
      <label className="field">
        <span>{t('welcome.nameLabel')}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('welcome.namePlaceholder')} />
      </label>
      <fieldset className="field">
        <legend>{t('welcome.startWith')}</legend>
        <label className="choice">
          <input type="radio" checked={withSuggested} onChange={() => setWithSuggested(true)} />
          {t('welcome.withSuggested')}
        </label>
        <label className="choice">
          <input type="radio" checked={!withSuggested} onChange={() => setWithSuggested(false)} />
          {t('welcome.empty')}
        </label>
      </fieldset>
      <button className="btn primary" onClick={submit}>
        {t('welcome.create')}
      </button>
      <p className="muted small">{t('welcome.sampleHint')}</p>
    </section>
  );
}
