'use client';

import {FileText} from 'lucide-react';
import type {MaterialRecord} from '@/lib/materials/contracts';
import {pageRange} from '@/lib/materials/pages';
import {useI18n} from '@/components/i18n/LocaleProvider';
import styles from './materials.module.css';

const shortName = (name: string) => name.length > 40 ? `${name.slice(0, 22)}…${name.slice(-14)}` : name;

/** One quiet line per uploaded PDF: what was read, what was not, and where to add or remove files. */
export default function MaterialFiles({record, open, locked, onToggle}: {record: MaterialRecord; open: boolean; locked: boolean; onToggle: () => void}) {
  const {locale} = useI18n();
  const en = locale === 'en';
  return <div className={styles.fileLine}>
    <div className={styles.fileLineBody}>
      {record.documents.map(doc => {
        const all = doc.processedPages.length === doc.pageCount;
        const issues = [
          doc.unreadablePages.length ? (en ? `p. ${pageRange(doc.unreadablePages, locale)} could not be read (scan or blank)` : `第 ${pageRange(doc.unreadablePages, locale)} 页无法读取（扫描或空白）`) : '',
          doc.omittedPages.length ? (en ? `p. ${pageRange(doc.omittedPages, locale)} not processed` : `第 ${pageRange(doc.omittedPages, locale)} 页未处理`) : '',
        ].filter(Boolean);
        return <p key={doc.fileId}>
          <FileText size={15} aria-hidden="true"/>
          <span className={styles.fileShort} title={doc.filename}>{shortName(doc.filename)}</span>
          <span>{en ? `${doc.pageCount} pages · ${all ? 'all read' : `read p. ${pageRange(doc.processedPages, locale)}`}` : `${doc.pageCount} 页 · ${all ? '已全部读取' : `已读第 ${pageRange(doc.processedPages, locale)} 页`}`}</span>
          {issues.length > 0 && <span className={styles.fileIssue}>{issues.join(en ? '; ' : '；')}</span>}
        </p>;
      })}
      {record.selectedCaseLabel && <p className={styles.caseLine}>{record.selectedCaseLabel}</p>}
    </div>
    <button type="button" className="text-link" disabled={locked} aria-expanded={open} onClick={onToggle}>{open ? (en ? 'Hide file controls' : '收起文件管理') : (en ? 'Add or remove materials' : '添加或移除材料')}</button>
  </div>;
}
