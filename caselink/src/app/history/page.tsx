import HistoryView from '@/components/results/HistoryView';
export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <HistoryView key={id ?? 'list'} reportId={id}/>;
}
