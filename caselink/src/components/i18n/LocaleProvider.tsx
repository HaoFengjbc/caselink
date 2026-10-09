'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { labels } from '@/lib/i18n/en';
import { intakeCopies } from '@/lib/i18n/intake';
import { htmlLang, LOCALE_COOKIE, type Locale } from '@/lib/i18n/locale';
import { ui } from '@/lib/i18n/ui';

const LocaleContext = createContext<{ locale: Locale; setLocale: (next: Locale) => void }>({ locale: 'zh', setLocale: () => {} });

/** Holds the interface language. The server renders the cookie's language first, so there is no flash. */
export function LocaleProvider({ initial, children }: { initial: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initial);
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    document.documentElement.lang = htmlLang(next);
    document.title = ui[next].meta.title;
  }, []);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** Current language plus its interface text (`t`), option labels (`L`) and questionnaire copy. */
export function useI18n() {
  const { locale, setLocale } = useContext(LocaleContext);
  return useMemo(() => ({ locale, setLocale, t: ui[locale], L: labels[locale], copy: intakeCopies[locale] }), [locale, setLocale]);
}
