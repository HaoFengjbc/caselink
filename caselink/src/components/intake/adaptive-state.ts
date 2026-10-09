import { type NewCaseInput, type IntakeRecord } from '@/lib/contracts';
import { inputKey } from '@/lib/session';

export function isUnitedKingdom(country: string): boolean {
  const value = country.trim().toLowerCase().replace(/[.]/g, '').replace(/\s+/g, ' ');
  return ['英国', '聯合王國', '联合王国', '大不列颠及北爱尔兰联合王国', 'uk', 'united kingdom', 'the united kingdom', 'great britain', 'britain'].includes(value);
}

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
  return quote.trim().length > 0 && [record.narrative, ...record.answers.map(answer => answer.answer)].some(source => source.includes(quote));
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

/** The step-by-step form keeps no AI record: the person's own words stay as background text, the rest is dropped. */
export function toClassicInput(input: NewCaseInput): NewCaseInput {
  if (!input.intake) return input;
  const { intake, ...rest } = input;
  return { ...rest, background: { ...input.background, description: input.background.description.trim() || intake.narrative.trim().slice(0, 800) } };
}

/** A written goal shown after “你眼下最希望” or “Your main goal:”, without a repeated wish verb or closing punctuation. */
export function goalPhrase(text: string, locale: 'zh' | 'en'): string {
  const trimmed = text.trim().replace(/[。．.!！?？;；,，:：\s]+$/u, '');
  return locale === 'en' ? trimmed : trimmed.replace(/^(我们|我)?(最)?(希望|想要|想)(能够|能)?/u, '') || trimmed;
}
