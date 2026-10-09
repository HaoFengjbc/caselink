import {notFound} from 'next/navigation';
import {cases,getCase} from '@/lib/corpus';
import CaseDetailView from '@/components/cases/CaseDetailView';
export function generateStaticParams(){return cases.map(c=>({id:c.caseId}))}
export default async function CaseDetail({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!getCase(id))notFound();return <CaseDetailView caseId={id}/>}
