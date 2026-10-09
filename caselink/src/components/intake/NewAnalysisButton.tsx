'use client';
import { useRouter } from 'next/navigation';
import { startNewAnalysis } from '@/lib/session';

/** An explicit new case always resets input, AI intake and result, even on /new. */
export default function NewAnalysisButton({ children, className, onStart }: { children: React.ReactNode; className?: string; onStart?: () => void }) {
  const router = useRouter();
  return <button type="button" className={className} onClick={() => {
    startNewAnalysis(); onStart?.();
    router.push(`/new?draft=${crypto.randomUUID()}`);
  }}>{children}</button>;
}
