import { type ActionOption, type NewCaseInput, type ModelAnalysisOutput } from '../contracts';
import { resources } from '../corpus';
import { labels } from '../i18n/en';
import type { Locale } from '../i18n/locale';
import { hasCustomGoal, hasDisclosureNotes, needsGoalClarification, normalizeConfirmedGoal } from '../intake/analysis';
import { knownCountry, retrieveCases, type MatchedCase } from './match';

type PlanGoal = Exclude<NewCaseInput['primaryGoal'], 'unknown' | 'other'>;
type PlanText = Pick<ActionOption, 'title' | 'steps' | 'materials' | 'followUp' | 'differences'>;

/** Evidence and basis per goal are language-independent; only the wording varies by locale. */
const GOAL_BASIS: Record<PlanGoal, Pick<ActionOption, 'supportingEvidenceIds' | 'basisType'>> = {
  release: { basisType: 'historical_action', supportingEvidenceIds: ['aigul-detention-challenge', 'aigul-discharge', 'aigul-house-arrest'] },
  lawyer: { basisType: 'historical_action', supportingEvidenceIds: ['emna-lawyer', 'emna-lawyer-denied'] },
  conditions: { basisType: 'historical_action', supportingEvidenceIds: ['aigul-walk-request'] },
  drop_charges: { basisType: 'report_recommendation', supportingEvidenceIds: ['myriam-dismiss-recommendation'] },
  change_judgment: { basisType: 'historical_action', supportingEvidenceIds: ['emna-appeal', 'aigul-appeal'] },
};

type RuleText = {
  /** Joins the reason fragments of the primary action. */
  sep: string;
  plans: Record<PlanGoal, PlanText>;
  base: { leadRole: string; prerequisite: string; timing: string; step: string };
  timeline: {
    titleFollowup: string; title: string; reasonFollowup: string; reason: string;
    timingDates: (n: number) => string; timingNoDates: string;
    step1: string; step2Followup: string; step2: string; step3: string; step4: string;
    materials: string[]; collaborators: string[]; followUp: string[]; uncertainties: string[];
  };
  clarify: Pick<ActionOption, 'title' | 'reason' | 'timing' | 'steps' | 'materials' | 'collaborators' | 'followUp' | 'uncertainties'>;
  external: {
    titlePrivate: string; title: string; reasonPrivate: string; reasonConsent: string; reasonPublic: (goal: string) => string;
    prerequisites: string[]; timingPrivate: string; timing: string;
    steps: string[]; materials: string[]; collaborators: string[]; followUp: string[]; differences: string[]; uncertainties: string[];
  };
  primary: {
    followupPrefix: string; reasonIntro: (goal: string) => string;
    reasonFollowup: string; reasonIncompatible: string; reasonNoEvidence: string; reasonNoLawyer: string;
    prerequisiteGoal: string; prerequisiteFindLawyer: string; prerequisiteCheckLawyer: string; prerequisiteIncompatible: string;
    timingUnknown: string; timingStage: (stage: string) => string; followupStep: string;
    collaboratorLawyer: string; collaboratorNgo: string; collaboratorCoordinator: string;
    differencesFallback: string; uncertainty: string; uncertaintyConstraints: string;
  };
  missing: { country: string; stage: string; problems: string; goal: string; person: string; lawyer: string; dates: string; publicity: string; prior: string };
  limitations: string[];
  noMatches: string;
};

