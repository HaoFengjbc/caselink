import type { NewCaseInput } from '../contracts';

/** A confirmed written goal fills an untouched legacy default, never overrides a selected preset. */
export function effectiveGoal(input:NewCaseInput):NewCaseInput['primaryGoal'] {
  return input.primaryGoal==='unknown'&&input.intake?.confirmed===true&&!!input.intake.goalText.trim()?'other':input.primaryGoal;
}
export function normalizeConfirmedGoal(input:NewCaseInput):NewCaseInput {
  const primaryGoal=effectiveGoal(input);
  return primaryGoal===input.primaryGoal?input:{...input,primaryGoal};
}
/** A user-confirmed custom goal is not an unspecified goal. */
export function hasCustomGoal(input: NewCaseInput): boolean {
  return effectiveGoal(input) === 'other' && input.intake?.confirmed === true && !!input.intake.goalText.trim();
}
export function needsGoalClarification(input: NewCaseInput): boolean {
  const goal=effectiveGoal(input);
  return goal === 'unknown' || (goal === 'other' && !hasCustomGoal(input));
}

/** Free-form boundaries need human review; a broad public choice is not permission to ignore them. */
export function hasDisclosureNotes(input: NewCaseInput): boolean {
  return !!input.intake?.disclosureDetails.trim() || !!input.intake?.answers.some(answer => answer.questionId === 'disclosure-details' && !!answer.answer.trim());
}

/** Preserve the narrative and answers; model summaries are never used as verified evidence. */
export function narrativeForRetrieval(input: NewCaseInput): string {
  if (!input.intake?.confirmed) return '';
  return [input.intake.narrative, ...input.intake.answers.map(answer => answer.answer),...(input.intake.materials?.items.map(item=>`${item.subject} [${item.nature}; ${item.dateKind}: ${item.date??'unknown'}] ${item.text}`)??[])].join('\n');
}
