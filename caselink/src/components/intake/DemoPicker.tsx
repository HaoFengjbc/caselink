'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Play, X } from 'lucide-react';
import { DEMO_SCENARIOS, DEMO_SCENARIOS_EN } from '../../../data/demo/fixtures';
import { saveInput, startNewAnalysis } from '@/lib/session';
import { useI18n } from '@/components/i18n/LocaleProvider';
import { countryName } from '@/lib/i18n/content';
import styles from './intake.module.css';

export default function DemoPicker() {
  const { locale, t, L } = useI18n();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const scenarios = locale === 'en' ? DEMO_SCENARIOS_EN : DEMO_SCENARIOS;
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [open]);
  function close() { setOpen(false); trigger.current?.focus(); }
  return <>
    <button ref={trigger} className="btn" onClick={() => setOpen(true)}><Play size={13} fill="currentColor"/>{t.demo.trigger}</button>
    <dialog ref={dialog} className={styles.dialog} onCancel={close} onClose={close} onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <button aria-label={t.demo.close} className={styles.dialogClose} onClick={close}><X size={20} strokeWidth={2.4}/></button>
      <div className={styles.dialogTitle}><h2>{t.demo.title[0]}<br/>{t.demo.title[1]}</h2><i className="bar"/></div>
      <p className={styles.dialogLead}>{t.demo.lead}</p>
      <div className={styles.demoOptions}>
        {scenarios.map((scenario, i) => <button key={scenario.id} className={`${styles.demoOption} ${selected === i ? styles.demoSelected : ''}`} onClick={() => setSelected(i)} aria-pressed={selected === i}>
          <span className={styles.demoNumber}>{String(i + 1).padStart(2, '0')}</span>
          <span className={styles.demoBody}>
            <strong>{scenario.title}</strong>
            <small>{scenario.description}</small>
            <span className={styles.demoMeta}><span>{countryName(scenario.input.country, locale)}</span><span>{L.goals[scenario.input.primaryGoal]}</span><span>{L.publicity[scenario.input.publicity]}</span></span>
          </span>
          <span className={styles.choiceMark}>{selected === i && <Check size={13} strokeWidth={3}/>}</span>
        </button>)}
      </div>
      <button className="btn btn-primary" onClick={() => { const scenario = scenarios[selected]; if (!scenario) return; startNewAnalysis(); saveInput(structuredClone(scenario.input), 8); close(); router.push('/review'); }}>{t.demo.load}<ArrowRight size={17}/></button>
      <p className={styles.dialogFootnote}>{t.demo.foot}</p>
    </dialog>
  </>;
}
