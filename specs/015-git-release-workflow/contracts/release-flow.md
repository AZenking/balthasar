# Contracts: Git 发布工作流

**Feature**: 015-git-release-workflow
**Date**: 2026-07-09

本 spec 不是产品功能,没有传统的 REST/RPC/tRPC "接口契约"。但有**三类工程契约**,违反即视为流程破窗:

1. **CL1 — 贡献者契约**(开发者 ↔ 仓库):如何把变更进 main
2. **CL2 — 发版者契约**(维护者 ↔ 发布管道):如何把 main HEAD 变成可拉取的镜像
3. **CL3 — 用户/部署环境契约**(部署方 ↔ GHCR):镜像 tag 的语义保证

---

## CL1 — 贡献者契约

### 命名

| 实体 | 格式 | 示例 | 反例 |
|------|------|------|------|
| 短分支 | `<type>/<scope>` | `feat/transaction-filter` | `feature/foo`(`feature` 不是合法 type)、`wip`、`tmp-branch` |
| type 枚举 | `feat` / `fix` / `chore` / `docs` / `refactor` / `perf` / `test` | `fix/auth-500` | `bugfix/foo`(`bugfix` 不是合法 type,用 `fix`) |
| scope | `kebab-case`,1~5 词 | `transaction-list-pagination` | `transaction_list`(下划线)、`x`(太短) |

### PR 必经步骤

```
[short branch on main]
   ↓
   push
   ↓
[gh pr create]──┐
   ↓             │
[CI: lint + type-check + test]   ← PR template required
   ↓ (all green)
[squash merge]   ← main advances one commit
   ↓
[head branch auto-deleted]
```

### 不可违反的契约项

- C1.1: PR 未通过 `lint` / `type-check` / `test` 三项,**禁止** merge(包括 admin bypass)
- C1.2: 合并方式**必须** squash,禁用 merge commit / rebase
- C1.3: PR 描述**必须**包含关联 `specs/NNN-*` 或显式声明 `no spec required`
- C1.4: 短分支生命周期**必须** ≤ 7 天
- C1.5: `main` 与 `release/vX.Y` 之外**禁止**存在其他长期分支

---

## CL2 — 发版者契约

### 发版三件套(原子操作)

发版是一个原子事件,以下三步**必须**在同一次 push 中完成,不可拆分:

```
[modify package.json version]
   ↓
[git commit: "chore(release): vX.Y.Z"]
   ↓
[git tag -a vX.Y.Z -m "Release vX.Y.Z" → same commit]
   ↓
[git push origin <branch> + git push origin vX.Y.Z]
   ↓
[gh release create vX.Y.Z --generate-notes]
```

### 不可违反的契约项

- C2.1: tag `vX.Y.Z` **必须**指向 version-bump commit(即 `package.json.version` 已改为 `X.Y.Z` 的那一次 commit)
- C2.2: tag **必须** annotated(`git tag -a`),禁止 lightweight tag
- C2.3: `package.json.version` / git tag / GitHub Release / GHCR version tag 四者**必须**相等(可用 `scripts/verify-release.sh` 校验)
- C2.4: GitHub Release **必须**用 `--generate-notes`,**禁止**维护独立 `CHANGELOG.md`
- C2.5: tag 一旦 push,**永久不可删除**(force push / `git push :refs/tags/v*` 禁止)

### Patch 路径(release/vX.Y)

```
[bug fix commit on main] 
   ↓
[git checkout release/vX.Y && git cherry-pick <fix-sha>]
   ↓
[bump version to X.Y.(Z+1)]
   ↓
[git commit + git tag -a vX.Y.(Z+1)]
   ↓
[git push origin release/vX.Y + git push origin vX.Y.(Z+1)]
   ↓
[gh release create vX.Y.(Z+1) --generate-notes]
```

- C2.6: Patch **必须**走 `release/vX.Y` 分支 + cherry-pick,**禁止** 在 main 上累积 patch
- C2.7: cherry-pick **必须**只引入修复 commit,**禁止** 带入 main 上的其他 feature commit
- C2.8: `release/vX.Y` **必须**从对应 `vX.Y.Z` tag 切出(按需创建,FR-016)

---

## CL3 — 用户/部署环境契约

### GHCR 镜像 tag 语义保证

部署方拉取 `ghcr.io/azenking/balthasar/app:<tag>` 时,本契约保证 tag 的含义:

| Tag | 指向 | 稳定性 | 推荐场景 |
|------|------|--------|----------|
| `X.Y.Z` | git tag `vX.Y.Z` 指向的 commit | **永久不变**(发布即冻结) | 生产环境固定版本 |
| `X.Y` | 该 minor line 最新 patch 的 commit | 滚动(patch 发布时更新) | 自动跟 patch |
| `X` | 该 major line 最新 patch 的 commit | 滚动 | 自动跟 minor/patch |
| `latest` | 最近一次 tag-push 的 commit | 滚动(只被 tag push 更新) | 跟最新发布 |
| `edge` | main HEAD | 高频滚动(每次 main push) | 开发/测试 |
| `<short-sha>` | 特定 commit | 永久不变 | 复现特定 commit |

### 不可违反的契约项

- C3.1: `latest` / `X` / `X.Y` / `X.Y.Z` **只能**被 tag-push 事件更新,**禁止** main-push 覆盖
- C3.2: `edge` / `<short-sha>` **只能**被 main-push 事件更新
- C3.3: 同一 `X.Y.Z` 镜像 digest **永久不变**(发布即冻结;若需"修复"该版本,发 `X.Y.(Z+1)`)
- C3.4: 镜像**必须**多架构(linux/amd64 + linux/arm64),不允许单架构 fallback

### 部署方使用建议

- **生产**:`app:X.Y.Z`(明确版本,可追溯)
- **预发布**:`app:X.Y`(自动跟 patch,但有 minor 锚点)
- **开发/复现 bug**:`app:<short-sha>`(精确到 commit)
- **不建议**:`app:latest`(对生产环境而言,"最新"不等于"最稳")

---

## 契约违反的后果

| 违反项 | 直接后果 | 修复路径 |
|--------|----------|----------|
| C1.1 | PR 被 admin bypass | 24h 内补 PR(FR-006),并 review CI 红的根本原因 |
| C1.2 | main 上出现 merge commit | `git revert -m 1` 回滚,重新 squash merge |
| C1.4 | 分支堆积 | 强制 close PR 或拆分 |
| C2.1 | tag 与 version 不一致 | **不可修复**(tag 已 push);必须立即打 `vX.Y.(Z+1)` 修正版本号 |
| C2.5 | tag 被删 | 历史已污染,需公开说明 + 通知所有拉取方 |
| C2.6 | main 上累积 patch | cherry-pick 到 release/vX.Y 重新发 patch tag;接受 main 历史不完美 |
| C3.1 / C3.2 | 镜像 tag 漂移 | 跑 verify-release.sh 检测,重发对应 tag 的镜像 |

---

## 契约不覆盖的事(YAGNI)

- ❌ 不约束 commit message 之外的 git hook(如 pre-push 校验)—— 当前规模靠 reviewer
- ❌ 不约束 release candidate(RC/pre-release)流程 —— 当前不发 RC
- ❌ 不约束多 registry 同步(只发 GHCR)
- ❌ 不约束 semantic-release 之类的自动化工具(自动 bump version / 自动生成 changelog)—— 手动控制更可控,且 `--generate-notes` 已足够

这些项目都是**未来规模扩大后**才可能引入,目前不在 spec 范围内。
