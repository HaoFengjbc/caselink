import {NextRequest,NextResponse} from 'next/server';
import {readConfig} from '@/lib/ai/config';
import {NO_STORE,errorResponse,requestIdentifier} from '@/lib/ai/http';
export const runtime='nodejs';
export async function GET(request:NextRequest){
  try{const config=readConfig();
    return NextResponse.json({mode:config.mode,configured:config.configured,liveAvailable:config.mode==='live'&&config.configured,accessRequired:false},{headers:NO_STORE});
  }catch(error){return errorResponse(error,requestIdentifier(request));}
}
