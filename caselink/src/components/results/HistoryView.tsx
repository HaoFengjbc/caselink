'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Download, FileText, History, Upload, Trash2 } from 'lucide-react';
import { useI18n } from '@/components/i18n/LocaleProvider';
import NewAnalysisButton from '@/components/intake/NewAnalysisButton';
import { archiveCurrentSession, clearSession, readSession } from '@/lib/session';
import { deleteSavedReport, historyBackup, historyStatus, parseHistoryImport, readHistory, storeReport, type SavedReport } from '@/lib/session/history';
import { analysisMarkdown } from './export';
import styles from './history.module.css';

export function downloadText(text: string, name: string, type = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function reportHref(report: SavedReport) { return `${report.kind === 'analysis' ? '/analysis' : '/history'}?id=${encodeURIComponent(report.id)}`; }

export default function HistoryView({ reportId }: { reportId?: string }) {
  const { locale, L } = useI18n(); const en = locale === 'en';
  const [reports, setReports] = useState<SavedReport[] | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [status, setStatus] = useState(historyStatus());
  const [query, setQuery] = useState(''); const [message, setMessage] = useState('');
  const [paste, setPaste] = useState('');
  const upload = useRef<HTMLInputElement>(null);
  function refresh() { setReports(readHistory()); setStatus(historyStatus()); const input = readSession().input; setHasDraft(!!input?.country.trim()); }
  useEffect(() => {
    archiveCurrentSession(); refresh();
    window.addEventListener('storage', refresh); window.addEventListener('caselink:session', refresh);
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('caselink:session', refresh); };
  }, []);
  const title = (report: SavedReport) => report.title || (en ? `${report.country} · Case analysis` : `${report.country} · 案件分析`);
  const date = (report: SavedReport) => Number.isFinite(Date.parse(report.createdAt)) ? new Date(report.createdAt).toLocaleString(en ? 'en-US' : 'zh-CN') : report.createdAt;
  function download(report: SavedReport) {
    downloadText(report.kind === 'markdown' ? report.markdown : analysisMarkdown(report.result, report.input, report.result.locale ?? 'zh'), `CaseLink-${report.createdAt.slice(0, 10)}.md`);
  }
  async function importText(text: string) {
    try {
      const imported = await parseHistoryImport(text);
      const before = new Set(readHistory().map(report => report.id));
      let saved = true;
      for (const report of imported) if (!storeReport(report)) saved = false;
      refresh();
      setPaste('');
      const added = imported.filter(report => !before.has(report.id)).length;
      setMessage(saved ? (en ? `Added ${added} report(s). Existing reports were kept.` : `已导入 ${added} 份报告，已有记录保持不变。`) : (en ? 'Some reports could not be saved. Download a backup before closing this page.' : '部分报告未能持久保存，请在关闭页面前下载备份。'));
    } catch { setMessage(en ? 'Choose a CaseLink JSON backup or an exported Markdown report, up to 3 MB.' : '请选择 CaseLink 的 JSON 备份或导出的 Markdown 报告，文件不超过 3 MB。'); }
  }
  async function importFile(file?: File) {
    if (!file) return;
    if (file.size > 3_000_000) { setMessage(en ? 'The file must be 3 MB or smaller.' : '文件不能超过 3 MB。'); return; }
    try { await importText(await file.text()); }
    catch { setMessage(en ? 'Could not read this file. You can paste its text below.' : '无法读取此文件，也可以在下方粘贴报告内容。'); }
    if (upload.current) upload.current.value = '';
  }
  function remove(report: SavedReport) {
    if (!window.confirm(en ? 'Delete this saved report from this browser? Download a backup first if needed.' : '从本浏览器删除这份历史报告？如需保留，请先下载备份。')) return;
    if (deleteSavedReport(report.id)) {
      if (readSession().result?.analysisId === report.id) clearSession();
      refresh();
    } else setMessage(en ? 'The report could not be deleted.' : '未能删除，报告仍然保留。');
  }
  if (!reports) return <main className="page"><p>{en ? 'Loading your analyses…' : '正在读取分析记录…'}</p></main>;
  if (reportId) {
    const report = reports.find(report => report.id === reportId);
    return <main className={`page ${styles.page}`}><Link className="text-link" href="/history">← {en ? 'My analyses' : '我的分析'}</Link>{!report ? <><h1>{en ? 'Report not found' : '本浏览器未找到这份报告'}</h1><p>{en ? 'Use the original browser, or import your backup.' : '请在原浏览器打开，或导入已下载的备份。'}</p></> : <><h1>{title(report)}</h1><p className="muted">{date(report)} · {en ? 'Imported original export' : '导入的原始导出报告'}</p><p className="notice">{en ? 'This is a saved export, with no new AI analysis. Its content and dates are preserved.' : '这里展示原始导出内容，保留当时的结果和时间，未重新运行 AI 分析。'}</p><button className="btn btn-small" onClick={() => download(report)}><Download size={16}/>{en ? 'Download report' : '下载报告'}</button>{report.kind === 'markdown' ? <pre className={styles.markdown}>{report.markdown}</pre> : <Link href={reportHref(report)}>{en ? 'Open report' : '打开报告'}</Link>}</>}</main>;
  }
  const matching = reports.filter(report => `${title(report)} ${report.country} ${report.kind === 'analysis' ? report.input.intake?.narrative ?? '' : ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <main className={`page ${styles.page}`}>
    <span className="eyebrow"><History size={17}/>{en ? 'YOUR WORKSPACE' : '你的研究记录'}</span>
    <div className={styles.heading}><div><h1>{en ? 'My analyses' : '我的分析'}</h1><p>{en ? 'Return to the evidence. Pick up where you left off.' : '每一次分析，都能回到当时的依据。'}</p></div><NewAnalysisButton className="btn btn-primary">{en ? 'Start new analysis' : '开始新分析'}<ArrowRight size={16}/></NewAnalysisButton></div>
    <p className={styles.storageNote}>{en ? 'Completed reports are saved in this browser on this device. They survive closing the tab, but do not sync between devices. Clearing site data deletes them. Download a backup to keep a separate copy.' : '完成的报告保存在本设备的当前浏览器中，关闭标签页后仍可查看；暂不跨设备同步。清除网站数据会删除记录，可下载备份另行保留。'}</p>
    {hasDraft && <div className={styles.draft}><div><strong>{en ? 'Current case draft' : '当前案情草稿'}</strong><p>{en ? 'Continue editing this case, or start a separate blank analysis.' : '继续填写当前案情，或从空白开始另一个分析。'}</p></div><Link className="text-link" href="/new">{en ? 'Continue draft' : '继续当前草稿'}<ArrowRight size={15}/></Link></div>}
    {(status.storageIssue || status.pendingCount > 0) && <p className="notice" role="alert">{en ? 'Browser storage is unavailable or full. Some reports only exist in this open page. Download all reports before closing or refreshing.' : '浏览器存储不可用或空间不足，部分报告仅暂存在当前页面。关闭或刷新前，请下载全部备份。'}</p>}
    {status.unreadable && <p className="notice">{en ? 'Some saved records cannot be read by this version. They have not been deleted or overwritten.' : '部分旧记录暂不能读取，原始记录没有被删除或覆盖。'}</p>}
    <div className={styles.toolbar}><label className={styles.search}>{en ? 'Find a report' : '查找历史报告'}<input className="field" value={query} onChange={event => setQuery(event.target.value)} placeholder={en ? 'Search by goal, case or region' : '搜索目标、案情或地区'}/></label><div className="row"><button className="btn btn-small" disabled={!reports.length} onClick={() => downloadText(historyBackup(reports), 'CaseLink-history.json', 'application/json')}><Download size={15}/>{en ? 'Back up all' : '下载全部备份'}</button><button className="btn btn-small" onClick={() => upload.current?.click()}><Upload size={15}/>{en ? 'Import report' : '导入旧报告'}</button><input ref={upload} className="screen-reader" type="file" tabIndex={-1} aria-label={en ? 'Import CaseLink file' : '导入 CaseLink 文件'} accept=".json,.md,.markdown" onChange={event => { void importFile(event.target.files?.[0]); }}/></div></div>
    <details className={styles.paste}><summary>{en ? 'Or paste a report / backup' : '也可以粘贴旧报告或备份内容'}</summary><label>{en ? 'CaseLink report or JSON backup' : 'CaseLink 报告或 JSON 备份'}<textarea className="field" value={paste} onChange={event => setPaste(event.target.value)} maxLength={3_000_000}/></label><p>{en ? 'Imported content stays in this browser and is not sent to AI.' : '导入内容仅保存在本浏览器，不发送给 AI。'}</p><button className="btn btn-small" disabled={!paste.trim()} onClick={() => { void importText(paste); }}>{en ? 'Import pasted content' : '导入粘贴内容'}</button></details>
    {message && <p role="status" className="notice">{message}</p>}
    <p className={styles.count}>{en ? `${matching.length} saved analyses` : `${matching.length} 份历史报告`}</p>
    <div className={styles.reports}>{matching.map((report, index) => <article className={styles.report} key={report.id}>
      <span className={styles.index}>{String(index + 1).padStart(2, '0')}</span><div className={styles.body}><div className="row"><span className="tag">{report.country}</span><span className="tag">{report.kind === 'markdown' ? (en ? 'Imported export' : '导入的导出报告') : L.modes[report.result.mode]}</span><time dateTime={report.createdAt}>{date(report)}</time></div><h2><Link href={reportHref(report)}>{title(report)}</Link></h2>{report.kind === 'analysis' && <p>{report.input.intake?.narrative || report.input.background.description}</p>}<div className={styles.actions}><Link className="text-link" href={reportHref(report)}><FileText size={15}/>{en ? 'View report' : '查看报告'}<ArrowRight size={15}/></Link><button className="text-link" onClick={() => download(report)}><Download size={14}/>{en ? 'Download' : '下载'}</button><button className={styles.delete} aria-label={`${en ? 'Delete report: ' : '删除报告：'}${title(report)}`} onClick={() => remove(report)}><Trash2 size={15}/></button></div></div>
    </article>)}</div>
    {!matching.length && <div className={styles.empty}><FileText size={30}/><h2>{reports.length ? (en ? 'No matches' : '没有找到匹配的报告') : (en ? 'Your next analysis starts here' : '让下一次分析有迹可循')}</h2><p>{reports.length ? (en ? 'Try a different search.' : '试试其他关键词。') : (en ? 'Completed reports will appear here automatically. Import an earlier CaseLink Markdown export to recover a report you already downloaded.' : '完成的分析会自动出现在这里。之前下载过的 CaseLink Markdown 报告，也可以导入恢复查看。')}</p></div>}
  </main>;
}
