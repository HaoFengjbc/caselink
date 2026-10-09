import {NextRequest,NextResponse} from 'next/server';
import {readConfig} from '@/lib/ai/config';
import {NO_STORE,errorResponse,requestIdentifier} from '@/lib/ai/http';
import {controlledSearchConfigured} from '@/lib/research/controlled-search';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 try{
  const config=readConfig(),searchConfigured=controlledSearchConfigured();
  const liveAvailable=config.mode==='live'&&config.configured;
  return NextResponse.json({mode:config.mode,configured:config.configured,liveAvailable,accessRequired:false,paidProtectionEnabled:false,controlledSearchConfigured:searchConfigured,webSearchAvailable:liveAvailable&&searchConfigured,ruleAvailable:true,serverResultRetentionSeconds:0,idempotencyEnabled:false,progressEvents:false,configurationNotice:'Configuration presence is not a live provider connectivity verification.'},{headers:NO_STORE});
 }catch(error){return errorResponse(error,requestIdentifier(request));}
}
