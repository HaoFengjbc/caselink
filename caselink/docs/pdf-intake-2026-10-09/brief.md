# PDF 建档集成约定

日期：2026-10-09（America/New_York）。基线 `8b18d11`，已有 Git 保留。

- 主集成：`codex/caselink-pdf-intake`，独立 worktree `~/.codex/worktrees/caselink-pdf-intake/hackhaton`。
- Agent 1：`codex/caselink-pdf-server`，仅材料服务、解析器、API、服务测试与虚构 PDF 生成器。
- Agent 2：`codex/caselink-pdf-ui`，仅 intake 组件、页面与浏览器验收。
- 主会话拥有所有公共 schema、i18n、依赖、Next 配置、用量控制、材料与案情整合 helper、报告快照及导出、验收记录。Agent 为编译复制的公共文件不得独立提交。
- 无 Git 重新初始化，无生产覆盖，无账号或长期文件库。两种入口共用 NewCaseInput/IntakeRecord 与已有行动参考。
- 真实 AI 测试沿用既有最多 1 次整理、2 次分析、总预留不超过 USD 2 的授权；必须先有可验证配置及额度控制。未配置时严格零调用，不绕过计费门槛。

公共协议：`src/lib/materials/contracts.ts`。`POST /api/materials` 为 multipart，重复 `files` 字段和单个 `metadata` JSON；输出 NDJSON 真实阶段/逐文件信息/完整结果或错误。材料经 PDF.js 逐页提取后由原有 `OPENAI_INTAKE_MODEL` 处理文本，原 PDF 不发给 OpenAI，无 Files 对象、无工具、无联网研究。隐私偏好与当次材料 AI 同意分开；本次披露授权只能用户确认。
