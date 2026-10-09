'use client';

import { Check } from 'lucide-react';
import { useI18n } from '@/components/i18n/LocaleProvider';
import styles from './intake.module.css';

/** Stage position indicator shared by /new, /review and /analysis. `steps` replaces the three-step form labels. */
export default function FlowSteps({ current, steps }: { current: number; steps?: readonly string[] }) {
  const { t } = useI18n();
  const labels = steps ?? t.flow.steps;
  return <ol className={`${styles.flowSteps} ${labels.length > 3 ? styles.flowStepsLong : ''}`} aria-label={t.flow.label}>
    {labels.map((label, index) => {
      const state = index < current ? styles.flowDone : index === current ? styles.flowCurrent : '';
      return <li key={index} className={state} aria-current={index === current ? 'step' : undefined}>
        <span className={styles.flowDot}>{index < current ? <Check size={12} strokeWidth={3}/> : String(index + 1).padStart(2, '0')}</span>
        <span className={styles.flowLabel}>{label}</span>
      </li>;
    })}
  </ol>;
}
