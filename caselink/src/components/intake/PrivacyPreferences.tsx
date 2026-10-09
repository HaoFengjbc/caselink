'use client';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/LocaleProvider';
import { clearLegacyDraft, legacyDraftAvailable, readPreferences, restoreLegacyDraft, setPreferences } from '@/lib/session';
import { DEFAULT_PREFERENCES } from '@/lib/workflow-contracts';

/** Explicit, independent controls: no preference changes the case fact record. */
export default function PrivacyPreferences({ onRestore }: { onRestore?: () => void }) {
  const { locale } = useI18n(); const en = locale === 'en';
  const [preferences, set] = useState({ ...DEFAULT_PREFERENCES });
  const [legacy, setLegacy] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => { const update = () => { set(readPreferences()); setLegacy(legacyDraftAvailable()); }; update(); window.addEventListener('caselink:session', update); return () => window.removeEventListener('caselink:session', update); }, []);
  return <section className="notice" aria-label={en ? 'Privacy and AI preferences' : '隐私与 AI 设置'}>
    <p>{en ? 'By default, this draft and result stay only in this open page’s memory. Refreshing or closing loses them. Reports enter history only when you explicitly save them.' : '默认仅在当前页面内存中保留草稿和结果，刷新或关闭后不保留。只有主动保存的报告才进入历史。'}</p>
    <label><input type="checkbox" checked={preferences.aiEnabled} onChange={event => setPreferences({ aiEnabled: event.target.checked })}/> {en ? 'Allow AI calls when I submit (facts stay unchanged when switched off)' : '提交时允许调用 AI（关闭不改变案情，使用规则参考）'}</label><br/>
    <label><input type="checkbox" checked={preferences.refreshRecovery} onChange={event => { const checked = event.target.checked; setPreferences({ refreshRecovery: checked, expiresAt: checked ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null }); }}/>{en ? ' Keep this workflow in this tab’s browser storage for refresh recovery, for up to 24 hours' : ' 同意将本流程存入当前标签页的浏览器存储，以便刷新恢复，最长 24 小时'}</label>
    {preferences.refreshRecovery && <p>{en ? 'Recovery expires: ' : '刷新恢复有效期：'}{preferences.expiresAt} · {en ? 'Closing the tab or clearing site data also removes recovery. Turning this off removes the recovery copy immediately.' : '关闭标签页或清除网站数据也会移除恢复副本。关闭此选项立即移除恢复副本。'}</p>}
    {legacy && <div><p>{en ? 'An older version saved a draft in this tab. It has not been deleted or silently restored.' : '旧版本在此标签页保存过草稿，尚未删除，也没有自动恢复。'}</p><button className="text-link" onClick={() => { if (!window.confirm(en ? 'Replace the current in-memory draft with the older draft?' : '用旧草稿替换当前内存草稿？')) return; if (restoreLegacyDraft()) onRestore?.(); else setMessage(en ? 'The old draft cannot be read. Its original data was preserved.' : '旧草稿无法读取，原始资料保持不变。'); }}>{en ? 'Restore older draft' : '恢复旧草稿'}</button>{' · '}<button className="text-link" onClick={() => { if (window.confirm(en ? 'Permanently remove the older draft stored by the previous version?' : '永久清除旧版本存储的草稿？')) clearLegacyDraft(); }}>{en ? 'Clear older draft' : '清除旧草稿'}</button></div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
