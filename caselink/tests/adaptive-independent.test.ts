import {unavailableResearch} from './fixtures/research';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_INPUT, NewCaseInputSchema, type NewCaseInput } from '../src/lib/contracts';
import { analyzeInput } from '../src/lib/ai/service';
import { buildPromptData } from '../src/lib/ai/prompt';
import type { ServerConfig } from '../src/lib/ai/config';
import { contextFor, validateModelOutput } from '../src/lib/evidence/validate';
import { buildRuleReference } from '../src/lib/retrieval/rules';
import { analyzeIntake, validateIntakeOutput } from '../src/lib/intake/service';
import { analysisMarkdown } from '../src/components/results/export';

const config: ServerConfig = { mode: 'live', configured: true, key: 'unused-local-test-key', model: 'local-mock', timeoutMs: 1000, reasoningEffort: 'low', maxOutputTokens: 9000 };
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
function draft(narrative = 'Our fictional editor received a demand letter about a published investigation. No proceedings have been confirmed.'): NewCaseInput {
  return { ...structuredClone(EMPTY_INPUT), country: 'United Kingdom', primaryGoal: 'other', publicity: 'private', intake: {
    version: 1, jurisdiction: 'england_wales', caseKind: 'unknown', narrative,
    goalText: 'Organize the documents and identify the questions still unanswered.',
    disclosureDetails: '', answers: [], facts: [], confirmed: true, expression: 'yes',
  } };
}

// These are anonymized historical-context acceptance inputs, not claims about
// current case status or imported corpus entries. Goals below are test choices.
// Original snapshot/source notes: data/research/acceptance-scenarios.json.
const snapshots = [
  { name: 'blogger whose trial continues after bail', country: 'Malaysia', narrative: 'The report calls the person a blogger. Bail was posted, and the trial had begun. We do not know the current detention status.', goal: 'Check the documents for the next hearing.' },
  { name: 'reporter appealing a registry-information conviction', country: 'Hong Kong', narrative: 'The report describes a reporter using vehicle registry information for an investigation. A conviction and fine were imposed; the appeal was pending at the report date.', goal: 'Organize the appeal material without assuming the current outcome.' },
  { name: 'documentary maker after the case was dismissed', country: 'Uganda', narrative: 'The report describes bail in March and dismissal for want of prosecution in August. These are separate events; we do not claim bail caused the dismissal.', goal: 'Organize the case closure record and remaining questions.' },
  { name: 'organization and editor with different outcomes', country: 'Malaysia', narrative: 'According to the supplied report, the media organization was convicted over subscriber comments while the editor was acquitted. The comments were written by subscribers, not the editor.', goal: 'Clarify whether this discussion concerns the organization or the editor.' },
];

describe('independent adaptive workflow properties', () => {
  it('clears both the case record and the adaptive view containing its raw input identity', async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', { sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    }, dispatchEvent: vi.fn() });
    const session = await import('../src/lib/session');
    const input = draft('Sensitive case text that the user chooses to erase.');
    session.saveInput(input);
    storage.set(session.ADAPTIVE_VIEW_STORAGE_KEY, JSON.stringify({ version: 1, inputKey: session.inputKey(input), phase: 2, response: null, sourceKey: null, locale: 'en' }));
    storage.set('unrelated-preference', 'keep');
    session.clearSession();
    expect(session.readSession().input).toBeNull();
    expect(storage.has('caselink.session.v1')).toBe(false);
    expect(storage.has(session.ADAPTIVE_VIEW_STORAGE_KEY)).toBe(false);
    expect(storage.get('unrelated-preference')).toBe('keep');
  });

  it.each(snapshots)('preserves the account and custom goal without assigning a stage: $name', async ({ country, narrative, goal }) => {
    const input = draft(narrative); input.country = country; input.intake!.jurisdiction = 'unknown'; input.intake!.goalText = goal;
    const original = structuredClone(input);
    const parsed = NewCaseInputSchema.parse(input);
    const manual = await analyzeIntake(parsed, { locale: 'en', forceManual: true });
    expect(manual.mode).toBe('manual');
    const extracted = validateIntakeOutput({ facts: [{ quote: narrative }], questions: [] }, parsed, 'en', 'local-mock');
    expect(extracted.facts[0].quote).toBe(narrative);
    const payload = JSON.parse(buildPromptData(parsed, contextFor([]), [], 'en'));
    expect(payload.userProvidedCase.intake.narrative).toBe(narrative);
    expect(payload.userProvidedCase.intake.goalText).toBe(goal);
    expect(payload.userProvidedCase.stage).toBe('unknown');
    expect(payload.userProvidedCase.background.personType).toBe('unknown');
    expect(input).toEqual(original);
  });

  it('does not present rejected candidates as historical comparisons or supporting sources', async () => {
    const input = draft();
    const output = buildRuleReference(input, [], 'en');
    const transport = vi.fn(async () => ({ status: 'completed', output_parsed: output }));
    const result = await analyzeInput(input, { locale: 'en', config, researchTransport:unavailableResearch, transport });
    expect(transport).toHaveBeenCalledOnce();
    expect(result.comparableCases).toEqual([]);
    expect(result.actionOptions.every(action => action.supportingEvidenceIds.length === 0)).toBe(true);
    expect(result.historicalComparisons).toEqual([]);
    expect(result.sources).toEqual([]);
    expect(analysisMarkdown(result, input, 'en')).not.toMatch(/Myriam|Emna|Aigul/);
  });

  it.each(['details', 'answer'] as const)('does not let a broad public preference erase a specific private boundary in %s', async location => {
    const input = draft(); input.publicity = 'public';
    const boundary = 'Do not publish names or contact the media. Only share privately with the adviser.';
    if (location === 'details') input.intake!.disclosureDetails = boundary;
    else input.intake!.answers = [{ questionId: 'disclosure-details', question: 'What should stay private?', answer: boundary }];
    const output = buildRuleReference(input, [], 'en');
    Object.assign(output.actionOptions[0], { title: 'Publish the case now', applicability: 'priority', requiresPublicity: true });
    output.actionOptions[0].steps[0] = 'Immediately contact the media and publish the names in the case.';
    const transport = vi.fn(async () => ({ status: 'completed', output_parsed: output }));
    await expect(analyzeInput(input, { locale: 'en', config, researchTransport:unavailableResearch, transport })).rejects.toMatchObject({ code: 'INVALID_MODEL_OUTPUT' });
  });

  it('allows attributed user-case outcomes while still rejecting invented outcomes for corpus cases', () => {
    const input = draft(snapshots[3].narrative);
    const output = buildRuleReference(input, [], 'en');
    output.actionOptions[0].reason = 'Your account says the editor was acquitted while the organization was convicted; keep their records separate.';
    expect(() => validateModelOutput(output, input, contextFor([]), 'en')).not.toThrow();
    const unsupported = structuredClone(output);
    unsupported.actionOptions[0].reason = 'Emna Chargui was acquitted.';
    expect(() => validateModelOutput(unsupported, input, contextFor([]), 'en')).toThrow();
  });
});
