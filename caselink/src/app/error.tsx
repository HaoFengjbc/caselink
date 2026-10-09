'use client';
import {ErrorView} from '@/components/layout/StatusViews';
export default function ErrorPage({reset}:{reset:()=>void}){return <ErrorView reset={reset}/>}
