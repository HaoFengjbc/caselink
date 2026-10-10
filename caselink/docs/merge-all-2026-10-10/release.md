# 说明文字修正与全部分支并入 main（2026-10-10）

## 改动

- 关键问题没有引用本地法时，说明只写“这次没有找到本地法律依据，本地法请当地律师确认”。原来写“现有依据只有国际标准”，但依据里可能还有已核实案例。新增浏览器测试覆盖这一情况。
- 菲律宾本地法按用户决定暂不处理。

## 合并

- 合并前，仓库里没有并入 `main` 的分支只有 4 个 10 月 9 日的 PDF 分支：`codex/caselink-material-dates`、`codex/caselink-pdf-date-ui`、`codex/caselink-pdf-server`、`codex/caselink-pdf-ui`。其余分支（`claude/*`、`caselink/iteration-a/b/c`、`codex/caselink-pdf-intake`、`codex/whats-next-mvp`、`codex/restore-openai-search`）都已在 `main` 中。
- 这 4 个分支的每个提交在 `main` 里都有内容相同的对应提交（`git cherry` 为 0）。普通合并会在 16 个文件产生冲突，并把 `main` 在 PDF 审阅页改版（`db0d84d`）中删除的 `MaterialReview.tsx`、`MaterialDateReview.tsx` 加回来，因此用 `git merge -s ours` 记为已合并，代码保持 `main` 的现状（合并提交 `46a7019`，与修正提交 `47c5646` 的代码完全相同）。
- 合并后，所有本地分支都是 `main` 的祖先。

## 验证

- 类型检查、单元测试 586 项（2 项跳过）、生产构建通过；本地浏览器测试 28 项通过，`journey.spec.ts` 原有 6 项失败不变。
- 上线后生产规则模式浏览器测试 13 项通过。本次没有调用实时 AI。

## 上线

- 生产部署 `dpl_JCpuCmWc43BV48YajQJq2PXbUjrm`，可回滚至 `dpl_6qAZfeNwnZ9xdKDG4dJnFtYk2LwF`。
