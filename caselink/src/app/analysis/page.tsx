import AnalysisView from '@/components/results/AnalysisView';
export default async function AnalysisPage({searchParams}:{searchParams:Promise<{id?:string}>}){const {id}=await searchParams;return <AnalysisView key={id??'current'} reportId={id}/>}
