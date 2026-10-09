'use client';

import { useEffect, useId, useRef } from 'react';
import { Check } from 'lucide-react';
import { useI18n } from '@/components/i18n/LocaleProvider';
import styles from './intake.module.css';

export type ChoiceLayout = 'grid' | 'list' | 'timeline' | 'spectrum' | 'compact';

type ChoicesProps = {
  /** Accessible name of the whole group. */
  name: string;
  options: Record<string, string>;
  value: string | string[];
  onChange: (value: string) => void;
  multiple?: boolean;
  /** Short explanation under an option, keyed like `options`. */
  descriptions?: Record<string, string>;
  layout?: ChoiceLayout;
  /** "Not sure / none" answers, shown apart from the substantive options. */
  escapeKeys?: string[];
  escapeHint?: string;
  /** Digits 1–9 pick the matching numbered option while focus is not in a text field. */
  hotkeys?: boolean;
};

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Numbered, typographic radio / checkbox group. Inputs stay native and cover each row, so mouse,
 * keyboard and screen readers all work; each input is named by its title only (`aria-labelledby`).
 */
export default function Choices({ name, options, value, onChange, multiple, descriptions, layout = 'grid', escapeKeys = ['unknown'], escapeHint, hotkeys }: ChoicesProps) {
  const { t } = useI18n();
  const uid = useId();
  const entries = Object.entries(options);
  const main = entries.filter(([key]) => !escapeKeys.includes(key));
  const escapes = entries.filter(([key]) => escapeKeys.includes(key));
  const isSelected = (key: string) => Array.isArray(value) ? value.includes(key) : value === key;
  const chosen = main.filter(([key]) => isSelected(key)).length;
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });
  const keys = main.map(([key]) => key).join('|');

  useEffect(() => {
    if (!hotkeys) return;
    const list = keys.split('|');
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || !/^[1-9]$/.test(event.key)) return;
      const target = event.target as HTMLElement | null;
      if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable) return;
      if (target instanceof HTMLInputElement && !['radio', 'checkbox'].includes(target.type)) return;
      const key = list[Number(event.key) - 1];
      if (key) { event.preventDefault(); onChangeRef.current(key); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hotkeys, keys]);

  function renderOption([key, label]: [string, string], index: number, escape = false) {
    const selected = isSelected(key);
    const description = descriptions?.[key];
    const titleId = `${uid}-${key}-t`;
    const descId = `${uid}-${key}-d`;
    return <label key={key} className={`${escape ? styles.escapeChoice : styles.choice} ${selected ? styles.choiceSelected : ''}`} style={{ '--i': index } as React.CSSProperties}>
      <input type={multiple ? 'checkbox' : 'radio'} name={name} value={key} checked={selected} onChange={() => onChange(key)} aria-labelledby={titleId} aria-describedby={description && !escape ? descId : undefined}/>
      {!escape && <span className={styles.choiceNumber} aria-hidden="true">{pad(index + 1)}</span>}
      <span className={styles.choiceText}>
        <strong id={titleId}>{label}</strong>
        {description && !escape && <small id={descId}>{description}</small>}
      </span>
      {!escape && <span className={`${styles.choiceMark} ${multiple ? styles.choiceMarkSquare : ''}`} aria-hidden="true">{selected && <Check size={13} strokeWidth={3}/>}</span>}
    </label>;
  }

  return <div className={styles.choices} role={multiple ? 'group' : 'radiogroup'} aria-label={name}>
    {(multiple || hotkeys) && <div className={styles.choiceStatus} aria-live="polite">
      {multiple && <span>{t.choices.multiple(chosen)}</span>}
      {hotkeys && <span className={styles.hotkeyHint}>{t.choices.hotkeys(Math.min(main.length, 9))}</span>}
    </div>}
    {layout === 'spectrum' && <div className={styles.spectrumScale} aria-hidden="true"><span>{t.choices.spectrum[0]}</span><i/><span>{t.choices.spectrum[1]}</span></div>}
    <div className={`${styles.choiceList} ${styles[`layout_${layout}`]}`}>{main.map((entry, index) => renderOption(entry, index))}</div>
    {escapes.length > 0 && <div className={styles.escapeRow}>
      <span className={styles.escapeHint}>{escapeHint ?? t.q.escape.default}</span>
      {escapes.map((entry, index) => renderOption(entry, index, true))}
    </div>}
  </div>;
}