const ZH: RuleText = {
  sep: '',
  plans: {
    release: { title: '由律师评估当前拘押措施的审查路径',
      steps: ['分别列清目前限制：拘押地点、实施机关、作出决定的人、是否存在医疗观察或居家限制；不要将不同措施合写成“被捕”。', '请适当的本地律师核对决定副本、理由、救济机关及是否存在保释或变更措施路径，先确认当前程序是否允许。', '围绕最需要改变的那一项措施，整理事实、替代安排与支持材料，由律师判断是否提交以及具体诉求。', '如律师认为可提交，记录实际提交日期、接收机关和回执；不能从历史案推算新案法定期限。', '收到回应后逐项核对：仅取消一种安全措施、允许离开某机构，还是所有拘押限制解除；分别记录。'],
      materials: ['拘押或限制决定的已有副本、尚缺文件清单', '目前限制的分项表：地点／依据／决定机关／实际影响', '可由律师核验的居住、健康与照护资料；只保留必要信息', '已经提交的请求与实际收到的书面回应'],
      followUp: ['决定是否送达、是否收到受理或补件回应', '变化覆盖了哪些限制，哪些仍然持续', '没有回应时由律师确定下一次核实时间，不默认再次提交同一申请'],
      differences: ['Aigul案辩护投诉与检方纠错并行，不能把后续出院单独归因于辩护投诉。', '离开精神医疗机构并非完全获释；当地法律路径和新案决定类型仍待核对。'] },
    lawyer: { title: '确认律师能否在下一程序实际提供协助',
      steps: ['将下一次程序的机关、地点、通知方式和已知日期列成一页记录；区分司法警察讯问、检方讯问与庭审。', '经当事人同意，寻找了解本地程序的律师；若已有律师，先确认委托范围、是否能会见及参加该次程序。', '向律师说明已经遇到的联系或在场障碍，并提供传唤／拒绝记录，询问需要哪些授权或申请。', '由律师核实可以采用的申请与记录方式；收到拒绝时保留机关、时间、具体理由及证据，避免自行断言权利已获得保障。', '在实际程序后确认律师是否成功接触、取得材料、出席；一次允许陪同不代表后续机关同样允许。'],
      materials: ['传唤、通知及下一次程序信息', '联系律师的尝试与拒绝经过', '已有委托或授权文件的状态', '当事人希望律师优先解决的问题清单'],
      followUp: ['是否已有适当律师接受委托，约定了具体下一步', '律师是否实际获准会见或在场', '若机关变化，重新核实准入安排'],
      differences: ['Emna案一次司法警察讯问有律师陪同，翌日检方讯问却不准律师在场。', '历史律师的姓名不能作为当前可接受新案委托的承诺。'] },
    conditions: { title: '把拘押条件需求转成可核对的具体请求',
      steps: ['先确认确有持续拘押或其他行动限制，以及需要改善的具体条件，如就医、日常活动或家属联络。', '由当事人和律师把每项需要写成“目前情况—影响—拟请求调整”的记录，医疗判断交由合适专业人员核实。', '请本地律师核对负责机关、提出请求的方式及必要材料；不要照搬历史案的法院表态或散步时长。', '若采取行动，保留提出的具体请求与接收记录，分别追踪是否实际执行。', '收到拒绝或部分允许后，把理由与仍未解决的条件整理给律师，决定是否补充事实或采用其他适用程序。'],
      materials: ['具体条件与发生频次的事实记录', '已有医疗或照护说明，仅使用获准披露的部分', '当前措施及管辖机关信息', '此前同类请求及回应'],
      followUp: ['是否得到书面或可核对的回应', '改善是否在实际拘押安排中执行', '是否仍存在需要及时向专业人员说明的健康需求'],
      differences: ['Aigul案的短时散步请求未获准，只证明提出请求与回应，不能证明这条路径有效。', '不同拘押形式、健康情形与当地程序可能完全不同。'] },
    drop_charges: { title: '整理针对指控的审查材料，供律师评估停止追诉路径',
      steps: ['取得或核对指控原文、具体表达内容及发表语境，区分用户陈述、当局指控与已经有材料支持的事实。', '将指控所指行为与原始报道／转发逐项对照，保留原始上下文和获取日期，不自行作罪名成立与否的判断。', '请本地律师判断当前机关及阶段有哪些适用路径，明确是提出辩护、请求停止追诉还是其他程序。', '如律师认为应提出请求，由律师确定法律依据、适格提出者和需要补充的证据；组织可准备案情摘要协助。', '把已提出的主张、机关回应与尚未裁决事项分开记录。没有终局文书时，保持结果为未决。'],
      materials: ['起诉／传唤文件及法条原文（如有）', '被指表达的完整内容、语境及可信来源', '已发生程序及已知日期的时间线', '支持和不支持己方陈述的材料清单'],
      followUp: ['律师是否确认了当前可行的具体程序', '机关是否实际作出停止追诉决定', '听证延期与实体处理分别记录'],
      differences: ['Myriam报告呼吁撤诉，但并未记载撤诉发生；它不能证明该建议带来成功。', '提出法律主张与获得实体处理结果不同，需要持续核对实际回应。'] },
    change_judgment: { title: '与律师核对判决及现有复核进度',
      steps: ['确认判决是否已作出、是否正式送达，保存可得的判决书；若仍在调查或审判，先核实目标与阶段是否一致。', '由适当律师核实可用救济、资格及实际适用期限。本工具不从报告中的历史天数计算新案期限。', '已在上诉的，优先整理提交证明、争议事项、听证通知和补充材料需求，避免重复提交相同请求。', '尚未进入上诉的，由律师判断是否及如何提出，逐项核对判决争议与案卷证据。', '分别记录已受理、待开庭、程序障碍和最终裁判；跨境居留或庇护变化不能作为定罪已撤销的依据。'],
      materials: ['判决文书与送达信息', '已有上诉或其他复核提交记录', '律师列出的具体争议与材料缺口', '实际出席安排和已经收到的通知'],
      followUp: ['是否已获得受理或补件信息', '当事人与律师能否参加相关程序', '最终裁判是否明确改变原判、改变哪些部分'],
      differences: ['Aigul的定罪上诉被驳回；Emna的上诉在报告时未决，这两种状态必须区分。', 'Emna宣判日存在报告内部冲突，不能计算精确行动间隔，也不能移用其历史期限。'] },
  },
  base: { leadRole: '当事人本人或其明确授权的协助者', prerequisite: '确认当事人的诉求及允许共享的资料范围', timing: '按实际事件与已收到的通知安排，不计算法定期限', step: '核对材料' },
  timeline: {
    titleFollowup: '先核对已尝试行动的回应与下一节点', title: '建立可交给协助者的一页案情记录',
    reasonFollowup: '已有行动记录，先确认是否收到回应、尚缺什么，再决定是否调整；不默认重复申请。', reason: '清楚的阶段、文件与近期节点有助于协助者判断下一步。此项是一般准备建议。',
    timingDates: n => `已提供${n}个日期或事件，请按确认页中的节点与负责人员核对安排；大约时间需要再次确认，不当作法定期限。`, timingNoDates: '先按原叙述和补充回答排序已有事件；只核实有争议的日期，不把缺少日期当成尚未发生。',
    step1: '用“日期／机关或角色／发生事项／材料位置／未确定内容”五栏建立时间线，近似日期单独标明。',
    step2Followup: '单列此前行动、提交凭证、已收到回应和尚未回应部分，向原负责人员核对后决定补件或调整。',
    step2: '将尚未做过、材料没有提到和确实不知道分别记录，避免把未知写成未发生。',
    step3: '把原始材料与摘要分开，逐项注明来自本人经历、对方回应、聊天或支付记录、正式文件中的哪一种。',
    step4: '仅向经当事人同意的协助者分享所需片段；记录对方反馈、负责人与下一次核实节点。',
    materials: ['一页时间线', '已有约定、往来记录、通知或回执目录', '主张／来源／待核实内容对照表'], collaborators: ['当事人本人', '本人明确授权的协助者（如有）'],
    followUp: ['哪一项缺失材料已经补齐', '是否找到负责确认下一节点的人', '之前的请求有没有新增回应'], uncertainties: ['具体适用程序与期限需本地专业人员确认。'],
  },
  clarify: { title: '先确认你希望改变的具体事情', reason: '尚未提供明确诉求；这项规则模板仅帮助你确定希望得到的变化，不替你选择目标或处理路径。', timing: '选择具体处理路径之前',
    steps: ['写明希望哪一方改变什么、自己想获得什么，以及不愿接受的处理方式；不要求提供姓名或证件信息。', '把已经发生的事件、双方尚有争议的说法、希望改变的结果分开，不把不清楚的内容补成事实。', '如果同时有多项诉求，请本人确定优先顺序；可以继续保留不确定，不需要先聘请律师才表达诉求。', '确认后填写自己的目标再分析；这份规则模板不会代替针对具体诉求的分析。'],
    materials: ['希望得到的变化与顾虑清单', '已发生事件及现有材料目录'], collaborators: ['当事人本人或获授权的代表'],
    followUp: ['是否获得明确且可更改的优先需求', '是否仍有无法判断的风险或信息缺口'], uncertainties: ['目标未确定，本轮不建议采取具体法律行动或启动公开传播。'] },
  external: {
    titlePrivate: '暂缓公开传播，先准备授权与风险核对表', title: '评估独立观察、公开材料或外部机制协助',
    reasonPrivate: '公开限制尚不支持传播，当前只准备内部资料；未经重新确认，不开展公开倡导。', reasonConsent: '需先取得具体披露同意，再由适当组织判断公开或外部机制是否适合当前目标。',
    reasonPublic: goal => `可考虑公开，但需把“${goal}”与传播目的对齐，并核实合作方与安全条件。`,
    prerequisites: ['明确当事人是否同意披露姓名、案情以及可能被转给政府或其他相关方的信息', '与律师核对披露对正在进行程序的影响', '确认合作机构当前范围、材料要求及信息处理方式；历史参与不等于今天承诺受理'],
    timingPrivate: '先保持私下处理；只有用户重新确认公开范围后才评估下一步。', timing: '在当事人确认披露范围、律师核对程序风险并确认合作方之后。',
    steps: ['先填写内部表：“希望解决什么／可公开哪些事实／必须删除什么／谁批准／谁负责反馈”。私下或未知状态在此停止，不发布。', '若获得具体授权，制作去除非必要身份信息的一页摘要，按已核实事实、当事人陈述、待核实内容分栏，附可核对材料目录。', '与适当组织核对是否能做庭审观察、事实核实或外部机制材料评估；不把联合国国别访问建议当成已受理的个案程序。', '如考虑特别程序，先阅读已核实官方指引，核对可信事实材料、当事人同意及可能披露给相关方的内容，再由授权人员决定是否提交。', '草稿可用：“我们希望就〔当前目标〕请求评估。已确认事实为〔事实与来源〕，当前阶段为〔阶段〕，可披露范围为〔授权〕，希望了解适用范围与材料要求。”本工具不会发送。', '若实际获准开展，记录发出版本、接收方、回应、补件及对外公开范围；回执不等于介入或结果改变。'],
    materials: ['经当事人确认的信息披露与授权记录', '去除非必要身份信息的事实摘要及佐证目录', '面向合作方的具体请求草稿', '风险、撤回或修改公开信息的处理预案'], collaborators: ['有相关工作范围、待核实是否接受协作的公益组织', '现有律师与获授权的案件协调人员'],
    followUp: ['是否仅有收件回执，还是有实质回应／补件请求', '实际披露范围是否仍符合授权', '公开或联系后是否出现新的安全顾虑，需要调整范围'],
    differences: ['报告中的国别访问呼吁是作者建议，不是联合国已经介入个案。', '历史庭审监测或公开报告不证明能够改变司法结果；目前合作方与机制适用性须单独核对。'],
    uncertainties: ['公开倡导和外部机制不是替代本地法律程序的保证。', '任何机制是否采取行动、回应时间及具体结果均未知。'],
  },
  primary: {
    followupPrefix: '核对既有进展，再评估：', reasonIntro: goal => `围绕“${goal}”整理下一步。`,
    reasonFollowup: '已有尝试，先核对其回应和材料缺口，避免重复提交。', reasonIncompatible: '目标与已知阶段或拘押状态仍需对照确认。', reasonNoEvidence: '未匹配到直接相关历史行动依据，本卡仅为一般准备参考。', reasonNoLawyer: '需先获得适当的本地法律支持。',
    prerequisiteGoal: '由当事人确认当前目标与可共享的信息范围', prerequisiteFindLawyer: '先找到能够处理本地相关程序的律师；组织可协助寻找，但不替代律师作程序判断。', prerequisiteCheckLawyer: '确认现有律师能处理当前机关与程序。', prerequisiteIncompatible: '先确认当前阶段、拘押状态或判决是否已作出，再决定是否启动具体行动。',
    timingUnknown: '先核对阶段，不建议立即提交具体程序申请。', timingStage: stage => `在“${stage}”阶段，由律师核对当前可行路径；具体日期以实际通知为准。`,
    followupStep: '先向原负责人员核对已经提出的请求、回执和回应，标出仍未解决部分；以下步骤仅补缺或调整，不默认重新提交。',
    collaboratorLawyer: '适当的本地律师', collaboratorNgo: '现有公益组织可按授权协助整理材料', collaboratorCoordinator: '经当事人同意的案件协调人员',
    differencesFallback: '历史材料或当前可比背景不足，具体路径与结果不能直接移用；本卡只在实际列出的证据范围内提供参考。',
    uncertainty: '本工具未核实新案指控是否属实，具体法律依据和可行性需要本地专业判断。', uncertaintyConstraints: '用户已说明资源限制；应与负责人员确认上述分工是否可落实，必要时分阶段安排。',
  },
  missing: { country: '所在地未知：需要确认适用管辖，不能移用历史案的当地程序。', stage: '程序阶段未知：先核对最近一份正式通知及负责机关。', problems: '目前实际困难未知：需要区分拘押、律师接触和表达限制。', goal: '主要目标尚未具体确定：先由当事人确认优先需求。', person: '当事人身份未知，不能默认适用于记者专属协助范围。', lawyer: '尚未确认可实际处理该程序的本地律师。', dates: '没有已知的下一程序日期；本工具不推算任何法定期限。', publicity: '需要确认具体披露同意；当前公开限制约束对外倡导。', prior: '既往尝试与回应未知：先询问协调者，避免重复动作。' },
  limitations: ['案例库使用已核对的历史报告，各案仅截至所标明的报告时间；未核查此后的全部进展。', '排序是按已知背景、身份、历史事件阶段和困难的透明规则；不表示成功概率或因果效果。', '材料没记载某行动不等于该行动未发生；程序性变化不等于终局结果。'],
  noMatches: '当前资料库没有足够相关背景，以下只提供一般准备参考，不冒充历史证据支持。',
};

