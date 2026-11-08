// Çeviri altyapısı. Tüm arayüz metinleri locales/<dil>.json içindedir
// (ICU mesaj biçimi: çoğul ve değişkenli metinler). Yeni dil eklemek için
// yalnızca yeni bir json dosyası eklenir.
import type { ReactNode } from 'react';
import { IntlProvider, useIntl } from 'react-intl';
import tr from '../locales/tr.json';

export type MessageKey = keyof typeof tr;
const catalogs: Record<string, Record<string, string>> = { tr };

export function I18nProvider(props: { language: string; region: string; timeZone: string; children: ReactNode }) {
  const messages = catalogs[props.language] ?? tr;
  return (
    <IntlProvider
      locale={`${props.language}-${props.region}`}
      timeZone={props.timeZone}
      messages={messages}
      defaultLocale="tr"
    >
      {props.children}
    </IntlProvider>
  );
}

export function useT() {
  const intl = useIntl();
  const t = (id: MessageKey | string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values) as string;
  return { t, intl };
}
