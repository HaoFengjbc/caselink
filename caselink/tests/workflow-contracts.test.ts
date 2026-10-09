import {describe,expect,it} from 'vitest';
import {AnalysisRequestSchema,IntakeRequestSchema} from '../src/lib/analysis-protocol';
import {DEFAULT_PREFERENCES,UsePreferencesSchema,SourceDescriptorSchema,ResourceSchema,CanonicalJurisdictionSchema} from '../src/lib/contracts';
import {DEMO_SCENARIOS} from '../data/demo/fixtures';
import {hashInput} from '../src/lib/ai/hash';

describe('shared iteration protocol',()=>{
 it('keeps use and saving choices out of the complete fact identity',()=>{
  const input=structuredClone(DEMO_SCENARIOS[0].input);const original=hashInput(input);
  const base={input,requestId:'test-protocol-1',inputVersion:1,operation:'initial'};
  const memory=AnalysisRequestSchema.parse({...base,preferences:DEFAULT_PREFERENCES});
  const save=AnalysisRequestSchema.parse({...base,preferences:{aiEnabled:false,saveMode:'local',refreshRecovery:true,expiresAt:'2026-10-16T00:00:00.000Z'}});
  expect(hashInput(memory.input)).toBe(original);expect(hashInput(save.input)).toBe(original);
  expect(AnalysisRequestSchema.safeParse({...base,input:{...input,preferences:DEFAULT_PREFERENCES}}).success).toBe(false);
 });
 it('does not opt into persistence or refresh recovery by default',()=>{
  expect(UsePreferencesSchema.parse({})).toMatchObject({saveMode:'memory',refreshRecovery:false,expiresAt:null});
 });
 it('requires explicit identity and operation at both paid boundaries',()=>{
  const request={input:DEMO_SCENARIOS[0].input,requestId:'test-protocol-2',inputVersion:2,operation:'initial'};
  expect(AnalysisRequestSchema.safeParse(request).success).toBe(true);
  expect(IntakeRequestSchema.safeParse(request).success).toBe(true);
  expect(AnalysisRequestSchema.safeParse({...request,inputVersion:0}).success).toBe(false);
  expect(IntakeRequestSchema.safeParse({...request,requestId:undefined}).success).toBe(false);
 });
 it('does not conflate an agent source check with team verification',()=>{
  const source={sourceId:'standard-19',category:'international_standard',reviewStatus:'agent_checked',applicability:['Check treaty participation and the particular mechanism.'],locator:'Article 19',agentCheckedAt:'2026-10-09',teamReviewedAt:null,unknowns:[]};
  expect(SourceDescriptorSchema.parse(source).reviewStatus).toBe('agent_checked');
  expect(SourceDescriptorSchema.safeParse({...source,reviewStatus:'team_verified'}).success).toBe(false);
  const resource={resourceId:'standard-19',name:'Sample official reference',officialUrl:'https://www.ohchr.org/',checkedAt:'2026-10-09',applicability:'Conditioned reference',requiredMaterials:[],reviewStatus:'team_verified'};
  expect(ResourceSchema.safeParse(resource).success).toBe(false);
 });
 it('retains legacy resources without manufacturing review metadata',()=>{
  const resource={resourceId:'legacy',name:'Earlier resource',officialUrl:'https://example.org/',checkedAt:'2026-10-07',applicability:'Recorded conditions',requiredMaterials:[]};
  expect(ResourceSchema.parse(resource).teamReviewedAt).toBeUndefined();
 });
 it('rejects noncanonical country and legal-system codes',()=>{
  const canonical={countryCode:'GB',country:'United Kingdom',jurisdictionCode:'northern_ireland',legalSystem:'Northern Ireland',recognized:true};
  expect(CanonicalJurisdictionSchema.safeParse(canonical).success).toBe(true);
  expect(CanonicalJurisdictionSchema.safeParse({...canonical,countryCode:'UK'}).success).toBe(false);
  expect(CanonicalJurisdictionSchema.safeParse({...canonical,jurisdictionCode:'northern ireland'}).success).toBe(false);
 });
});
