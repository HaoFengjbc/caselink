'use client';
import { createContext, useContext, type ReactNode } from 'react';
import type { ReportSnapshot } from '@/lib/contracts';
const SnapshotContext = createContext<ReportSnapshot | undefined>(undefined);
export function ReportSnapshotProvider({ snapshot, children }: { snapshot: ReportSnapshot; children: ReactNode }) { return <SnapshotContext.Provider value={snapshot}>{children}</SnapshotContext.Provider>; }
export function useReportSnapshot() { return useContext(SnapshotContext); }
