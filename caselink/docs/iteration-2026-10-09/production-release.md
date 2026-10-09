# CaseLink 生产发布记录

2026-10-09，America/New_York。用户在本轮代码验收之后明确要求“部署生产”，主会话执行发布；A/B/C 没有独立部署。

## 发布结果

- 正式地址：https://caselink-eight.vercel.app
- 部署：`dpl_4981LcNSHWJeuvRfUhFQFBvdUuVP`，`production / READY`。
- 独立地址：https://caselink-7r5p2y3k4-hao-s-projects-2154e1c6.vercel.app
- [Vercel 部署详情](https://vercel.com/hao-s-projects-2154e1c6/caselink/4981LcNSHWJeuvRfUhFQFBvdUuVP)
- 创建时间：2026-10-09 17:49:31 ET；正式域名 HTTP 验收：17:50:25 ET。
- 发布源码：`aad75c2`，业务实现基于 `fc4b9c6`；`aad75c2` 仅更新免费线上验收脚本，使用新请求身份字段并分别报告规则与 AI 可用状态。
- `PROMPT_VERSION=4.0`，`CORPUS_VERSION=2026-10-09.v3`。线上三类规则报告均验证版本与完整证据快照。
- 从已有本地 Vercel 关联目录发布。未创建远程 Git 仓库或执行 push；未更改生产环境变量、访问保护或现有模型配置。

## 实际验证

| 项目 | 结果 |
| --- | --- |
| 上传范围 | CLI dry manifest 177 个条目，其中 171 个普通文件；无 `.env.local`、密钥、私有原文、浏览器资料、测试结果或提取产物。`docs`、`data/research`、`tmp`、`test-results` 仅为大小 0 的空目录占位。首次路径检查将空目录误报为文件，按文件类型复核后确认无受限内容。 |
| 云端构建 | `npm ci`、Next.js webpack 构建、TypeScript 和 36 页生成成功；Vercel Ready，正式域名已切换。 |
| 发布脚本回归 | Node 语法检查通过，3 个虚构输入和 187 条证据离线解析通过；相关 Vitest 4 项通过。 |
| 正式域名免费 HTTP | 15/15 通过：capabilities、无效输入拒绝、三类虚构案规则分析与完整快照、跨站分析拒绝、手动整理、5 个页面、3 个案件详情。全程未携带登录凭据。 |
| 实际浏览器 | Chrome 正式站首页可访问；比较页实际选取 Aigul Utepova、Emna Chargui、Myriam Bribri，生成 3 案、32 引文、13 资源的快照简报；显示未记载、日期冲突及三层来源区分。新录入页显示默认内存使用和单独的刷新恢复同意。 |
| 真实 AI / 搜索 | **0 次模型请求，0 次受控搜索 provider 请求**。没有把规则报告或模拟测试作为真实 AI 验收。 |

本次未重复整轮浏览器历史删除、导入导出或长输入测试；此前本地测试结果和限制见 [本轮验收](acceptance.md)。本次发布没有改变业务源码，不将此前受阻步骤改标为已通过。

## 当前线上功能状态与外部配置

线上 `/api/capabilities` 实测：

```json
{
  "mode": "live",
  "configured": true,
  "liveAvailable": false,
  "usageControlConfigured": false,
  "controlledSearchConfigured": false,
  "webSearchAvailable": false,
  "ruleAvailable": true,
  "accessRequired": false,
  "progressEvents": false
}
```

已有 API key 配置不等于 AI 已可用。新版要求用量控制先就绪，故当前 AI 整理、付费研究与联网搜索关闭，规则参考、公开案例、国际资源、比较及客户端报告功能可用。发布前已向用户说明这一状态；没有为继续调用而绕过控制。

待配置：共享 Redis REST URL/token、服务端会话 secret、准确逐模型价格与全局日预算。联网另需 Brave Search key、启用开关及该账户每次查询最高成本。配置后需重新发布，并独立验收真实 Redis 多实例、provider 外发查询、模型使用/成本及失败恢复。OpenAI 账户支出提醒与硬限制尚未核验。详见 [研究与用量说明](../research-usage.md)；不能宣称生产配额控制或真实联网已经完成集成。

## 团队演示与证据

1. 正式首页 → 虚构示例 → 核对案情 → 规则参考；当前不演示实时 AI。
2. `/compare` → 选择 2–4 个公开案例 → 生成比较快照 → 查看原文、差异、未知项。
3. `/resources` → 查看官方定位、适用条件、agent 检查与团队复核状态。

仅留在本地的验收产物（已排除上传和 Git）：

- [15 项 HTTP 检查](../../test-results/production-20261009/http-checks.json)
- [上传范围检查](../../test-results/production-20261009/upload-check.json)
- [Vercel 实际部署检查](../../test-results/production-20261009/vercel-inspect.txt)
- [线上比较截图](../../test-results/production-20261009/comparison-live.jpg)

上一部署 `dpl_F2fcLzz69izrJ4y5GRkCh1cdaAdU` 保留，未执行回滚。该版本仍是旧的隐私/研究控制行为，若未来需回滚，应明确评估这种行为差异。
