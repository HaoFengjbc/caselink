import {unavailableResearch} from './fixtures/research';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_INPUT, NewCaseInputSchema, type NewCaseInput } from '../src/lib/contracts';
import { analyzeInput } from '../src/lib/ai/service';
import { buildRuleReference } from '../src/lib/retrieval/rules';
import { contextFor, lockUnspecifiedGoalActions, validateModelOutput } from '../src/lib/evidence/validate';
import { buildPromptData } from '../src/lib/ai/prompt';
import { hashInput } from '../src/lib/ai/hash';
import { analysisMarkdown } from '../src/components/results/export';
import { hasCustomGoal } from '../src/lib/intake/analysis';

const input = (): NewCaseInput => ({ ...structuredClone(EMPTY_INPUT), country: 'United Kingdom', primaryGoal: 'other', publicity: 'private', intake: {
  version: 1, jurisdiction: 'England and Wales', caseKind: 'civil', narrative: 'Our editor received a letter demanding removal of an article. We have not received a court claim.',
  goalText: 'Understand what the letter requests and prepare material for a local adviser.', disclosureDetails: 'Do not publish names or send the letter to media.',
  answers: [{ questionId: 'latest-document', question: 'What documents do you have?', answer: 'Only the letter; no court decision.' }],
  facts: [{ id: 'fact-1', text: 'The editor received a letter.', quote: 'Our editor received a letter' }], confirmed: true, expression: 'yes',
}});

describe('adaptive case record reaches analysis without forcing old categories', () => {
  it('preserves full original account, custom goal and partial disclosure boundaries', () => {
    const record = NewCaseInputSchema.parse(input());
    expect(record.stage).toBe('unknown');
    expect(record.intake?.caseKind).toBe('civil');
    const prompt = JSON.parse(buildPromptData(record, contextFor([]), [], 'en'));
    expect(prompt.userProvidedCase.intake).toEqual(record.intake);
    const changed = structuredClone(record); changed.intake!.disclosureDetails = 'Only a redacted copy may be shared with a lawyer.';
    expect(hashInput(changed)).not.toBe(hashInput(record));
  });
  it('rejects analysis of a changed, unconfirmed record', async () => {
    const draft = input(); draft.intake!.confirmed = false;
    await expect(analyzeInput(draft, { forceRule: true })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
  it('accepts explicit custom goals while unknown goals stay constrained', () => {
    const record = input(); expect(hasCustomGoal(record)).toBe(true);
    const result = buildRuleReference(record, [], 'en');
    expect(result.actionOptions[0].title).toContain('stated goal');
    expect(result.missingInformation.join(' ')).not.toContain('Current difficulties unknown');
    expect(result.missingInformation.join(' ')).toContain('against your original account');
    expect(result.actionOptions[0].goal).toBe('other');
    expect(lockUnspecifiedGoalActions(result, record, 'en')).toBe(result);
    expect(() => validateModelOutput(result, record, contextFor([]), 'en')).not.toThrow();
    record.primaryGoal = 'unknown'; expect(hasCustomGoal(record)).toBe(true);
    expect(buildRuleReference(record, [], 'en').actionOptions[0].title).toBe(result.actionOptions[0].title);
    record.intake!.goalText='';expect(hasCustomGoal(record)).toBe(false);
    expect(buildRuleReference(record, [], 'en').actionOptions[0].title).not.toBe(result.actionOptions[0].title);
  });
  it('gives the live model the reviewed corpus for narrative assessment and allows zero matches', async () => {
    const record = input(); const output = buildRuleReference(record, [], 'en');
    const transport = vi.fn(async ({ data }: { data: string }) => {
      const context = JSON.parse(data);
      expect(context.historicalCases.length).toBeGreaterThan(0);
      expect(context.historicalCases.length).toBeLessThanOrEqual(3);
      expect(context.heuristicComparisons.every((item: { relevance: string }) => item.relevance === 'related')).toBe(true);
      return { status: 'completed', output_parsed: output };
    });
    const result = await analyzeInput(record, { locale: 'en', config: { mode: 'live', configured: true, key: 'fake', model: 'test', timeoutMs: 1000, reasoningEffort: 'low', maxOutputTokens: 9000 }, researchTransport:unavailableResearch, transport });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(result.comparableCases).toHaveLength(0);
    const markdown = analysisMarkdown(result, record, 'en');
    expect(markdown).toContain(record.intake!.narrative);
    expect(markdown).toContain(record.intake!.answers[0].answer);
    expect(markdown).toContain(record.intake!.disclosureDetails);
  });
});
