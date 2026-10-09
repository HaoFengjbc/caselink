import {NextRequest,NextResponse} from 'next/server';
import {readConfig} from '@/lib/ai/config';
import {NO_STORE,errorResponse,requestIdentifier} from '@/lib/ai/http';
import {readUsageConfig,usageConfigurationStatus,RESULT_TTL_SECONDS} from '@/lib/usage/config';
import {anonymousSession} from '@/lib/usage/identity';
import {setAnonymousCookie} from '@/lib/usage/api';
import {controlledSearchConfigured} from '@/lib/research/controlled-search';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 try{
  const config=readConfig(),usageControlConfigured=usageConfigurationStatus(),searchConfigured=controlledSearchConfigured();
  const liveAvailable=config.mode==='live'&&config.configured&&usageControlConfigured;
  const response=NextResponse.json({mode:config.mode,configured:config.configured,liveAvailable,accessRequired:false,usageControlConfigured,controlledSearchConfigured:searchConfigured,webSearchAvailable:liveAvailable&&searchConfigured,ruleAvailable:true,idempotencyResultRetentionSeconds:RESULT_TTL_SECONDS,progressEvents:false,configurationNotice:'Configuration presence is not a live connectivity or account-budget verification.'},{headers:NO_STORE});
  if(usageControlConfigured){const identity=anonymousSession(request,readUsageConfig());if(identity.cookie)setAnonymousCookie(response,identity.cookie,request);}
  return response;
 }catch(error){return errorResponse(error,requestIdentifier(request));}
}
