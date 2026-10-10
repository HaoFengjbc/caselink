# 本轮基线与文件归属

业务基线：2f78f06；工作期间其他会话追加 b6d444d（README与生产调用记录），保留其内容。2026-10-09 开始时 Git 工作区干净。使用现有主目录，不覆盖其他工作；不部署、不发送、不提交法律材料。

- 主负责人：所有共享 schema（contracts / workflow-contracts / legal-contracts），corpus 装配、AI service/prompt/validate 集成、公共文案、README、阶段验收与最终报告。
- A：data/resources/resources.json 的现有 16 条逐条复核；docs/source-integration-2026-10-09/resource-audit.md。第二阶段需待验收后另派任务。
- B：data/resources/local-rules.json、data/resources/scenario-research.json，docs/source-integration-2026-10-09/local-rules.md。不得修改既有资源文件或共享 schema。
- C：src/lib/legal-research.ts、src/components/results/LegalResearch.tsx、AnalysisView.tsx、export.ts、src/lib/reports/snapshot.ts、对应专用测试。不得修改共享 schema、AI 服务、资源数据或录入/PDF 流程。

SourceAuditSchema 与 LegalBindingSchema 见 src/lib/legal-contracts.ts。资源新增 sourceAudit。当地规则沿用 ResourceSchema，type 新增 domestic_law/procedure_rule。当地数据与国际数据在 corpus 合并。法律研究对象由服务器生成，保留 factsAsOf/lawAsOf 和逐项条件，AI 仅可通过 legalCitations 引用服务器给出的 bindingId/claimKey/resourceId/provisionId。

全部演示为虚构。基线历史审核标签不升级。只读取摘要、阻断、局部正文须分别记载。不从职业或文件推定用户目标与披露意愿。
