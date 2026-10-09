import { describe, expect, it } from 'vitest';
import { EMPTY_INPUT, type IntakeRecord } from '@/lib/contracts';
import { appendShortcutAnswer, changeIntake, hasSourceQuote, intakeSourceKey, isUnitedKingdom, withIntake } from '@/components/intake/adaptive-state';

describe('adaptive intake source preservation', () => {
  it('does not silently truncate earlier answers when a shortcut exceeds the limit', () => {
    expect(appendShortcutAnswer('My own words.', 'Not sure')).toBe('My own words.\nNot sure');
    expect(appendShortcutAnswer('x'.repeat(798), 'No')).toBeNull();
    expect(appendShortcutAnswer('Not sure', 'Not sure')).toBe('Not sure');
  });
  it('recognizes UK aliases without assigning a jurisdiction to other countries', () => {
    for (const country of ['英国', 'UK', 'U.K.', 'United Kingdom', '  united   kingdom ']) expect(isUnitedKingdom(country)).toBe(true);
    for (const country of ['乌克兰', 'UKraine', 'France', 'unknown', '']) expect(isUnitedKingdom(country)).toBe(false);
  });
  it('retains original wording and edited notes while invalidating confirmation', () => {
    const input = withIntake(structuredClone(EMPTY_INPUT));
    input.intake.narrative = 'A hearing was postponed.';
    input.intake.facts = [{ id: 'fact-1', text: 'The user says a hearing was postponed.', quote: 'A hearing was postponed.' }];
    input.intake.confirmed = true;
    const changed = changeIntake(input, { narrative: 'The date has now changed.' });
    expect(changed.intake.confirmed).toBe(false);
    expect(changed.intake.facts).toEqual(input.intake.facts);
    expect(hasSourceQuote(changed.intake, changed.intake.facts[0]!.quote)).toBe(false);
    expect(input.intake.narrative).toBe('A hearing was postponed.');
  });
  it('allows source quotes from individual answers, never invented joins or edited notes', () => {
    const input = withIntake(structuredClone(EMPTY_INPUT));
    input.intake.narrative = 'No date is known.';
    input.intake.answers = [{ questionId: 'representation', question: 'Who can help?', answer: 'A lawyer is available.' }];
    input.intake.facts = [{ id: 'edited', text: 'Invented sentence.', quote: 'No date is known.' }];
    expect(hasSourceQuote(input.intake, 'A lawyer is available.')).toBe(true);
    expect(hasSourceQuote(input.intake, 'Invented sentence.')).toBe(false);
    expect(hasSourceQuote(input.intake, 'known.A lawyer')).toBe(false);
    expect(hasSourceQuote(input.intake, '')).toBe(false);
  });
  it('source identity changes with every meaningful raw edit but not interpretive text edits', () => {
    const input = withIntake(structuredClone(EMPTY_INPUT));
    input.country = 'UK';
    input.intake.narrative = 'Original narrative';
    const base = intakeSourceKey(input);
    expect(intakeSourceKey(changeIntake(input, { facts: [{ id: 'a', text: 'Edited note', quote: 'Original narrative' }] }))).toBe(base);
    const variants: Partial<IntakeRecord>[] = [{ narrative: 'New narrative' }, { jurisdiction: 'scotland' }, { goalText: 'A new priority' }, { disclosureDetails: 'Private only' }, { answers: [{ questionId: 'key-dates', question: 'When?', answer: 'Not sure' }] }];
    for (const changes of variants) {
      expect(intakeSourceKey(changeIntake(input, changes))).not.toBe(base);
    }
    expect(intakeSourceKey({ ...input, primaryGoal: 'release' })).not.toBe(base);
    expect(intakeSourceKey({ ...input, publicity: 'private' })).not.toBe(base);
  });
});
