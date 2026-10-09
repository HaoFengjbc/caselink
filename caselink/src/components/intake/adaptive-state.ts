import { type NewCaseInput, type IntakeRecord } from '@/lib/contracts';
import { inputKey } from '@/lib/session';
import {hasIntakeQuote} from '@/lib/intake/contracts';

export {isUnitedKingdom} from '@/lib/jurisdiction';

export function withIntake(input: NewCaseInput): NewCaseInput & { intake: IntakeRecord } {
  return {
    ...input,
    intake: input.intake ?? { version: 1, jurisdiction: 'unknown', caseKind: 'unknown', narrative: input.background.description, goalText: '', disclosureDetails: '', answers: [], facts: [], confirmed: false },
  };
}

/** Source identity excludes editable interpretations and their confirmation state. */
export function intakeSourceKey(input: NewCaseInput): string {
  const current = withIntake(input);
  return inputKey({ ...current, intake: { ...current.intake, facts: [], confirmed: false } });
}

export function hasSourceQuote(record: IntakeRecord, quote: string): boolean {
  return hasIntakeQuote(record,quote);
}

/** Never truncate a person's existing answer when adding a shortcut. */
export function appendShortcutAnswer(previous: string, option: string): string | null {
  const next = previous && previous !== option ? `${previous}\n${option}` : option;
  return next.length <= 800 ? next : null;
}

/** A new answer never rewrites the source wording or a user's edited fact. */
export function changeIntake(input: NewCaseInput, changes: Partial<IntakeRecord>): NewCaseInput & { intake: IntakeRecord } {
  const current = withIntake(input);
  const primaryGoal=Object.prototype.hasOwnProperty.call(changes,'goalText')?(changes.goalText?.trim()?'other':'unknown'):current.primaryGoal;
  return { ...current, primaryGoal, intake: { ...current.intake, ...changes, confirmed: false } };
}

/** Migrate older drafts whose explicit written goal was never promoted by the old UI. */
export function confirmableIntake(input:NewCaseInput):NewCaseInput & {intake:IntakeRecord}{
 const current=withIntake(input);
 return current.primaryGoal==='unknown'&&current.intake.goalText.trim()?{...current,primaryGoal:'other'}:current;
}

/** Preserve every user edit when requesting another extraction. New excerpts only fill remaining slots. */
export function mergeIntakeFacts(existing:IntakeRecord['facts'],extracted:IntakeRecord['facts']):IntakeRecord['facts']{
 const combined=[...existing];
 for(const fact of extracted){if(combined.length>=12)break;if(combined.some(item=>item.quote===fact.quote))continue;
  let id=fact.id;let n=1;while(combined.some(item=>item.id===id))id=`${fact.id}-${n++}`;
  combined.push({...fact,id});
 }
 return combined;
}

type Expression = NonNullable<IntakeRecord['expression']>;
type Activity = NewCaseInput['background']['activities'][number];
/**
 * Record whether the matter involves journalism or expression. The answer also sets the background
 * activities used by library matching: kinds chosen for "yes" are kept, "not sure" stays unknown and "no" clears them.
 */
export function withExpression(input: NewCaseInput, expression: Expression, activities?: Activity[]): NewCaseInput & { intake: IntakeRecord } {
  const current = withIntake(input);
  const known = current.background.activities.filter(activity => activity !== 'unknown');
  const nextActivities: Activity[] = expression === 'yes' ? activities ?? known : expression === 'unsure' ? ['unknown'] : [];
  return { ...current, background: { ...current.background, activities: nextActivities }, intake: { ...current.intake, expression, confirmed: false } };
}

/** Two views of one fact record. AI preference is stored separately in session preferences. */
export function toClassicInput(input: NewCaseInput): NewCaseInput { return input; }

/** A written goal shown after “你眼下最希望” or “Your main goal:”, without a repeated wish verb or closing punctuation. */
export function goalPhrase(text: string, locale: 'zh' | 'en'): string {
  const trimmed = text.trim().replace(/[。．.!！?？;；,，:：\s]+$/u, '');
  return locale === 'en' ? trimmed : trimmed.replace(/^(我们|我)?(最)?(希望|想要|想)(能够|能)?/u, '') || trimmed;
}
