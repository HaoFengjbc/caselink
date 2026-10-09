import Questionnaire from '@/components/intake/Questionnaire';
import AdaptiveQuestionnaire from '@/components/intake/AdaptiveQuestionnaire';
export default async function NewCasePage({ searchParams }: { searchParams: Promise<{ mode?: string; step?: string; draft?: string; entry?: string }> }) {
  const params = await searchParams;
  return params.mode === 'classic' || params.step !== undefined ? <Questionnaire key={params.draft ?? 'current'}/> : <AdaptiveQuestionnaire key={params.draft ?? 'current'} initialEntry={params.entry==='manual'?'manual':'upload'}/>;
}
