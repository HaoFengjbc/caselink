/** Interface and generated-content language. Chinese stays the default everywhere. */
export type Locale = 'zh' | 'en';
export const DEFAULT_LOCALE: Locale = 'zh';
/** Readable by the server so the first render is already in the chosen language. */
export const LOCALE_COOKIE = 'caselink-locale';
export const isLocale = (value: unknown): value is Locale => value === 'zh' || value === 'en';
export const htmlLang = (locale: Locale) => locale === 'en' ? 'en' : 'zh-CN';
