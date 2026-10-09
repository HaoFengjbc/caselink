'use client';

import {useState, type ReactNode} from 'react';
import {BookOpen, Trash2} from 'lucide-react';
import {type NewCaseInput, type IntakeRecord} from '@/lib/contracts';
import {type MaterialItem} from '@/lib/materials/contracts';
import {deleteMaterialItem, resolveMaterialDateReview} from '@/lib/materials/integration';
import {useI18n} from '@/components/i18n/LocaleProvider';
import {materialsCopy} from '@/lib/i18n/materials';
import styles from './materials.module.css';

type Draft = NewCaseInput & {intake: IntakeRecord};

/** Date validation failures are reviewable items, separate from ordinary note editing. */
export default function MaterialDateReview({input, locked, onChange, renderSource}: {
  input: Draft;
  locked: boolean;
  onChange: (next: Draft) => void;
  renderSource: (item: MaterialItem) => ReactNode;
}) {
  const {locale} = useI18n();
  const en = locale === 'en';
  const [notes, setNotes] = useState<Record<string, string>>({});
  const pending = input.intake.materials?.items.filter(item => item.dateReview?.resolution === null) ?? [];
  if (!pending.length) return null;
  const visible = pending.slice(0, 3);

  function resolveAllUnknown() {
    let next = input;
    for (const item of pending) next = resolveMaterialDateReview(next, item.id, 'unknown', undefined, locale);
    onChange(next);
  }

  return <section id="material-date-review" className={styles.conflicts} aria-labelledby="material-date-review-title" data-testid="material-date-review">
    <h3 id="material-date-review-title">{en ? 'Dates that need review' : '需要核对的日期'}</h3>
    <p className={styles.warning}>
      {en
        ? `${pending.length} date item${pending.length === 1 ? '' : 's'} still need review. Unverified AI dates and their draft notes were discarded; verified excerpts and the other case information remain available. Review the source, keep the date unknown, or delete the item before confirming the case.`
        : `还有 ${pending.length} 项日期需要处理。未核实的 AI 日期及相关草稿已丢弃，原文片段与其余案情保留。确认案情前，请核对说明、明确保留未知，或删除该项。`}
    </p>
    {pending.length > 3 && <p className={styles.help}>{en ? 'Showing 3 items at a time. The remaining items appear as these are handled; you can also keep all unresolved dates unknown below.' : '本轮最多展示 3 项，处理后会展示剩余项目；也可在下方一次将所有未处理日期保留未知。'}</p>}
    {visible.map(item => {
      const note = notes[item.id] ?? '';
      const label = `${materialsCopy[locale].dates[item.dateKind]}${item.subject ? ` · ${item.subject}` : ''}`;
      return <article key={item.id} className={styles.conflict} data-date-review-item={item.id}>
        <h4>{label}</h4>
        <p>{item.dateReview?.reason === 'missing_date'
          ? en ? 'A checkable date is missing. No date has been filled automatically.' : '缺少可核对的日期，未自动填入日期。'
          : en ? 'The extracted date could not be verified against its source excerpt. No date has been selected for you.' : '提取日期无法与对应原文核对，系统未替你选定日期。'}</p>
        <details>
          <summary className={styles.sourceLink}><BookOpen size={13}/>{en ? 'View original' : '查看原文'} · {item.sources.map(source => `${source.filename} · PDF ${source.pdfPage}`).join('; ')}</summary>
          {renderSource(item)}
        </details>
        <label className={styles.label} htmlFor={`date-note-${item.id}`}>{en ? 'Your date review note' : '你的日期核对说明'}</label>
        <textarea id={`date-note-${item.id}`} className="field" rows={3} maxLength={800} disabled={locked} value={note}
          placeholder={en ? 'Describe what you checked and what remains uncertain. Your note will be kept separately from the original excerpt.' : '说明你核对了什么，以及仍不确定的内容。你的说明与文件原话分别保留。'}
          onChange={event => setNotes(previous => ({...previous, [item.id]: event.target.value}))}/>
        <div className={styles.toolbar}>
          <button type="button" className="btn btn-primary" disabled={locked || !note.trim()} onClick={() => onChange(resolveMaterialDateReview(input, item.id, 'reviewed', note.trim(), locale))}>{en ? 'Save review note' : '保存核对说明'}</button>
          <button type="button" className="text-link" disabled={locked} onClick={() => onChange(resolveMaterialDateReview(input, item.id, 'unknown', undefined, locale))}>{en ? 'Date unclear — keep unknown' : '日期不清楚，保留未知'}</button>
          <button type="button" className="text-link" disabled={locked} onClick={() => onChange(deleteMaterialItem(input, item.id))}><Trash2 size={13}/>{en ? 'Delete this date item' : '删除此日期项'}</button>
        </div>
      </article>;
    })}
    {pending.length > 1 && <button type="button" className="btn btn-ghost" disabled={locked} onClick={resolveAllUnknown}>{en ? `Keep all ${pending.length} unresolved dates unknown` : `将全部 ${pending.length} 项未处理日期保留未知`}</button>}
  </section>;
}
