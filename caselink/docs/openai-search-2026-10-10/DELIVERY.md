# 恢复现有 OpenAI 联网搜索

用户要求：接回此前已配置的 OpenAI 联网搜索，不再为了联网另外配置 Brave Search。基线为已合并页面改版的 `main d461ba6`；本轮分支 `codex/restore-openai-search`。保留 PDF 上传、OCR/文件存储边界和现有 What’s Next 工作区。

## 实现

- 默认搜索恢复为现有 OpenAI Responses `web_search`，复用 `OPENAI_API_KEY` / `OPENAI_MODEL`。无需 Brave 密钥，未换模型。`OPENAI_WEB_SEARCH_ENABLED=false` 可明确关闭。
- 搜索模型仅收到经过再次校验的规范地区、刑民程序、阶段和公开议题查询；原始案情、姓名、上传原文、披露笔记和自由研究计划不传入搜索。实际工具可扩展公共查询，所以没有把它冒充字面固定查询。
- 每次用户提交一轮：发现来源、打开最多三项候选来源、无工具综合。发现请求工具上限 3，读取请求上限 6，二者共享 65 秒，总分析时限 270 秒。无 SDK 自动重试和自动补查。关闭 AI / 规则模式仍不联网。
- 综合只接收读取阶段与已打开候选 URL 绑定的段落；来源继续 `unreviewed`，不升级为团队核实。`pageOpened` 不证明全文完整或事实准确。
- 能力接口返回 `webSearchProvider=openai` 和 `webSearchAvailable`，页面去掉过时的 Brave 配置提示。没有选中比较案例但已有来源时，仍显示联网资料与下载入口。
- 修复搜索成功、综合失败时规则草稿再次被错误按联网输出校验的问题；保留真实搜索来源和失败说明。
- 原报告继续使用生成时快照。提示词版本为 4.4。正文清理保留 `[2022] UKSC 5` 这类方括号年份。

## 真实调用

通过本地生产构建 `http://127.0.0.1:3041`、实际应用分析 API 和此前指定的 OpenAI 凭据执行。只用陌生虚构民事案件 V-92，无 exampleId；未使用真实用户案情。密钥仅加载到服务器进程环境，未写入源码、证据或提交。

1. [第一次实际调用](attempt-1-real-call-evidence.json)：68.027 秒。发现、读取、综合均实际调用了模型；读取返回四次工具调用，被旧的三次结果上限拒绝，研究记为 `unavailable/invalid_output`。不计搜索恢复通过。完整失败输出另保存在本地 `test-results/openai-search-20261010/attempt-1-complete-output.json`。
2. [修复后的实际调用](real-call-evidence.json)：60.726 秒，`live_ai`，`webResearch.status=completed`。发现阶段一个搜索工具动作，返回三条实际查询；读取阶段一个工具动作，最终采纳一个带引用的已打开来源。综合生成三项内部准备行动和三份填好的材料。候选与本案不够相关，比较案例为 0，未强配。

两次合计六次真实模型请求、七个工具动作，输入 143,586 tokens、输出 6,468 tokens；response ID、token 和工具动作数逐项记录，未查询账单，实际费用保持 `null`。SDK 没有自动重试。查询数量、搜索动作数和模型请求数分别记录，不相互替代。

- [虚构样本输入](sample-input.json)
- [完整实际输出与冻结快照](complete-output.json)
- [本地能力接口](capabilities.json)

完整输出保留当时生成内容，没有事后改写。该样本曾将中立引注的方括号年份当作脚注清理；最终清理代码已修复并有回归测试，旧样本仍如实保留。实际输出所述网页内容及适用性未进行团队人工法律复核；其中重定向或正文不可用的候选没有升级为判决全文。

## 验证与交付边界

最终单元测试 566 通过、2 项既有样本依赖测试跳过；类型检查与生产构建通过。浏览器回归 2 项通过，实际下载并读取 4 个文件。见 [验证汇总](verification.json)、[单元测试](unit-tests.log)、[浏览器记录](browser-tests.log)。浏览器回放使用上述真实输出验证界面，不产生额外模型调用，也不冒充第二次浏览器实时生成。

生产尚未部署，也未 Git push。遵守用户最初“不要自动 push、部署”的要求；现有线上版本仍需部署本提交后才启用恢复的搜索。用户确认部署后可复用原有 Vercel 生产配置，无需新增 Brave 服务。

重现一次真实测试（可能产生模型与搜索费用）：

```sh
node scripts/verify-openai-search.mjs http://127.0.0.1:3041 --run-paid-smoke
```

依据：[OpenAI 官方 Web search 文档](https://developers.openai.com/api/docs/guides/tools-web-search)，2026-10-10 查阅。配置与隐私细节见 [研究与调用说明](../research-usage.md)。


## 实际下载与页面

- [完整行动参考 Markdown](CaseLink-行动参考-2026-10-10.md)
- [本案时间线与材料索引](timeline.md)
- [问题—证据—法律依据表](issue_matrix.md)
- [当地律师内部简报](lawyer_brief.md)
- [桌面页面](openai-research-desktop.png) / [手机页面](openai-research-mobile.png)

浏览器回归首次暴露“零比较时隐藏来源面板”，已修复并复测。一次过程中重启本地服务导致连接中断；另一项测试使用了不匹配现有按钮的精确名称，已修正定位。最终两项均通过，前次日志仍在本地 test-results 中保留，不将失败记录算通过。
