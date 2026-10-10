# OpenAI 联网搜索恢复：生产发布（2026-10-10）

用户明确要求“上线部署”后，在原有 Vercel 项目 `hao-s-projects-2154e1c6/caselink` 发布。正式地址：[开始分析](https://caselink-eight.vercel.app/new)。没有 Git push，没有向机构或其他人发送材料。

## 发布身份

- 部署：`dpl_CUwRyLRmquQdAsM4UF8JWDyvomZH`，状态 `Ready`，生产别名已指向新部署。
- [Vercel 详情](https://vercel.com/hao-s-projects-2154e1c6/caselink/CUwRyLRmquQdAsM4UF8JWDyvomZH)。应用代码提交 `5603cfe`；实际发布提交 `9d30064`（另含发布检查及忽略生成物）。
- 保留原部署 `dpl_7dRFqeA1qGEPGfTd1qQe3XffPDEK` 作为可回退目标；本次没有执行回退。
- 复用已有 `OPENAI_API_KEY`、模型及 live 配置，没有新增服务或修改生产环境变量。模型仍为 `gpt-6.1-sol`。
- 实测 `webSearchProvider=openai`、`webSearchAvailable=true`。`controlledSearchConfigured=false` 如实表示它不是严格逐字固定查询的 Brave 模式，不能据此判定“没有联网”。
- 云端生产构建成功。上传清单 186 项，约 2.55 MB；实际增量上传 172.9 KB。凭据、本地资料、原始 PDF、研究提取、测试与交付文件均排除。本轮补上 `output/` 忽略规则，排除本地生成的示例 PDF。

## 线上真实调用

[虚构输入](production/sample-input.json) → [完整输出与冻结快照](production/complete-output.json) → [逐阶段实际调用记录](production/real-call-evidence.json)。

对正式域名发送 1 次实际分析请求；虚构普通民事案件 V-92，不使用 exampleId。HTTP 200、`live_ai`、提示词版本 4.4，耗时 66.769 秒，搜索状态 `completed`。3 次真实模型请求：发现搜索、来源读取、无工具综合；共 64,933 输入 tokens、3,351 输出 tokens、2 个工具动作。无重试。账单未查询，费用保留 `null`。

搜索动作返回 3 条实际查询；读取阶段采纳 1 个带 URL 引用、已打开的英国最高法院新闻摘要 PDF。它不是判决全文，不意味着全文读完或内容经过团队人工法律复核。页面明确指出本次尚无合适案例比较，未将弱相关隐私案例硬配为本案成功路径。输出含 3 项资料工作及 3 份填好内容的草稿。

## 验证和下载

- [免费 HTTP 检查](production/http-checks.json)：15/15 通过，模型请求为 0；覆盖能力、手动输入、规则模式、跨站拒绝和主要页面。
- [初轮浏览器检查](production/browser-tests.log)：2/2 通过，使用此前真实输出回放及模拟能力接口检验 UI；未再次调用模型。
- [本次生产输出回放](production/production-output-browser.log)：1/1 通过。在正式站隔离浏览器会话中载入本次线上实际输出，检查来源、快照、390px 布局，实际点击下载 4 个文件并读取核对。回放没有再调用模型。
- 下载：[完整报告](production/CaseLink-行动参考-2026-10-10.md)、[时间线与材料索引](production/timeline.md)、[问题—证据—法律依据表](production/issue_matrix.md)、[当地律师内部简报](production/lawyer_brief.md)。三份材料均含本案事实和具体披露限制。
- 页面：[桌面](production/openai-research-desktop.png)、[手机](production/openai-research-mobile.png)。

验证脚本有两项旧假设已修正：能力字段此前只认 Brave 固定查询；英国民事规则结果此前被要求必须有历史匹配来源。后者首次检查为 14/15，通过既有民事隔离单元测试确认零匹配属于预期，再改为检查三项准备工作、三份材料及已有比较的引用，不强行添加无关刑事来源。[初轮失败记录](production/http-attempt-1.json) 保留。修正仅涉及不上传的验证脚本，不更改部署后的业务代码。

原有本地 566 项单元测试通过、2 项既有跳过；类型检查与构建通过。这次真实成功只证明该虚构输入下的完整线上调用链，不表示全球法律覆盖、所有未来请求稳定成功或团队人工核实。PDF 上传、OCR、原文件存储流程未修改，旧报告继续保留原快照。

重现免费检查：

```sh
node scripts/verify-live-deployment.mjs https://caselink-eight.vercel.app
TEST_BASE_URL=https://caselink-eight.vercel.app E2E_RESEARCH_EVIDENCE_DIR=docs/openai-search-2026-10-10/production npx playwright test tests/e2e/openai-search.spec.ts --grep 'recorded OpenAI research'
```
