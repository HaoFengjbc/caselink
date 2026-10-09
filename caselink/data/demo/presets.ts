import { DEMO_SCENARIOS, DEMO_SCENARIOS_EN } from './fixtures';
import { buildRuleReference } from '../../src/lib/retrieval/rules';
import { retrieveCases } from '../../src/lib/retrieval/match';
import { cases } from '../../src/lib/corpus';
import { hashInput } from '../../src/lib/ai/hash';
import type { Locale } from '../../src/lib/i18n/locale';

// Frozen inputs get deterministic, evidence-bound outputs. No provider is called.
// New or edited inputs never qualify just because they retain an exampleId.
const PRESET_INPUTS=new Map([...DEMO_SCENARIOS,...DEMO_SCENARIOS_EN].map(example=>[hashInput(example.input),example.input]));
/** Preset result in the requested language for any fixed fictional input, whichever language it was written in. */
export function presetOutput(hash:string,locale:Locale){const input=PRESET_INPUTS.get(hash);return input?buildRuleReference(input,retrieveCases(input,cases,locale),locale):undefined;}
