# Phase 0 Research: Git 发布工作流

**Feature**: 015-git-release-workflow
**Date**: 2026-07-09
**Status**: Complete

本 spec 在 Technical Context 中没有 NEEDS CLARIFICATION 项(所有技术选型在 spec.md / Clarifications session 已收敛)。本文档记录**实现层**的 8 个关键决策,为 Phase 1 设计与 Phase 2 tasks 提供依据。

---

## Decision 1: `deploy.yml` 重构形式 —— 单 workflow + job-level if 分流

**Decision**: 保持**单 workflow 文件** `.github/workflows/deploy.yml`,使用 `on.push.branches` + `on.push.tags` 双触发器,在 job 或 step 层用 `if: github.ref_type == 'tag'` / `if: github.ref_type == 'branch'` 分流。

**Rationale**:
- 单文件降低认知负担,所有"镜像构建"逻辑集中可见。
- GitHub Actions 原生支持 trigger 多事件并发触发,workflow 内 `if` 表达式足够精确。
- 与 `docker/build-push-action` 的 `tags` 多行参数天然兼容(只需在不同 step 输出不同的 tags 字符串)。

**Alternatives considered**:
- 拆为 `deploy-main.yml` + `deploy-tag.yml` 两个文件:优点是各自独立,缺点是缓存配置、QEMU/Buildx setup、login 等步骤重复 4~5 处,后续维护成本翻倍。**否决**。
- 单一 trigger(`workflow_dispatch` 手动触发):违反 FR-019(自动触发要求)。**否决**。

---

## Decision 2: tag push trigger 语法 —— `tags: ['v*']`

**Decision**:
```yaml
on:
  push:
    branches: [main]
    tags: ['v*']
```

**Rationale**:
- `v*` 是 GitHub Actions 的 glob 模式,匹配所有 `v` 开头的 tag(`v0.1.0`、`v1.0.0` 等)。
- 不会误匹配非发版 tag(如 `v0.1.0-rc.1`,若有则需要额外规则;目前不引入 RC 流程)。
- `branches` 与 `tags` 在同一个 `push` 事件下,GitHub 原生支持。

**Alternatives considered**:
- `tags: ['v*.*.*']`:更严格,但 `*` 在 tags filter 中实际等同,无额外收益。**否决**。
- 单独 `release` event(`on: release`):只在 GitHub Release 创建时触发,而 FR-011 要求 tag push 就触发镜像构建(在 Release 创建之前)。**否决**。

---

## Decision 3: branch protection 配置 —— 通过 `gh api` 而非 Web UI

**Decision**: 使用 `gh api -X PUT repos/:owner/:repo/branches/main/protection` 配置,设置脚本入 `scripts/setup-branch-protection.sh`(可选 helper,非 spec 必需)。

**Rationale**:
- 可重复执行、可版本控制、可 diff。
- PR review 时 reviewer 可直接看到配置变更。
- 文档化:命令本身就是配置的 source of truth。