const EN: RuleText = {
  sep: ' ',
  plans: {
    release: { title: 'Have a lawyer assess how to challenge the current detention measure',
      steps: ['List each current restriction separately: place of detention, implementing authority, who decided it, and whether there is medical observation or house arrest. Do not lump different measures together as “arrest”.', 'Ask a suitable local lawyer to check the decision documents, the stated grounds, the reviewing authority, and whether bail or a change of measure is possible — first confirm the current procedure allows it.', 'Focus on the one measure that most needs to change: gather the facts, alternative arrangements and supporting material, and let the lawyer decide whether to file and what to ask for.', 'If the lawyer decides to file, record the actual filing date, the receiving authority and the receipt. Never infer a new case’s legal deadlines from a past case.', 'When a response comes, check it item by item — was one security measure lifted, was leaving a facility allowed, or were all restrictions removed? Record each separately.'],
      materials: ['Copies of the detention or restriction decisions you have, and a list of missing documents', 'A breakdown of current restrictions: place / legal basis / deciding authority / actual impact', 'Housing, health and care information a lawyer can verify — only what is necessary', 'Requests already filed and any written responses actually received'],
      followUp: ['Whether the decision was served, and whether an acknowledgement or request for more documents came back', 'Which restrictions changed and which are still in place', 'If there is no response, the lawyer sets the next check-in — do not refile the same request by default'],
      differences: ['In Aigul’s case the defense complaint ran alongside a prosecution petition, so her later discharge cannot be credited to the defense complaint alone.', 'Leaving the psychiatric facility was not full release; the local legal route and the type of decision in the new case still need checking.'] },
    lawyer: { title: 'Confirm whether a lawyer can actually help at the next proceeding',
      steps: ['Put the next proceeding on one page: the authority, place, how notice was given, and any known date. Distinguish a judicial police interview, a prosecutor’s interrogation, and a trial hearing.', 'With the person’s consent, look for a lawyer who knows local procedure; if there already is one, confirm the scope of the mandate and whether they can meet the person and attend that proceeding.', 'Tell the lawyer about any obstacles already met in reaching the person or being present, share the summons or refusal records, and ask what authorizations or applications are needed.', 'Let the lawyer confirm which applications and records to use; if refused, keep the authority, time, stated reason and evidence, and do not claim the right has been secured.', 'After the proceeding, confirm whether the lawyer actually got access, obtained files and attended; being allowed once does not mean later authorities will allow it too.'],
      materials: ['Summons, notices and details of the next proceeding', 'A record of attempts to reach a lawyer and any refusals', 'Status of any existing mandate or power of attorney', 'The issues the person most wants the lawyer to tackle first'],
      followUp: ['Whether a suitable lawyer has accepted the case and agreed a concrete next step', 'Whether the lawyer was actually allowed to meet the person or attend', 'If the authority changes, re-check the access arrangements'],
      differences: ['In Emna’s case a lawyer accompanied her to one judicial police interview, but was barred from the prosecutors’ interrogation the next day.', 'A historical lawyer’s name is no promise that they can take on a new case.'] },
    conditions: { title: 'Turn detention-condition needs into specific, checkable requests',
      steps: ['First confirm there is ongoing detention or another restriction on movement, and which conditions need to improve — such as medical care, daily activity or contact with family.', 'With the person and the lawyer, write each need as “current situation — impact — requested change”; leave medical judgments to suitable professionals.', 'Ask a local lawyer to confirm the responsible authority, how to make the request and what is needed; do not copy a past court’s statements or walk durations.', 'If you act, keep a record of the exact request and its receipt, and track separately whether it is actually carried out.', 'If refused or partly granted, give the lawyer the reasons and the conditions still unresolved, and decide whether to add facts or use another applicable procedure.'],
      materials: ['A factual record of the specific conditions and how often they occur', 'Existing medical or care notes — only the parts cleared for disclosure', 'The current measure and the authority in charge', 'Earlier similar requests and responses'],
      followUp: ['Whether there is a written or verifiable response', 'Whether improvements are actually carried out in the detention arrangements', 'Whether there are still health needs to raise promptly with professionals'],
      differences: ['Aigul’s request for short walks was refused; it only shows a request and a response, not that this route works.', 'Forms of detention, health situations and local procedures can be entirely different.'] },
    drop_charges: { title: 'Prepare a review of the charges for a lawyer to assess routes to ending the prosecution',
      steps: ['Obtain or check the wording of the charges, the exact expression involved and its context; separate the user’s account, the authorities’ allegations, and facts already backed by documents.', 'Match each alleged act against the original post or report, keeping the original context and the date it was obtained; do not judge whether the offense is made out.', 'Ask a local lawyer which routes apply at the current authority and stage — a defense, a request to end the prosecution, or another procedure.', 'If the lawyer decides a request should be made, the lawyer sets the legal basis, who may file it and the evidence still needed; an organization can help prepare a case summary.', 'Record the arguments made, the authority’s responses and the issues still undecided separately. Without a final decision, keep the outcome as pending.'],
      materials: ['The indictment or summons and the text of the cited law (if available)', 'The full expression at issue, its context and reliable sources', 'A timeline of proceedings so far and known dates', 'A list of material that does and does not support your account'],
      followUp: ['Whether the lawyer has confirmed a concrete, available procedure', 'Whether the authority actually decided to end the prosecution', 'Record hearing postponements separately from decisions on the merits'],
      differences: ['Myriam’s report calls for the charges to be dropped but does not record that it happened; it cannot show the recommendation worked.', 'Making a legal argument is not the same as obtaining a decision on it; keep checking the actual response.'] },
    change_judgment: { title: 'Check the judgment and any review already under way with a lawyer',
      steps: ['Confirm whether a judgment has been issued and formally served, and keep a copy if you can; if the case is still under investigation or on trial, first check that the goal fits the stage.', 'Have a suitable lawyer confirm the remedies available, who can use them and the deadlines that actually apply. This tool does not calculate deadlines for a new case from day counts in reports.', 'If an appeal is already under way, first gather proof of filing, the issues in dispute, hearing notices and any requests for more documents — avoid refiling the same request.', 'If no appeal has been filed, the lawyer decides whether and how to file, checking each disputed point against the case file.', 'Record acceptance, pending hearings, procedural obstacles and the final ruling separately; residence abroad or asylum is not evidence that a conviction was overturned.'],
      materials: ['The judgment and service details', 'Records of any appeal or other review already filed', 'The specific disputed points and missing documents listed by the lawyer', 'Actual attendance arrangements and notices already received'],
      followUp: ['Whether the filing was accepted or more documents were requested', 'Whether the person and the lawyer can attend the relevant proceedings', 'Whether the final ruling clearly changes the original judgment, and which parts'],
      differences: ['Aigul’s appeal against her conviction was rejected; Emna’s appeal was pending at the time of the report — these two states must be kept apart.', 'Emna’s verdict date conflicts within her report, so precise intervals cannot be calculated and her historical deadlines cannot be reused.'] },
  },
  base: { leadRole: 'The person or a helper they explicitly authorize', prerequisite: 'Confirm the person’s stated goal and what information may be shared', timing: 'Use actual events and notices received; no legal deadlines are calculated', step: 'Check the materials' },
  timeline: {
    titleFollowup: 'First check responses to past actions and the next milestone', title: 'Build a one-page case record to hand to helpers',
    reasonFollowup: 'There are earlier actions on record: first confirm whether responses came back and what is still missing, then decide whether to adjust — no refiling by default.', reason: 'A clear picture of the stage, documents and upcoming milestones helps helpers judge the next step. This is a general preparation suggestion.',
    timingDates: n => `You provided ${n} date${n === 1 ? '' : 's'} or event${n === 1 ? '' : 's'}; check the arrangements against the milestones and people on the review page. Approximate times need reconfirming and are not treated as legal deadlines.`, timingNoDates: 'Order events already described in the account and answers; clarify disputed dates without treating a missing date as an event that never happened.',
    step1: 'Build a five-column timeline — date / authority or role / what happened / where the document is / what is still unconfirmed — and mark approximate dates separately.',
    step2Followup: 'List earlier actions, filing receipts, responses received and parts still unanswered; check with the person originally responsible before adding documents or adjusting.',
    step2: 'Record separately what has not been done, what the material does not mention, and what is genuinely unknown, so unknowns are not written up as things that never happened.',
    step3: 'Keep original material separate from the summary, linking each account to personal experience, the other party’s reply, messages, payment records or official documents.',
    step4: 'Share only the necessary parts with helpers the person has agreed to; record their feedback, who is responsible, and the next check-in.',
    materials: ['A one-page timeline', 'An index of existing agreements, messages, notices or receipts', 'A table of claims / sources / points to verify'], collaborators: ['The person', 'A helper explicitly authorized by the person, if any'],
    followUp: ['Which missing documents have been obtained', 'Whether someone has been found to confirm the next milestone', 'Whether there are new responses to earlier requests'], uncertainties: ['The applicable procedures and deadlines must be confirmed by local professionals.'],
  },
  clarify: { title: 'Confirm the specific change you want', reason: 'No clear goal has been provided. This rule template helps identify the desired change; it does not choose an outcome or route on your behalf.', timing: 'Before choosing a specific route',
    steps: ['Describe what you want which party to change, what you want to receive and which outcomes you would not accept; no name or ID is needed.', 'Separate events already described, disputed accounts and the desired outcome. Do not fill factual gaps with assumptions.', 'If there are several wishes, let the person set their priority or remain unsure. A lawyer is not needed simply to state a goal.', 'Once the goal is confirmed, enter it and analyze again; this rule template does not replace analysis of the specific request.'],
    materials: ['A list of desired changes and concerns', 'A record of events and material already available'], collaborators: ['The person or an authorized representative'],
    followUp: ['Whether a clear (and changeable) priority has been set', 'Whether risks or information gaps remain that cannot yet be judged'], uncertainties: ['With no goal set, this round does not suggest specific legal action or starting public outreach.'] },
  external: {
    titlePrivate: 'Hold off on going public; prepare a consent and risk checklist first', title: 'Assess independent monitoring, public material or outside mechanisms',
    reasonPrivate: 'The publicity limits do not allow outreach yet, so only internal material is prepared; no public advocacy without reconfirming.', reasonConsent: 'Specific consent to disclose comes first; then a suitable organization can judge whether going public or an outside mechanism fits the current goal.',
    reasonPublic: goal => `Going public is possible, but it must serve “${goal}”, and partners and safety conditions must be checked.`,
    prerequisites: ['Confirm whether the person agrees to disclose their name, the facts of the case, and information that may be passed to the government or other parties', 'Check with the lawyer how disclosure could affect ongoing proceedings', 'Confirm the partner organization’s current scope, material requirements and how it handles information; past involvement is no promise to take a case today'],
    timingPrivate: 'Keep it private for now; only assess next steps after the user reconfirms what may be made public.', timing: 'After the person confirms the scope of disclosure, the lawyer checks procedural risks, and a partner is confirmed.',
    steps: ['First fill in an internal sheet: “what we want to solve / which facts may be shared / what must be removed / who approves / who handles feedback”. If the status is private or unknown, stop here — nothing is published.', 'If specific consent is given, prepare a one-page summary without unnecessary identifying details, splitting verified facts, the person’s account and points still to verify, with an index of supporting material.', 'Check with suitable organizations whether they can observe the trial, verify facts, or assess material for an outside mechanism; a UN country-visit recommendation is not an individual case that has been taken up.', 'If considering the Special Procedures, first read the verified official guidance and check credible factual material, the person’s consent and what may be disclosed to the parties concerned; an authorized person then decides whether to submit.', 'A draft you can adapt: “We would like an assessment regarding [current goal]. The confirmed facts are [facts and sources], the current stage is [stage], what may be disclosed is [consent], and we would like to understand the scope and material requirements.” This tool sends nothing.', 'If you do go ahead, record the version sent, the recipient, responses, extra requests and how much was made public; an acknowledgement is not intervention or a changed outcome.'],
    materials: ['A record of the person’s confirmed consent and authorization to disclose', 'A factual summary without unnecessary identifying details, with an index of evidence', 'A draft of the specific request to the partner', 'A plan for risks and for withdrawing or correcting public information'], collaborators: ['NGOs working in the area — still to be checked whether they take on cases', 'The existing lawyer and an authorized case coordinator'],
    followUp: ['Whether there is only an acknowledgement, or a substantive response / request for more material', 'Whether what was actually disclosed still matches the consent given', 'Whether going public or making contact has raised new safety concerns that call for narrowing the scope'],
    differences: ['The country-visit call in the reports is an authors’ recommendation, not UN involvement in an individual case.', 'Historical trial monitoring or public reports do not show they can change court outcomes; current partners and mechanisms must be checked separately.'],
    uncertainties: ['Public advocacy and outside mechanisms are no guarantee and do not replace local legal proceedings.', 'Whether any mechanism acts, how long a response takes, and what results follow are all unknown.'],
  },
  primary: {
    followupPrefix: 'Check existing progress, then assess: ', reasonIntro: goal => `Next steps organized around “${goal}”.`,
    reasonFollowup: 'There are earlier attempts: first check their responses and missing material to avoid refiling.', reasonIncompatible: 'The goal still needs checking against the known stage or detention status.', reasonNoEvidence: 'No directly relevant historical action was matched, so this card is general preparation only.', reasonNoLawyer: 'Suitable local legal support is needed first.',
    prerequisiteGoal: 'The person confirms the current goal and what information may be shared', prerequisiteFindLawyer: 'First find a lawyer who can handle the relevant local proceedings; an organization can help look, but it does not replace a lawyer’s procedural judgment.', prerequisiteCheckLawyer: 'Confirm the existing lawyer can handle the current authority and procedure.', prerequisiteIncompatible: 'First confirm the current stage, detention status, or whether a judgment has been issued, before starting any specific action.',
    timingUnknown: 'Confirm the stage first; filing a specific procedural application right away is not recommended.', timingStage: stage => `At the “${stage}” stage, the lawyer checks which routes are currently available; actual dates follow the official notices.`,
    followupStep: 'First check with the person originally responsible the requests already made, receipts and responses, and mark what is still unresolved; the steps below only fill gaps or adjust — no refiling by default.',
    collaboratorLawyer: 'A suitable local lawyer', collaboratorNgo: 'The existing NGO can help organize material, as authorized', collaboratorCoordinator: 'A case coordinator the person has agreed to',
    differencesFallback: 'Historical material or comparable background is insufficient, so specific routes and results cannot be reused directly; this card only refers to the evidence actually listed.',
    uncertainty: 'This tool has not verified whether the allegations in the new case are true; the specific legal basis and feasibility need local professional judgment.', uncertaintyConstraints: 'The user mentioned resource limits; confirm with those responsible whether this division of work is feasible, and phase it if needed.',
  },
  missing: { country: 'Location unknown: the applicable jurisdiction needs confirming, and past cases’ local procedures cannot be reused.', stage: 'Stage unknown: first check the latest official notice and the authority in charge.', problems: 'Current difficulties unknown: detention, lawyer access and restrictions on expression need to be told apart.', goal: 'Main goal not yet specific: the person should first confirm their priority need.', person: 'Identity unknown: journalist-specific support cannot be assumed to apply.', lawyer: 'No local lawyer able to handle the proceedings has been confirmed yet.', dates: 'No known date for the next proceeding; this tool never calculates legal deadlines.', publicity: 'Specific consent to disclose needs confirming; the current publicity limits constrain outreach.', prior: 'Earlier attempts and responses unknown: ask the coordinator first to avoid repeating steps.' },
  limitations: ['The library uses reviewed historical reports, each with its own reporting date; later developments have not all been checked.', 'Ranking follows transparent rules on known background, identity, historical event stage and difficulties; it does not indicate a chance of success or a causal effect.', 'If the material does not mention an action, that does not mean it never happened; procedural changes are not final outcomes.'],
  noMatches: 'The library has no sufficiently relevant background, so only general preparation is offered below — it does not claim support from historical evidence.',
};

