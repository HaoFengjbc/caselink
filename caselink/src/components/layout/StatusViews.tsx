'use client';
import Link from 'next/link';
import {ArrowLeft,FileQuestionMark,RefreshCw} from 'lucide-react';
import {useI18n} from '@/components/i18n/LocaleProvider';

export function NotFoundView(){const {t}=useI18n();const v=t.notFound;return <main className="empty-state"><span className="empty-icon"><FileQuestionMark size={30}/></span><span className="eyebrow">{v.eyebrow}</span><h1>{v.title}</h1><p className="muted">{v.text}</p><Link href="/cases" className="btn btn-primary"><ArrowLeft size={16}/>{v.cta}</Link></main>}
export function ErrorView({reset}:{reset:()=>void}){const {t}=useI18n();const v=t.error;return <main className="empty-state"><span className="empty-icon"><RefreshCw size={28}/></span><span className="eyebrow">{v.eyebrow}</span><h1>{v.title}</h1><p className="muted">{v.text}</p><button onClick={reset} className="btn btn-primary"><RefreshCw size={16}/>{v.cta}</button></main>}
