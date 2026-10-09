import type { NewCaseInput } from '../contracts';
import { zh } from './zh';
import { labels } from './en';
import { countryName } from './content';
import type { Locale } from './locale';

export const intakeCopy = {
  steps: [
    { title: '案件发生在哪个国家或地区？', short: '发生地点', hint: '法律情境会影响历史经验的适用性。只需填写国家或地区，不需要具体地址。', optional: false },
    { title: '案件现在进行到哪一步？', short: '程序阶段', hint: '选择最接近的已知进展；不适用或说不清时保留未知，也可改用自由描述。', optional: false },
    { title: '目前遇到哪些困难？', short: '当前困难', hint: '可以多选。即使暂时没有这些困难，也可以继续说明案件。', optional: false },
    { title: '案件与什么表达活动有关？', short: '案件背景', hint: '区分当事人的身份与相关表达活动，帮助找到可借鉴的背景。', optional: true },
    { title: '眼下最希望先改善什么？', short: '优先目标', hint: '先聚焦一个目标。暂不确定也没关系，我们会先帮助梳理问题。', optional: false },
    { title: '近期有哪些已知的重要日期？', short: '重要日期', hint: '例如下一次听证或已知的会面安排。大约时间也可以，不推算未提供的法定期限。', optional: true },
    { title: '目前有哪些支持？', short: '可用支持', hint: '可以多选。现有支持与资源限制会影响行动的前置条件。', optional: true },
    { title: '已经做过什么，收到什么回应？', short: '已尝试行动', hint: '记录已有尝试，有助于把下一步放在跟进或调整上。', optional: true },
    { title: '对外公开案件有哪些限制？', short: '公开限制', hint: '公开传播需要符合当事人的意愿。未知或需要征求意见时，不会默认建议立即公开。', optional: false },
  ],
  /** Three visual groups of the nine questions; `steps` holds the zero-based question indexes. */
  phases: [
    { title: '基本情况', steps: [0, 1, 2] },
    { title: '背景与目标', steps: [3, 4, 5] },
    { title: '资源与边界', steps: [6, 7, 8] },
  ],
  countries: ['突尼斯', '哈萨克斯坦'],
  exampleNotice: '虚构新案 · 仅用于体验，不属于历史案例库',
  priorStatuses: { none: '尚未采取行动', unknown: '不清楚', described: '已有行动和回应' },
  home: {
    eyebrow: '从案例经验，到有据可循的行动',
    title: '让过去的经验，',
    accent: '照亮下一步。',
    description: '从你的具体问题和诉求出发，在公开资料中查找可比经验、关键差异与下一步可以考虑的行动。',
    primary: '开始分析新案件', secondary: '体验示例案件',
    scope: '从真实问题出发 · 公开资料，有据可循',
  },
};

export type IntakeCopy = typeof intakeCopy;

export const intakeCopyEn: IntakeCopy = {
  steps: [
    { title: 'Where is the case taking place?', short: 'Location', hint: 'The legal setting affects how far past cases apply. A country or region is enough — no address needed.', optional: false },
    { title: 'What stage is the case at now?', short: 'Stage', hint: 'Choose the closest known position. If none fits, keep it unknown or use the free-form intake.', optional: false },
    { title: 'What difficulties are you facing?', short: 'Difficulties', hint: 'Choose all that apply. You can continue even if none of these apply yet.', optional: false },
    { title: 'What kind of expression is the case about?', short: 'Background', hint: 'Separating the person’s role from the expression involved helps find comparable backgrounds.', optional: true },
    { title: 'What do you most want to improve right now?', short: 'Priority goal', hint: 'Focus on one goal. Not sure yet? That’s fine — we’ll help sort out the problem first.', optional: false },
    { title: 'Any important dates coming up?', short: 'Key dates', hint: 'For example the next hearing or a known meeting. Approximate times are fine; no legal deadline you haven’t provided is ever calculated.', optional: true },
    { title: 'What support do you have?', short: 'Support', hint: 'Choose all that apply. Existing support and resource limits shape what each action needs first.', optional: true },
    { title: 'What has been tried, and what was the response?', short: 'Past actions', hint: 'Recording earlier attempts lets the next step focus on following up or adjusting.', optional: true },
    { title: 'What limits are there on going public?', short: 'Publicity', hint: 'Going public must follow the person’s wishes. If it is unknown or consent is needed, going public right away is never suggested.', optional: false },
  ],
  phases: [
    { title: 'The basics', steps: [0, 1, 2] },
    { title: 'Background & goal', steps: [3, 4, 5] },
    { title: 'Resources & limits', steps: [6, 7, 8] },
  ],
  countries: ['Tunisia', 'Kazakhstan'],
  exampleNotice: 'Fictional case · for the demo only, not part of the historical library',
  priorStatuses: { none: 'No action taken yet', unknown: 'Not sure', described: 'Actions and responses so far' },
  home: {
    eyebrow: 'From past cases to grounded next steps',
    title: 'Let past experience',
    accent: 'light the next step.',
    description: 'Start from your situation and stated goal. Research public sources for comparable experience, meaningful differences and actions to consider.',
    primary: 'Analyze a new case', secondary: 'Try a demo case',
    scope: 'Your actual situation · public sources, traceable references',
  },
};

