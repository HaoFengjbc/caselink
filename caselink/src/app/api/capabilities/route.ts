import {NextRequest,NextResponse} from 'next/server';
import {readIntakeConfig} from '@/lib/intake/service';
import {MATERIAL_LIMITS} from '@/lib/materials/contracts';
import {readConfig} from '@/lib/ai/config';
import {NO_STORE,errorResponse,requestIdentifier} from '@/lib/ai/http';
import {readUsageConfig,usageConfigurationStatus,materialUsageConfigured,RESULT_TTL_SECONDS} from '@/lib/usage/config';
import {anonymousSession} from '@/lib/usage/identity';
import {setAnonymousCookie} from '@/lib/usage/api';
import {controlledSearchConfigured} from '@/lib/research/controlled-search';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 try{
  const config=readConfig(),usageControlConfigured=usageConfigurationStatus(),searchConfigured=controlledSearchConfigured();
  const materialConfig=readIntakeConfig(),materialUsage=materialUsageConfigured();
  const materialExtractionAvailable=materialConfig.mode==='live'&&!!materialConfig.key&&materialUsage;
  const liveAvailable=config.mode==='live'&&config.configured&&usageControlConfigured;
  const response=NextResponse.json({mode:config.mode,configured:config.configured,liveAvailable,accessRequired:false,usageControlConfigured,controlledSearchConfigured:searchConfigured,webSearchAvailable:liveAvailable&&searchConfigured,ruleAvailable:true,materialExtractionAvailable,materialTextReadingAvailable:true,materialLimits:MATERIAL_LIMITS,materialProgressEvents:true,materialResultRetentionSeconds:0,idempotencyResultRetentionSeconds:RESULT_TTL_SECONDS,progressEvents:false,configurationNotice:'Configuration presence is not a live connectivity or account-budget verification.'},{headers:NO_STORE});
  if(usageControlConfigured||materialUsage){const identity=anonymousSession(request,readUsageConfig(process.env,{searchRequired:usageControlConfigured}));if(identity.cookie)setAnonymousCookie(response,identity.cookie,request);}
  return response;
 }catch(error){return errorResponse(error,requestIdentifier(request));}
}
