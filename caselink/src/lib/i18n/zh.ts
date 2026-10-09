export const zh={
  stages:{investigation:'调查或威胁中',pretrial:'已起诉、传唤或候审',trial:'审判中',appeal:'正在上诉',postjudgment:'判决后尚未或没有上诉',unknown:'不清楚'},
  persons:{journalist:'记者',blogger:'博主',activist:'活动人士',other:'其他',unknown:'不清楚'},
  activities:{reporting:'新闻报道',investigation_report:'调查报道',social_media:'社交媒体发言',repost:'转发内容',other:'其他',unknown:'不清楚'},
  problems:{detained:'被拘押',lawyer_access:'联系律师困难',file_access:'取得案件材料困难',threats:'受到人身威胁',expression_restricted:'表达或发布受到限制',other:'其他',none:'暂未遇到以上困难',unknown:'不清楚'},
  goals:{release:'获得释放或保释',lawyer:'获得律师帮助',conditions:'改善拘押条件',drop_charges:'争取停止起诉',change_judgment:'争取改变判决',other:'其他',unknown:'不确定，先梳理问题'},
  publicity:{public:'可以考虑公开',consent:'需要先征求意见',private:'希望先保持私下处理',unknown:'不清楚'},
  resources:{lawyer:'已有律师',local_ngo:'当地公益组织',press_association:'记者协会',international:'国际合作方',none:'暂时没有',unknown:'不清楚'},
  categories:{legal:'程序内法律行动',international:'国际机构',media:'媒体传播',ngo:'NGO 协作',diplomatic:'外交',monitoring:'监测与报告',other:'其他'},
  applicability:{priority:'优先考虑',conditional:'条件满足后考虑',defer:'暂缓考虑'},
  modes:{live_ai:'实时 AI 生成',rule_reference:'规则参考 · 未调用实时 AI',preset_demo:'预置演示结果 · 未调用实时 AI'},
  outcomes:{specific:'具体结果',partial:'部分变化',pending:'程序未决',unrecorded:'未记载'},
  origins:{direct_report:'原报告直接记载',unverified_footnote:'脚注引证，未独立追查',verified_supplement:'已核实补充来源'},
  basis:{web_research:'联网资料参考（待核实）',historical_action:'已实施历史行动',report_recommendation:'报告作者建议',general_preparation:'一般准备参考'}
} as const;
