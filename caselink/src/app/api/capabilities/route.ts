import {NextRequest,NextResponse} from 'next/server';
import {readMaterialConfig} from '@/lib/materials/config';
import {MATERIAL_LIMITS} from '@/lib/materials/contracts';
import {readConfig} from '@/lib/ai/config';
import {NO_STORE,errorResponse,requestIdentifier} from '@/lib/ai/http';
import {controlledSearchConfigured} from '@/lib/research/controlled-search';
export const runtime='nodejs';
export async function GET(request:NextRequest){
 try{
  const config=readConfig(),searchConfigured=controlledSearchConfigured();
  const liveAvailable=config.mode==='live'&&config.configured;
  const materialConfig=readMaterialConfig(),materialExtractionAvailable=materialConfig.mode==='live'&&!!materialConfig.key;
  return NextResponse.json({mode:config.mode,configured:config.configured,liveAvailable,accessRequired:false,paidProtectionEnabled:false,controlledSearchConfigured:searchConfigured,webSearchAvailable:liveAvailable&&searchConfigured,ruleAvailable:true,materialExtractionAvailable,materialTextReadingAvailable:true,materialLimits:MATERIAL_LIMITS,materialProgressEvents:true,materialResultRetentionSeconds:0,serverResultRetentionSeconds:0,idempotencyEnabled:false,progressEvents:false,configurationNotice:'Configuration presence is not a live provider connectivity verification.'},{headers:NO_STORE});
 }catch(error){return errorResponse(error,requestIdentifier(request));}
}
