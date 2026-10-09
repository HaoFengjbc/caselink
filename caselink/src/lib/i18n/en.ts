import { zh } from './zh';
import type { Locale } from './locale';

type Mirror<T> = { [K in keyof T]: { [L in keyof T[K]]: string } };

/** English option labels; keys mirror `zh` exactly. */
export const en: Mirror<typeof zh> = {
  stages: { investigation: 'Under investigation or threat', pretrial: 'Charged, summoned or awaiting trial', trial: 'On trial', appeal: 'On appeal', postjudgment: 'Judgment issued, no appeal (yet)', unknown: 'Not sure' },
  persons: { journalist: 'Journalist', blogger: 'Blogger', activist: 'Activist', other: 'Other', unknown: 'Not sure' },
  activities: { reporting: 'News reporting', investigation_report: 'Investigative reporting', social_media: 'Social media posts', repost: 'Sharing others’ content', other: 'Other', unknown: 'Not sure' },
  problems: { detained: 'Detained', lawyer_access: 'Hard to reach a lawyer', file_access: 'Hard to get case files', threats: 'Physical threats', expression_restricted: 'Speech or publishing restricted', other: 'Other', none: 'None of these so far', unknown: 'Not sure' },
  goals: { release: 'Release or bail', lawyer: 'Access to a lawyer', conditions: 'Better detention conditions', drop_charges: 'Stop the prosecution', change_judgment: 'Change the judgment', other: 'Other', unknown: 'Not sure yet — clarify first' },
  publicity: { public: 'Going public is an option', consent: 'Need consent first', private: 'Keep it private for now', unknown: 'Not sure' },
  resources: { lawyer: 'Has a lawyer', local_ngo: 'Local NGO', press_association: 'Press association', international: 'International partners', none: 'None yet', unknown: 'Not sure' },
  categories: { legal: 'Legal action in court', international: 'International bodies', media: 'Media', ngo: 'NGO collaboration', diplomatic: 'Diplomatic', monitoring: 'Monitoring & reporting', other: 'Other' },
  applicability: { priority: 'Consider first', conditional: 'Once conditions are met', defer: 'Hold for now' },
  modes: { live_ai: 'Live AI', rule_reference: 'Rule-based reference · no live AI', preset_demo: 'Preset demo result · no live AI' },
  outcomes: { specific: 'Specific outcome', partial: 'Partial change', pending: 'Pending', unrecorded: 'Not recorded' },
  origins: { direct_report: 'Stated directly in the report', unverified_footnote: 'Footnote citation, not independently checked', verified_supplement: 'Verified supplementary source' },
  basis: { web_research: 'Web research (to verify)', historical_action: 'Implemented historical action', report_recommendation: 'Report authors’ recommendation', general_preparation: 'General preparation' },
};

export type Labels = Mirror<typeof zh>;
export const labels: Record<Locale, Labels> = { zh, en };