const TEXT: Record<Locale, RuleText> = { zh: ZH, en: EN };

function availableIds(matches:MatchedCase[]){return new Set(matches.flatMap(m=>[...m.record.evidenceIds,...m.record.events.flatMap(e=>e.evidenceIds),...m.record.interventions.flatMap(i=>i.evidenceIds),...m.record.outcomes.flatMap(o=>o.evidenceIds),...m.record.reportRecommendations.flatMap(r=>r.evidenceIds)]));}
function base(input:NewCaseInput,id:string,T:RuleText):ActionOption{return {actionId:id,goal:input.primaryGoal,title:'',applicability:'conditional',reason:'',leadRole:T.base.leadRole,prerequisites:[T.base.prerequisite],timing:T.base.timing,steps:[T.base.step],materials:[],collaborators:[],followUp:[],supportingEvidenceIds:[],differences:[],uncertainties:[],basisType:'general_preparation',requiresPublicity:false,resourceIds:[]};}
function timeline(input:NewCaseInput,T:RuleText):ActionOption{
  const t=T.timeline;const followup=input.priorActions.status==='described';
  return {...base(input,'prepare-case-file',T),title:followup?t.titleFollowup:t.title,applicability:'priority',reason:followup?t.reasonFollowup:t.reason,
    timing:input.keyDates.length?t.timingDates(input.keyDates.length):t.timingNoDates,
    steps:[t.step1,followup?t.step2Followup:t.step2,t.step3,t.step4],materials:t.materials,collaborators:t.collaborators,followUp:t.followUp,uncertainties:t.uncertainties};
}
function clarify(input:NewCaseInput,T:RuleText):ActionOption{return {...base(input,'clarify-goal',T),...T.clarify,applicability:'priority'};}
function external(input:NewCaseInput,matches:MatchedCase[],T:RuleText,locale:Locale):ActionOption|null{
  const ids=availableIds(matches);const recommendations=['myriam-un-recommendation','emna-un-recommendation'].filter(id=>ids.has(id));
  const monitoring=['aigul-monitoring','emna-monitoring','myriam-monitoring'].filter(id=>ids.has(id));
  if(!recommendations.length&&!monitoring.length)return null;
  const t=T.external;
  const privateMode=input.publicity==='private'||input.publicity==='unknown'||hasDisclosureNotes(input);
  const goalNeedsClarification=(input.primaryGoal==='change_judgment'&&!['appeal','postjudgment'].includes(input.stage))||(input.primaryGoal==='drop_charges'&&!['investigation','pretrial','trial'].includes(input.stage))||(['release','conditions'].includes(input.primaryGoal)&&!input.currentProblems.includes('detained'));
  const applicability=privateMode?'defer':input.publicity==='consent'||goalNeedsClarification?'conditional':input.resources.includes('local_ngo')&&input.resources.includes('lawyer')&&input.stage!=='unknown'?'priority':'conditional';
  const resourceIds=resources.some(r=>r.resourceId==='ohchr-special-procedures')?['ohchr-special-procedures']:[];
  return {...base(input,'external-advocacy',T),title:privateMode?t.titlePrivate:t.title,applicability,requiresPublicity:true,
    reason:privateMode?t.reasonPrivate:input.publicity==='consent'?t.reasonConsent:t.reasonPublic(labels[locale].goals[input.primaryGoal]),
    basisType:recommendations.length?'report_recommendation':'historical_action',supportingEvidenceIds:recommendations.length?recommendations:monitoring,
    prerequisites:t.prerequisites,timing:privateMode?t.timingPrivate:t.timing,steps:t.steps,materials:t.materials,collaborators:t.collaborators,
    followUp:t.followUp,differences:t.differences,uncertainties:t.uncertainties,resourceIds};
}

