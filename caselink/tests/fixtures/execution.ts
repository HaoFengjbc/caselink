import {withExecution,executionFor} from '../../src/lib/ai/execution';
/** Optional diagnostics context for SDK serialization tests; never an admission gate. */
export const withTestExecution=<T>(work:()=>Promise<T>,_model?:string)=>withExecution(executionFor({requestId:'fixture-request',inputVersion:1,operation:'initial'}),work);