export const intakeCopies: Record<Locale, IntakeCopy> = { zh: intakeCopy, en: intakeCopyEn };

/** Summary text that still marks an information gap rather than a concrete answer (Chinese summaries only). */
export const UNKNOWN_SUMMARY = /不清楚|不确定|未填写|未提供|待补充/;

/** Which of the nine answers are still gaps, decided from the data rather than from display text. */
export function unknownSteps(input: NewCaseInput): boolean[] {
  const country = input.country.trim();
  return [
    !country || country === 'unknown',
    input.stage === 'unknown',
    input.currentProblems.includes('unknown'),
    input.background.personType === 'unknown' || !input.background.activities.length || input.background.activities.includes('unknown'),
    input.primaryGoal === 'unknown',
    !input.keyDates.length || input.keyDates.some(d => !d.date.trim() || !d.event.trim()),
    !input.resources.length || input.resources.includes('unknown'),
    input.priorActions.status === 'unknown' || (input.priorActions.status === 'described' && !input.priorActions.description.trim()),
    input.publicity === 'unknown',
  ];
}

export function inputSummary(input: NewCaseInput, locale: Locale = 'zh'): string[] {
  if (locale === 'zh') return [
    input.country === 'unknown' ? '不清楚' : input.country || '尚未填写',
    zh.stages[input.stage],
    input.currentProblems.map(x => zh.problems[x]).join('、'),
    `${zh.persons[input.background.personType]} · ${input.background.activities.length ? input.background.activities.map(x => zh.activities[x]).join('、') : '活动未填写'}`,
    zh.goals[input.primaryGoal],
    input.keyDates.length ? input.keyDates.map(x => `${x.date || '日期不清楚'}${x.approximate ? '（大约 / 待确认）' : ''} · ${x.event || '事件待补充'}`).join('；') : '不清楚 / 暂未提供',
    input.resources.length ? input.resources.map(x => zh.resources[x]).join('、') : '不清楚 / 暂未提供',
    input.priorActions.status === 'described' ? input.priorActions.description || '待补充' : intakeCopy.priorStatuses[input.priorActions.status],
    zh.publicity[input.publicity],
  ];
  const L = labels.en;
  return [
    input.country === 'unknown' ? 'Not sure' : input.country ? countryName(input.country, 'en') : 'Not filled in yet',
    L.stages[input.stage],
    input.currentProblems.map(x => L.problems[x]).join(', '),
    `${L.persons[input.background.personType]} · ${input.background.activities.length ? input.background.activities.map(x => L.activities[x]).join(', ') : 'activity not filled in'}`,
    L.goals[input.primaryGoal],
    input.keyDates.length ? input.keyDates.map(x => `${x.date || 'date unknown'}${x.approximate ? ' (approx. / to confirm)' : ''} · ${x.event || 'event to add'}`).join('; ') : 'Not sure / not provided',
    input.resources.length ? input.resources.map(x => L.resources[x]).join(', ') : 'Not sure / not provided',
    input.priorActions.status === 'described' ? input.priorActions.description || 'to be added' : intakeCopyEn.priorStatuses[input.priorActions.status],
    L.publicity[input.publicity],
  ];
}
