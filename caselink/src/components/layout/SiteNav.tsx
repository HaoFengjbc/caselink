'use client';

import Link from 'next/link';
import { useRef } from 'react';
import NewAnalysisButton from '@/components/intake/NewAnalysisButton';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, X } from 'lucide-react';
import { useI18n } from '@/components/i18n/LocaleProvider';
import type { Locale } from '@/lib/i18n/locale';

const MENU_LINKS = ['/', '/new', '/cases', '/#approach'];

/** Two-option language switch: 中 | EN. */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return <div className={`lang-toggle ${className}`} role="group" aria-label={t.lang.group}>
    {(['zh', 'en'] as Locale[]).map(option => <button key={option} type="button" lang={option === 'zh' ? 'zh-CN' : 'en'} aria-pressed={locale === option} aria-label={t.lang[option]} onClick={() => setLocale(option)}>{t.lang.short[option]}</button>)}
  </div>;
}

/** Site header: brand, primary links, language switch and a full-height menu drawer. */
export default function SiteHeader() {
  const pathname = usePathname();
  const { t, locale } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const inLibrary = pathname.startsWith('/cases');
  const inFlow = ['/new', '/review', '/analysis'].includes(pathname);
  const isCurrent = (href: string) => href === '/cases' ? inLibrary : href === '/new' ? inFlow : href === pathname;
  return <header className="site-header">
    <Link className="brand" href="/" aria-label={t.header.home}>CASE<br/>LINK<i/></Link>
    <div className="header-actions">
      <Link href="/cases" className="header-link" aria-current={inLibrary ? 'page' : undefined}>{t.header.library}</Link>
      <Link href="/history" className="header-history" aria-current={pathname === '/history' ? 'page' : undefined}>{locale === 'en' ? 'My analyses' : '我的分析'}</Link>
      <NewAnalysisButton className="header-cta">{t.header.start}<ArrowUpRight size={15}/></NewAnalysisButton>
      <LanguageToggle/>
      <button className="menu-button" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog"><span>{t.header.menu}</span><span aria-hidden="true"><i/><i/><i/></span></button>
      <dialog ref={dialog} className="menu-drawer" aria-label={t.header.siteMenu} onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
        <div className="menu-head"><span>{t.header.menu}</span><button className="menu-close" aria-label={t.header.closeMenu} onClick={() => dialog.current?.close()}><X size={34} strokeWidth={1.4}/></button></div>
        <ul className="menu-links">{MENU_LINKS.map((href, i) => <li key={href}>{href === '/new' ? <NewAnalysisButton onStart={() => dialog.current?.close()}><small>{String(i + 1).padStart(2, '0')}</small>{t.header.menuItems[i]}</NewAnalysisButton> : <Link href={href} aria-current={isCurrent(href) ? 'page' : undefined} onClick={() => dialog.current?.close()}><small>{String(i + 1).padStart(2, '0')}</small>{t.header.menuItems[i]}</Link>}</li>)}<li><Link href="/history" onClick={() => dialog.current?.close()}><small>05</small>{locale === 'en' ? 'My analyses' : '我的分析'}</Link></li></ul>
        <div className="row"><Link href="/compare" onClick={() => dialog.current?.close()}>{locale === 'en' ? 'Compare cases' : '多案比较'}</Link><Link href="/resources" onClick={() => dialog.current?.close()}>{locale === 'en' ? 'International resources' : '国际依据与资源'}</Link></div>
        <LanguageToggle className="lang-toggle-large"/>
        <p className="menu-foot">{t.header.menuFoot[0]}<br/>{t.header.menuFoot[1]}</p>
      </dialog>
    </div>
  </header>;
}
