import type { NewCaseInput } from '@/lib/contracts';
import type { Locale } from '@/lib/i18n/locale';
import { labels } from '@/lib/i18n/en';
import {normalizeConfirmedGoal} from '@/lib/intake/analysis';

export default function AdaptiveSummary({ input, locale }: { input: NewCaseInput; locale: Locale }) {
  input=normalizeConfirmedGoal(input);
  const record = input.intake;
  if (!record) return null;
  const en = locale === 'en';
  const hasCustomGoal = input.primaryGoal === 'other' && !!record.goalText.trim();
  const selectedGoal = hasCustomGoal ? record.goalText : labels[locale].goals[input.primaryGoal];
  const jurisdiction = ({ england_wales: en ? 'England and Wales' : '英格兰与威尔士', scotland: en ? 'Scotland' : '苏格兰', northern_ireland: en ? 'Northern Ireland' : '北爱尔兰', unknown: en ? 'Not determined' : '尚未确定' } as Record<string, string>)[record.jurisdiction] || record.jurisdiction;
  const kind = ({ criminal: en ? 'Criminal' : '刑事', civil: en ? 'Civil' : '民事', administrative: en ? 'Administrative' : '行政', platform: en ? 'Platform decision' : '平台决定', mixed: en ? 'Multiple procedures' : '多种程序', unknown: en ? 'Not determined' : '尚未确定' })[record.caseKind];
  return <section aria-label={en ? 'Case record' : '完整案情记录'} style={{ textAlign: 'left', maxWidth: 900, margin: '28px auto', overflowWrap: 'anywhere' }}>
    <p style={{ opacity: .72 }}>{en ? 'User-provided information; not independently verified. Confirming this record does not confirm a legal classification.' : '以下由使用者提供，未经独立核实；确认记录不代表已经确定法律性质。'}</p>
    <dl style={{ display: 'grid', gap: 18 }}>
      <div><dt>{en ? 'Place / jurisdiction' : '地区 / 具体辖区'}</dt><dd style={{ margin: '6px 0' }}>{input.country} · {jurisdiction || (en ? 'Not determined' : '尚未确定')} · {kind}</dd></div>
      <div><dt>{en ? 'Original account' : '原始案情描述'}</dt><dd style={{ margin: '6px 0', whiteSpace: 'pre-wrap' }}>{record.narrative || (en ? 'Not provided' : '未提供')}</dd></div>
      <div><dt>{en ? 'Selected main goal' : '已选定的主要目标'}</dt><dd style={{ margin: '6px 0', whiteSpace: 'pre-wrap' }}>{selectedGoal}</dd></div>
      {!hasCustomGoal && record.goalText.trim() && <div><dt>{en ? 'Additional wishes (not selected as the main goal)' : '补充诉求（未选为主要目标）'}</dt><dd style={{ margin: '6px 0', whiteSpace: 'pre-wrap' }}>{record.goalText}</dd></div>}
      {record.disclosureDetails && <div><dt>{en ? 'Specific disclosure boundaries' : '具体披露边界'}</dt><dd style={{ margin: '6px 0', whiteSpace: 'pre-wrap' }}>{record.disclosureDetails}</dd></div>}
      {record.answers.map(answer => <div key={answer.questionId}><dt>{answer.question}</dt><dd style={{ margin: '6px 0', whiteSpace: 'pre-wrap' }}>{answer.answer || (en ? 'Not answered' : '尚未回答')}</dd></div>)}
    </dl>
    {record.facts.length > 0 && <details><summary>{en ? 'Reviewed excerpts and notes' : '已核对的摘录与笔记'}</summary>{record.facts.map(fact => <div key={fact.id} style={{ marginTop: 16 }}><p>{fact.text !== fact.quote && <small>{fact.summary && fact.text === fact.summary ? (en ? 'AI summary, confirmed by you · ' : 'AI 概括，经你确认 · ') : (en ? 'User-edited note · ' : '用户改写 · ')}</small>}{fact.text}</p><blockquote style={{ opacity: .72, margin: '8px 0', paddingLeft: 16, borderLeft: '2px solid currentColor' }}>{fact.quote}</blockquote></div>)}</details>}
  </section>;
}