**关键 API 字段**:
```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["lint", "type-check", "test"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

注:`enforce_admins: false` 即 Q1 选 B 的 "允许 admin bypass"。`required_approving_review_count: 0` 即单人项目允许 self-merge。

**Alternatives considered**:
- Web UI 手动配置:无版本控制,无法 PR review,重新设置时靠记忆。**否决**。
- Terraform GitHub provider:重型工具,违反 YAGNI。**否决**。

---

## Decision 4: squash merge commit message 格式

**Decision**: 仓库 Settings → General → Pull Requests:
- ✓ Allow squash merging(勾选)
- ✗ Allow merge commits(取消)
- ✗ Allow rebase merging(取消)
- Squash merge commit message:**Pull request title + body**(`-default:` ` Pull request title and description`)

**Rationale**:
- 标题保持 Conventional Commits(`feat: ...`、`fix: ...`),与 git log 历史一致。
- body 保留 PR 描述(motivation / test plan),便于追溯。
- 不用 "Commit messages" 模式(会把 PR 内所有 commit 串起来,主线上冗长)。

**Alternatives considered**:
- "Commit messages" squash 模式:多 commit PR 会让主线 commit message 失焦。**否决**。
- 引入 commitlint 强制 Conventional Commits:目前小团队,PR 标题靠 reviewer 把关足够;若未来引入贡献者再考虑。**Defer**。

---

## Decision 5: 自动删除 head branches

**Decision**: 仓库 Settings → General → Pull Requests:
- ✓ Automatically delete head branches(勾选)

**Rationale**:
- FR-009 要求合并后自动删短分支,GitHub 原生支持。
- 避免人工遗忘导致的"幽灵分支"堆积。

**Alternatives considered**:无,GitHub 原生能力直接采用。

---

## Decision 6: stale action(短分支 ≤ 7 天)—— 推荐但本 spec 不强制

**Decision**: **不**在本 spec 范围内强制引入 `actions/stale`;FR-003 的 7 天上限作为软约束,由维护者人工执行(关闭或催促拆分)。

**Rationale**:
- `actions/stale` 默认作用于 issue/PR,对"未合并分支"需要自定义(基于 `git for-each-ref --no-merged` 或 GitHub Branches API)。
- 单人项目每月 5~15 条短分支,人工管理成本可接受。
- 若未来需要,可在 `.github/workflows/stale.yml` 新增 cron job,无需修改本 spec。

**Alternatives considered**:
- 强制 stale action:违反 YAGNI(无明确需求)。**Defer 到真实痛点出现**。
- 手动脚本 `scripts/check-stale-branches.sh`:可加,但属于 plan 阶段的实现选择,不强制。

---

## Decision 7: PR 模板字段

**Decision**: `.github/pull_request_template.md` 包含以下 section:

```markdown
## 概要

<!-- 一句话说明本 PR 做了什么 + 为什么 -->

## 关联 spec / issue

<!-- specs/NNN-xxx 或 #issue;若 trivial 修复写 "no spec required" -->

## 测试

<!-- 勾选已通过的状态检查 -->
- [ ] lint
- [ ] type-check
- [ ] test(unit + integration)

## 风险与回滚

<!-- 本变更可能影响的区域;若出问题如何回滚 -->

## 部署影响(可选)

<!-- 是否影响 deploy.yml / Dockerfile / 数据库 migration / 环境变量 -->
```

**Rationale**:
- "概要 / 关联 spec / 测试 / 风险"四件套是工程实践最小完备集。
- "部署影响"单列,避免把 CI/Docker/migration 变更埋在描述里。
- 不引入多选 checklist 强制 lint(`eslint-bd` 之类的 bot)—— 违反 YAGNI。

**Alternatives considered**:
- 引入 PR label bot 自动打 label:`release-note` / `breaking` 等:单人项目过度工程化。**Defer**。
- 模板里嵌 issue 关闭关键字(`Closes #N`):依赖 GitHub 自动关闭能力,可在 "关联 spec / issue" section 自然使用,不强求单独 section。**采纳为可选**。

---

## Decision 8: `scripts/verify-release.sh` 实现策略

**Decision**: 单文件 POSIX shell 脚本,依赖 `jq` / `git` / `gh` / `docker manifest inspect`,无第三方依赖。

**核心逻辑**:
```sh
package_version=$(jq -r .version package.json)
latest_tag=$(git describe --tags --abbrev=0)
latest_release=$(gh release view --json tagName --jq .tagName)
image_tag=$(docker manifest inspect "ghcr.io/${GITHUB_REPOSITORY:-azenking/balthasar}/app:${package_version}" >/dev/null 2>&1 && echo "$package_version" || echo "missing")

# 四者必须相等
[ "$package_version" = "$latest_tag" ] && [ "$package_version" = "${latest_tag#v}" ] && [ "$image_tag" = "$package_version" ]
```

**Rationale**:
- 用 `docker manifest inspect` 而非 `docker pull`,不实际下载镜像(快、不占磁盘)。
- `gh release view --json` 是稳定 API,不依赖 HTML 解析。
- POSIX shell 兼容 macOS 默认 `sh` + Linux CI 环境,无需 bash 特性。
- 失败时非零退出,可挂入 CI 或 `pre-release` hook。

**Alternatives considered**:
- Node.js 脚本(`scripts/verify-release.mjs`):需要 `package.json` 增加 `node-fetch` 或依赖内置 `fetch`(Node 18+)。增加维护面。**否决**(Shell 已足够)。
- 加入 CI 作为 release 前置 gate:可作为 task 2.X 落地,本 spec 不强制。

---

## Phase 0 结论

所有 8 项决策均已收敛,无未解决项。进入 Phase 1 设计。
