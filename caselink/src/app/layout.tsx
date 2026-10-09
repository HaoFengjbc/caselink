import type { Metadata } from 'next';
import { Bebas_Neue } from 'next/font/google';
import SiteHeader from '@/components/layout/SiteNav';
import SiteFooter from '@/components/layout/SiteFooter';
import { LocaleProvider } from '@/components/i18n/LocaleProvider';
import { htmlLang } from '@/lib/i18n/locale';
import { readLocale } from '@/lib/i18n/server';
import { ui } from '@/lib/i18n/ui';
import './globals.css';
const bebas=Bebas_Neue({weight:'400',subsets:['latin'],display:'swap',variable:'--font-bebas'});
export async function generateMetadata():Promise<Metadata>{const t=ui[await readLocale()].meta;return {title:t.title,description:t.description};}
export default async function RootLayout({children}:{children:React.ReactNode}){const locale=await readLocale();return <html lang={htmlLang(locale)} data-scroll-behavior="smooth" className={bebas.variable}><body>
  <LocaleProvider initial={locale}><SiteHeader/>{children}<SiteFooter/></LocaleProvider>
</body></html>}
