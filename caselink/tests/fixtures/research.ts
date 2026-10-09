import type {WebSearchTransport} from '../../src/lib/research/provider';

/** An explicit local research failure. No network or paid model can be called. */
export const unavailableResearch:WebSearchTransport=async()=>({status:'completed',output:[]});