export function buildRuleReference(input:NewCaseInput,matches=retrieveCases(input),locale:Locale='zh'):ModelAnalysisOutput{
  input=normalizeConfirmedGoal(input);
  const T=TEXT[locale];const L=labels[locale];const m=T.missing;
  const missing:string[]=[];
  if(input.intake){
    // Manual rules cannot determine what is absent from free text. These are
    // checks against the complete record, not claims that it lacks information.
    missing.push(...(locale==='en'?[
      'Check the latest event, document and the people or authority involved against your original account; no procedural stage has been inferred.',
      'Confirm which support is already in place and what has already been tried, using the account and follow-up answers.',
      'Keep dates, approximate times and uncertainties separate. This tool does not calculate legal deadlines.',
      'Check the specific disclosure boundaries before sharing anything, even if a broad public preference was selected.',
    ]:[
      '结合原始叙述核对最近事件、文件及相关人员或机关；未由文字自动推断程序阶段。',
      '结合案情与补充回答确认已有协助、已做过的尝试及实际回应。',
      '区分明确日期、大概时间与尚不确定之处；本工具不计算法定期限。',
      '分享前核对具体披露边界，即使已选择总体上可考虑公开。',
    ]));
    if(needsGoalClarification(input))missing.push(m.goal);
  }else{
    if(!knownCountry(input.country))missing.push(m.country);
    if(input.stage==='unknown')missing.push(m.stage);
    if(input.currentProblems.includes('unknown'))missing.push(m.problems);
    if(needsGoalClarification(input))missing.push(m.goal);
    if(input.background.personType==='unknown')missing.push(m.person);
    if(!input.resources.includes('lawyer'))missing.push(m.lawyer);
    if(!input.keyDates.length)missing.push(m.dates);
    if(input.publicity==='unknown')missing.push(m.publicity);
    if(input.priorActions.status==='unknown')missing.push(m.prior);
  }
  const limitations=[...T.limitations];
  if(!matches.length)limitations.unshift(T.noMatches);
  const actionOptions:ActionOption[]=[];
  if(needsGoalClarification(input))actionOptions.push(clarify(input,T),timeline(input,T));
  else if(input.intake?.caseKind==='civil' && !hasCustomGoal(input)) {
    const en=locale==='en';
    actionOptions.push({...base(input,'primary-'+input.primaryGoal,T),
      title:en?'Prepare the civil-expression file for local legal review':'为当地律师准备民事表达争议材料',
      reason:en?'The stated goal and demand letter call for a civil-procedure review; the material does not establish that a claim has been filed or identify its exact legal basis.':'围绕已选择的目标核对律师函与民事程序；现有材料不证明已立案，也不确定对方请求的具体法律根据。',
      leadRole:en?'Internal researcher and newsroom editor; local lawyer decides the legal route':'内部研究人员与编辑整理；当地律师判断法律路径',applicability:'conditional',
      prerequisites:[en?'Retain the stated internal-only boundary; check authority before any external disclosure.':'保留用户已说明的内部处理边界，任何对外披露前核对授权。',en?'Check jurisdiction, the demand or court documents and the actual procedural position with local counsel.':'由当地律师核对具体法域、函件或法院文书和实际程序状态。'],
      timing:en?'Prepare internally now; verify actual document dates without calculating deadlines.':'可先内部整理；核对实际文件日期，不据此推算法定期限。',
      steps:en?['Index the demand letter, published words and retained reporting sources; distinguish allegations from the journalist’s account.','Prepare questions about the exact claim basis, disputed facts, relevant defences and procedural conditions; select law only after those are established.','Have local counsel assess the documents, appropriate response, representation and any actual time limit before deciding on a step.']:['给函件、被指表达及已保留的报道依据建立索引，区分对方指控和当事人陈述。','整理请求依据、争议事实、可能的抗辩与程序条件问题表；先确认问题再筛法律。','由当地律师评估文书、回应方式、代理需要和实际期限，再决定下一步。'],
      materials:en?['Demand letter and the complete publication with context','Reporting-source index and any court documents actually received']:['律师函、完整报道及发表语境','报道来源索引，以及实际收到的法院文书（如有）'],
      collaborators:[en?'Local media-law counsel, subject to mandate and consent':'当地媒体法律师，须核对委托与分享同意'],
      followUp:en?['Record whether a claim is actually issued and which court is involved.','Record counsel’s answers and any authorised next step separately from the initial threat.']:['分别记录是否实际立案、具体法院及送达状态。','保留律师问题答复与获授权的下一步，不把威胁等同于法院决定。'],
      differences:[en?'Criminal interrogation and defence-participation examples do not establish civil procedural rights.':'刑事讯问及辩护人在场的历史记录不能证明民事程序权利。'],
      uncertainties:[en?'The claim basis, event-date law and statutory eligibility require local review.':'索赔依据、事件时法律版本和具体程序资格需当地律师核对。']});
    actionOptions.push(timeline(input,T));
  }
  else if(hasCustomGoal(input)) {
    const preparation=timeline(input,T);
    preparation.title=locale==='en'?'Prepare a record around your stated goal':'围绕已说明的具体诉求准备案情记录';
    preparation.reason=locale==='en'?'Your custom goal is preserved in the case record. This manual reference prepares the material for assessing suitable options; it does not determine local legal routes.':'具体诉求已保存在案情记录中。本项手动参考帮助准备评估所需材料，不判断当地适用法律路径。';
    actionOptions.push(preparation);
  }
  else {
    const goal=input.primaryGoal as PlanGoal;const plan=T.plans[goal];const basis=GOAL_BASIS[goal];const p=T.primary;
    const available=availableIds(matches);const supportingEvidenceIds=basis.supportingEvidenceIds.filter(id=>available.has(id));
    const incompatible=(input.primaryGoal==='change_judgment'&&!['appeal','postjudgment'].includes(input.stage))||(input.primaryGoal==='drop_charges'&&!['investigation','pretrial','trial'].includes(input.stage))||(['release','conditions'].includes(input.primaryGoal)&&!input.currentProblems.includes('detained'));
    const followup=input.priorActions.status==='described';const hasLawyer=input.resources.includes('lawyer');
    const first:ActionOption={...base(input,'primary-'+input.primaryGoal,T),materials:plan.materials,followUp:plan.followUp,
      supportingEvidenceIds,basisType:supportingEvidenceIds.length?basis.basisType:'general_preparation',
      applicability:incompatible?'conditional':hasLawyer&&input.stage!=='unknown'?'priority':'conditional',
      title:(followup?p.followupPrefix:'')+plan.title,
      reason:[p.reasonIntro(L.goals[input.primaryGoal]),followup?p.reasonFollowup:'',incompatible?p.reasonIncompatible:'',!supportingEvidenceIds.length?p.reasonNoEvidence:'',!hasLawyer?p.reasonNoLawyer:''].filter(Boolean).join(T.sep),
      prerequisites:[p.prerequisiteGoal,...(!hasLawyer?[p.prerequisiteFindLawyer]:[p.prerequisiteCheckLawyer]),...(incompatible?[p.prerequisiteIncompatible]:[])],
      timing:input.stage==='unknown'?p.timingUnknown:p.timingStage(L.stages[input.stage]),
      steps:followup?[p.followupStep,...plan.steps]:plan.steps,
      collaborators:[p.collaboratorLawyer,...(input.resources.includes('local_ngo')?[p.collaboratorNgo]:[p.collaboratorCoordinator])],
      differences:supportingEvidenceIds.length===basis.supportingEvidenceIds.length?plan.differences:[p.differencesFallback],
      uncertainties:[p.uncertainty,...(input.resourceConstraints?[p.uncertaintyConstraints]:[])]};
    actionOptions.push(first,timeline(input,T));const advocacy=external(input,matches,T,locale);if(advocacy)actionOptions.push(advocacy);
  }
  // Deep copy: callers may edit the result, and the text tables above must stay untouched.
  return structuredClone({comparableCases:matches.map(m=>m.comparison),actionOptions,missingInformation:missing.slice(0,12),limitations});
}
