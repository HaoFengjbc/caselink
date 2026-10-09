'use client';

import Link from 'next/link';
import { useI18n } from '@/components/i18n/LocaleProvider';

export default function SiteFooter() {
  const { t } = useI18n();
  return <footer className="site-footer">
    <Link className="footer-brand" href="/">CASE<br/>LINK<small>{t.footer.tagline}</small></Link>
    <p>{t.footer.about[0]}<br/>{t.footer.about[1]}</p>
    <span className="footer-note">{t.footer.note}</span>
  </footer>;
}
