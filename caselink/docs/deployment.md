> 历史版本记录：本文件保留先前实现或验收事实，不代表 2026-10-09 本轮代码。当前定位、隐私和研究控制以 [README](../README.md) 与 [本轮验收](iteration-2026-10-09/acceptance.md) 为准；本轮尚未部署。

# Vercel 部署

本项目是常规 Next.js App Router 应用，Node 24，含服务端 Route Handler。静态历史库随构建发布；新案和结果不写服务器磁盘。

## 当前生产站点

最新于 **2026-10-09（America/New_York）** 发布语义研究 v3.1（`PROMPT_VERSION=3.1`）：Luna 动态追问、Sol 根据实际争议生成研究计划、网页搜索优先、按相关性选择案例并生成行动。首轮无合适比较时按时间预算补查一次。保留21份来源、22案、14地区、187引文、双语与无密码访问。

- 正式地址：[caselink-eight.vercel.app](https://caselink-eight.vercel.app)
- Vercel项目：`hao-s-projects-2154e1c6/caselink`，已有Hobby账户。
- 当前部署：`dpl_4g9E9m8zAr8DirzZWSC8enVG2xu8`，`READY`、`production`。[部署详情](https://vercel.com/hao-s-projects-2154e1c6/caselink/4g9E9m8zAr8DirzZWSC8enVG2xu8)。本地306项测试、类型检查、本地及云端生产构建通过；匿名免费HTTP检查7/7通过。真实调用与浏览器记录见verification.md。
- v3.1分析引擎部署：`dpl_EYJ34qnYgxiWRiPnmdtdBR2rWvTW`，已实际完成原用户案情的生产生成；最终部署仅改导出摘要与等待提示，模型链路不变，刷新保留结果并重新验证下载。
- 首轮v3.0部署：`dpl_4P74YwFj9heviEHiLSKdMNBfYPuu`，已被v3.1取代；生产抽核发现程序进展漏读，补上发现后原文读取门槛和同页多阶段合并，详见验收记录。
- 上一联网搜索版本：`dpl_WRXcRSKuu8DxHBHDF17syZoGXK38`，该批次217项测试；已由v3取代。
- 搜索初始部署`dpl_6duMLCUoiAzHQ1A2En6vMwmpxLGF`、引用提示修订部署`dpl_4r5QepPGP8JkUvkM1J9bMQRLWKEp`已被当前版本取代；中间版本`dpl_9Yup876s6WKWQXs5UzgQid1SAyYK`补充新案结果归属守卫与关键词标签；WRXcRSKuu8DxHBHDF17syZoGXK38版本另收窄律师接触主题，避免已有律师或律师函使检索偏题。
- 上一个正式库扩容版本：`dpl_6KA1pKJZ2z7MUB8gRdcuqssVdrBF`（2026-10-08 23:35），静态语料版`2026-10-08.v2`，当时尚未接入联网搜索。此前临时扩容部署H1unbSwd已被其替代。
- 上一个自由案情三案库版本：`dpl_Gpw5UcPmSveq84X3yJNvNq6QBa37`。本轮初始扩容部署`dpl_H1unbSwdPbyHyYwkcdZfzoHaFX2F`已被当前版本替代；最终版本额外排除`tmp/`来源页渲染中间件，业务代码与正式语料一致。
- 上一个无密码九题版本：`dpl_AoRHzCeLG4i4xovUG5qbBbeW499E`。本轮初版`dpl_BfbhGx9r5ZSdhPAqm4xYAiGM7NKi`通过Luna实测，随后在中文最终分析中发现旧律师字段校验误杀，已修复并发布上述当前版本。
- 前一个v3密码版本：`dpl_3X923FicftagsocR9eyasVzM9XTZ`；该版本的匿名分析拒绝检查描述旧访问策略。
- 上一个生产部署（界面 v1）：`dpl_dhSER2Kwpm2h5g9DxtdtRZ3QK6tx`，[部署详情](https://vercel.com/hao-s-projects-2154e1c6/caselink/dhSER2Kwpm2h5g9DxtdtRZ3QK6tx)。需要回退时可在 Vercel 控制台将其重新提升为 Production。
- 界面语言由 `caselink-locale` Cookie 决定，因此页面改为按请求渲染（构建输出中为 ƒ）。
- Node `24.x`；`npm ci`；`npm run build`（webpack）。云端生产构建实际通过。
- Production 和 Preview 均配置 `ANALYSIS_MODE=live`、`OPENAI_MODEL=gpt-6.1-sol`、`OPENAI_INTAKE_MODEL=gpt-6-luna`。API密钥保存为Vercel Secret；2026-10-08按用户要求移除站内密码和`DEMO_ACCESS_PASSWORD`。首次调用因账户额度失败；后续真实验收结果见 `docs/verification.md`。

正式域名已用不带 Cookie 或令牌的普通 HTTP 验证，无需 Vercel 登录；未更改项目默认访问保护或其他项目。测试记录在 `test-results/deployment-http.json`。浏览器实际完成首页→虚构示例→确认→生成结果→展开原文依据。

本次通过 CLI 从本地目录发布，未创建远程 Git 仓库。目录已关联此项目，后续发布：

```bash
cd /Users/fenghao/Desktop/hackhaton/caselink
npm exec --yes --package=vercel@62.7.0 -- vercel deploy --prod --yes --scope hao-s-projects-2154e1c6
node scripts/verify-live-deployment.mjs https://caselink-eight.vercel.app
```

`.vercelignore` 显式排除 `.env.local`、本地来源、全文提取、完整data/research研究目录、tmp页图中间件、文档、测试截图／PDF与构建缓存。首次上传前 `vercel deploy --dry --json` 已核实排除范围，实际上传约403 KB。`vercel.json` 固定构建及安装命令。CLI 登录刷新后自动保存的本地凭据和 OIDC 环境文件不进入上传包。

## 后续 Git 导入与实时环境变量

1. 在你自己的 Git 仓库中保存项目代码与 `package-lock.json`，不提交 `.env.local`、原始报告、完整提取文字、测试浏览器状态或密钥。
2. 在 Vercel 添加项目，导入该仓库。若仓库根目录包含 caselink 子目录，Root Directory 选 `caselink`；如果上传的是项目本身则选仓库根。Framework Preset 选 Next.js。
3. Node.js 版本选 24；安装命令 `npm ci`，构建命令 `npm run build`，输出目录沿用框架默认。
4. 先在 Preview 配置 `ANALYSIS_MODE=demo` 并部署。演示无需 OpenAI 费用。
5. 需要实时内部预览时，将 `ANALYSIS_MODE=live`、`OPENAI_API_KEY`、`OPENAI_MODEL`、`AI_TIMEOUT_MS=90000` 设置在 Preview 环境；Production 需单独配置。密钥只保存在服务端环境变量中，不能使用 `NEXT_PUBLIC_` 前缀。
6. 实时分析不需要站内密码；API key仅存在服务端，用户确认案情后即可提交。
7. 环境变量变更后重新部署；已经完成的部署不会自动变成新配置。

## 函数时长与访问范围

`/api/analyze`设置`maxDuration=300`；无工具研究规划最多25秒，每轮联网研究的发现与原文读取两阶段合计最多65秒，后续综合AI默认90秒（配置允许1–90秒），整次分析共享270秒截止时间，客户端等待290秒。有足够剩余预算时最多补充检索一次。Vercel当前Fluid Compute的Hobby时限文档允许这一配置，无需为此购买升级。Vercel 实际上限与项目设置、运行模式和套餐有关，应在部署项目中核查；不假设所有套餐有同样限制，也不为完成本项目购买套餐。

可结合当前账户已有的 Vercel 部署访问保护。站内密码已按用户要求取消。单个无服务器实例的内存去重／请求合并不提供跨区域、跨实例全局限流；当前没有持久化全局限流。

## 发布后检查

- `/api/capabilities` 只显示必要状态，无 key/model secret。
- 首页最多展示六条历史记录，案例库展示全部22条；虚构示例不计入总数。
- 完整体验示例、查看原文、修改公开限制、重新分析、下载 Markdown。
- POST 响应含 `Cache-Control: no-store`；无案情 URL 参数。
- 实时配置不全要显示错误；配置完整时，无Cookie的新访客也可分析。
- 使用虚构输入验证真实调用，记录模式为 live_ai、输出引用有效且未泄露完整案情日志。账户额度、真实模型调用结果与后续验证必须分别记录；详情见验收记录。
- 生产静态库修改需重新构建发布，没有跨用户共享结果数据库。

官方文档（2026-10-07查阅）：[Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)、[函数时长](https://vercel.com/docs/functions/configuring-functions/duration)、[环境变量](https://vercel.com/docs/environment-variables)。


## 2026-10-09：分析历史修复发布

当前生产部署：`dpl_FYAhdqATuFaqJnJFUvnQ76t9mBjJ`，READY。正式别名 https://caselink-eight.vercel.app ，新增 `/history`。保留现有模型配置与访问策略；不新增后端个人报告数据库。上一版：`dpl_4g9E9m8zAr8DirzZWSC8enVG2xu8`。317项测试、云端构建、7/7免费HTTP检查和正式浏览器迁移／新建流程通过。

## 2026-10-09：四屏流程合并发布

当前生产部署：`dpl_5VcjGk8FB4FWDDYEJ4LSsj4LVPN3`，READY，正式别名 https://caselink-eight.vercel.app 。上一版（回退目标）：`dpl_FYAhdqATuFaqJnJFUvnQ76t9mBjJ`，需要时在 Vercel 控制台将其重新提升为 Production。

内容：自适应整理改为四屏（地区与案件 → 用自己的话说 → 案情陈述 → 行动参考），新增「是否与新闻或公开表达有关」，第③屏海报式陈述直接提交，结果页默认「行动参考」并按三类依据标注，等待实时分析时先列出案例库候选。模型配置、接口与访问策略不变。细节见 [adaptive-intake.md](adaptive-intake.md#四屏流程2026-10-09-合并)。

验证：本地类型检查、生产构建通过；单元测试315项通过、2项因依赖的 `test-results/` 真实样本缺失而跳过；e2e 7/7、浏览器守卫3项通过。发布后 `node scripts/verify-live-deployment.mjs https://caselink-eight.vercel.app` 7/7 通过，模型请求0。正式站浏览器走查①→②→③并以「改用规则参考」提交到④，页面内拦截了所有整理请求与非规则分析请求，未产生 AI 调用；新流程尚未在真实模型下跑过。

## 2026-10-09：案情整理分栏发布

当前生产部署：`dpl_F2fcLzz69izrJ4y5GRkCh1cdaAdU`，READY。上一版（回退目标）：`dpl_5VcjGk8FB4FWDDYEJ4LSsj4LVPN3`。

试用反馈：第③屏只是把原话摘录连成一段，看不出 AI 做了什么，且整段红字过重。本版让整理模型为每条摘录另写简短概括并归入栏目（经过、对方主张、目前处境、手上材料、最担心、其他），第③屏改为分栏的「案情整理」；概括未通过安全检查或过长时退回原话。模型输出格式新增 `summary`、`slot` 两个必填字段，旧格式输出仍被接受。

验证：本地类型检查、生产构建、单元测试316项（2项因 `test-results/` 样本缺失跳过）、e2e 7/7、浏览器守卫通过；发布后免费检查7/7、模型请求0；正式站无 AI 路径走查分栏页面正常。新输出格式尚未经真实模型调用验证，由使用者在正式站试用。
