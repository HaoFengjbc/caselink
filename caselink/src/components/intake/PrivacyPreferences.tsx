'use client';
import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { useI18n } from '@/components/i18n/LocaleProvider';
import { clearLegacyDraft, legacyDraftAvailable, readPreferences, restoreLegacyDraft, setPreferences } from '@/lib/session';
import { DEFAULT_PREFERENCES } from '@/lib/workflow-contracts';
import styles from './privacy.module.css';

/**
 * One quiet line: where the draft lives and whether AI may be called. Refresh recovery and older drafts
 * sit behind "More settings". No preference changes the case fact record.
 */
export default function PrivacyPreferences({ onRestore }: { onRestore?: () => void }) {
  const { locale } = useI18n(); const en = locale === 'en';
  const [preferences, set] = useState({ ...DEFAULT_PREFERENCES });
  const [legacy, setLegacy] = useState(false); const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => { const update = () => { set(readPreferences()); setLegacy(legacyDraftAvailable()); }; update(); window.addEventListener('caselink:session', update); return () => window.removeEventListener('caselink:session', update); }, []);
  const until = preferences.refreshRecovery && preferences.expiresAt ? new Date(preferences.expiresAt).toLocaleString(en ? 'en-GB' : 'zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const status = preferences.refreshRecovery
    ? (en ? `Draft kept in this tab until ${until}` : `草稿保存在此标签页，可刷新恢复至 ${until}`)
    : (en ? 'Draft stays on this page only; refreshing clears it' : '草稿只保存在此页面，刷新后不保留');
  return <section className={styles.privacy} aria-label={en ? 'Privacy and AI preferences' : '隐私与 AI 设置'}>
    <div className={styles.row}>
      <span className={styles.status}><Lock size={14} aria-hidden="true"/>{status}</span>
      <label className={styles.toggle}><input type="checkbox" checked={preferences.aiEnabled} onChange={event => setPreferences({ aiEnabled: event.target.checked })}/>{en ? 'Allow AI calls when I submit' : '提交时允许调用 AI'}</label>
      <button type="button" className={`text-link ${styles.more}`} aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? (en ? 'Hide settings' : '收起设置') : (en ? 'More settings' : '更多设置')}</button>
    </div>
    {open && <div className={styles.panel}>
      <p>{en ? 'Reports enter history only when you save them. Turning AI off keeps the case facts and uses the rule-based reference.' : '只有主动保存的报告才进入历史。关闭 AI 不改变案情，改用规则参考。'}</p>
      <label className={styles.toggle}><input type="checkbox" checked={preferences.refreshRecovery} onChange={event => { const checked = event.target.checked; setPreferences({ refreshRecovery: checked, expiresAt: checked ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null }); }}/>{en ? 'Keep this workflow in this tab for refresh recovery (up to 24 hours)' : '在此标签页保留本流程，以便刷新恢复（最长 24 小时）'}</label>
      {preferences.refreshRecovery && <p>{en ? 'Closing the tab or clearing site data removes it; turning this off removes it immediately.' : '关闭标签页或清除网站数据会移除恢复副本；关闭此选项立即移除。'}</p>}
    </div>}
    {legacy && <p className={styles.legacy}>{en ? 'An older version saved a draft in this tab; it was not restored or deleted.' : '旧版本在此标签页保存过草稿，未自动恢复，也未删除。'} <button className="text-link" onClick={() => { if (!window.confirm(en ? 'Replace the current in-memory draft with the older draft?' : '用旧草稿替换当前内存草稿？')) return; if (restoreLegacyDraft()) onRestore?.(); else setMessage(en ? 'The old draft cannot be read. Its original data was preserved.' : '旧草稿无法读取，原始资料保持不变。'); }}>{en ? 'Restore older draft' : '恢复旧草稿'}</button>{' · '}<button className="text-link" onClick={() => { if (window.confirm(en ? 'Permanently remove the older draft stored by the previous version?' : '永久清除旧版本存储的草稿？')) clearLegacyDraft(); }}>{en ? 'Clear older draft' : '清除旧草稿'}</button></p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
