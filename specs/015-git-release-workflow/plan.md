# Implementation Plan: Git 发布工作流 (主线 + 短分支 PR + Tag 发布)

**Branch**: `015-git-release-workflow`(文档型 spec,无代码分支) | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/015-git-release-workflow/spec.md`

## Summary

把已事实采用的 trunk-based 开发流形式化为可执行规范,并修复 patch 流程无法触发镜像构建的核心漏洞。

落地物分四类:
1. **GitHub 仓库设置**:main 与 `release/vX.Y` 的分支保护规则(允许 admin bypass、要求 PR + status checks)、自动删除短分支、squash merge。
2. **`.github/` 资产**:PR 模板、重构后的 `deploy.yml`(main push 与 tag push 互斥分流)、可选 stale action。
3. **校验脚本**:`scripts/verify-release.sh` 一键核对四件套(package.json / git tag / GitHub Release / GHCR 镜像 tag)一致。
4. **文档**:本 spec 目录下的 research / data-model / contracts / quickstart,以及仓库根的简短工作流说明。

技术栈不引入新依赖:GitHub Actions + gh CLI + Shell + YAML。

## Technical Context

**Language/Version**: Shell(`sh`,POSIX)、YAML(GitHub Actions schema);可选 TypeScript/Node 22 用于复杂校验脚本(目前用 Shell 足够)。

**Primary Dependencies**:
- GitHub Actions(`actions/checkout@v4`、`docker/build-push-action@v5`、`docker/login-action@v3`、`docker/setup-buildx-action@v3`、`docker/setup-qemu-action@v3`)
- GitHub Container Registry(ghcr.io)
- `gh` CLI(本地发版用,>= 2.40 推荐,支持 `--generate-notes`)
- Docker Buildx(多架构 amd64/arm64)

**Storage**: N/A —— 无数据库依赖;所有"状态"在 git ref(tag / branch)与 GitHub Release 实体中。

**Testing**:
- CI 自检:`deploy.yml` 中 `if: github.ref_type == 'tag'` 与 `if: github.ref_type == 'branch'` 的互斥性,通过 dry-run(`gh workflow run` + 查看 run log)验证。
- 端到端:走一遍完整发布流程(改 version → commit → tag → push → Release → 校验 GHCR),人工核对四件套一致。
- 校验脚本:`scripts/verify-release.sh` 在 SC-003 失败时非零退出。
- 无单元测试 —— 本 spec 是工程流程,无业务逻辑可单测。

**Target Platform**: GitHub.com(SaaS,运行时)+ GHCR(镜像存储)+ Docker(产物运行时,linux/amd64 + linux/arm64)。

**Project Type**: DevOps / 工程流程规范(非产品功能)。产出物为 GitHub 配置 + CI workflow + Shell 脚本 + Markdown 文档。

**Performance Goals**:
- SC-004:tag push → GHCR `app:X.Y.Z` 可拉取,中位 ≤ 30 分钟(目前实测 ~5 分钟,余量充足)。
- 无运行时性能预算(本 spec 不影响应用代码热路径)。

**Constraints**:
- 不引入新的 GitHub App 或第三方 action(只用 first-party)。
- 不修改宪法 v2.0.0 技术栈表。
- 不修改 `package.json` 的 version 派生逻辑(仍是镜像 tag 的唯一真相源)。
- main 与 release/vX.Y 的分支保护规则改动必须可逆(任何配置变更都有对应的回滚步骤)。

**Scale/Scope**:
- 单仓库、单维护者(当前)。
- 预计分支保护规则 2 条(main、release/v*)、PR 模板 1 份、deploy.yml 1 个 workflow(拆为 2 个 job 或保持单 job 用 if 分流)、校验脚本 1 个。
- 短分支每月预期 5~15 条;patch release 预期每月 ≤ 1 次。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

逐条核对宪法 v2.0.0 六大原则:

| # | 原则 | 本 spec 影响 | 状态 |
|---|------|--------------|------|
| 一 | MVP Scope | 不动 MVP 业务范围(登录/账户/分类/交易/Dashboard/流水);只规范 git 工作流 | ✅ 通过 |
| 二 | Feature-Sliced Architecture | 不动 `src/app/<feature>/` 与 `src/server/api/routers/<feature>.ts` 结构;本 spec 只改 `.github/`、`scripts/`、`specs/` | ✅ 通过 |
| 三 | Domain-Driven Design | 不动 `Family` 聚合根与 Better-Auth 边界 | ✅ 通过 |
| 四 | 测试优先 | FR-007 强制 PR 必须通过 `lint` / `type-check` / `test` 才能合并 —— **加强**测试纪律 | ✅ 通过(强化) |
| 五 | 性能与极速录入 | 不动 tRPC procedure 性能预算;`deploy.yml` 重构不影响应用热路径 | ✅ 通过 |
| 六 | 简单 (YAGNI) | 不引入新抽象层、新依赖、新工具;只用 GitHub 原生能力 + first-party actions;PR 模板不引入第三方 lint bot | ✅ 通过 |

**Gate 结论**: 无违反,无需在 Complexity Tracking 中记录例外。允许进入 Phase 0。

## Project Structure

### Documentation (this feature)

```text
specs/015-git-release-workflow/
├── spec.md              # ✓ 已生成(/speckit-specify + /speckit-clarify)
├── plan.md              # ✓ 本文件
├── research.md          # Phase 0 输出(本文档之后生成)
├── data-model.md        # Phase 1 输出(Branch/Tag/Release/PR/Image 实体)
├── contracts/
│   └── release-flow.md  # Phase 1 输出(发布流程契约)
├── quickstart.md        # Phase 1 输出(端到端验证手册)
└── tasks.md             # Phase 2 输出(/speckit-tasks,本命令不生成)
```

### Source Code (repository root)

本 spec 的"代码"产出物落在 `.github/` 与 `scripts/`,不在 `src/`(业务代码不受影响):

```text
.github/
├── workflows/
│   ├── deploy.yml              # 重构:单 trigger 拆为 main-push 与 tag-push 两条路径
│   └── stale.yml               # (可选)新增:GitHub stale-action,7 天未活动短分支自动标记
├── pull_request_template.md    # 新增:PR 模板(动机 / 测试 / 关联 spec / 风险)
└── CODEOWNERS                  # (可选)单人项目暂不需要,留作未来扩展锚点

scripts/
└── verify-release.sh           # 新增:SC-003 校验脚本,四件套一致性检查

# GitHub 仓库设置(非文件,通过 gh API 或 Web UI 配置)
# - branch protection rule on main
# - branch protection rule on release/v*
# - squash merge only(Repository settings)
# - auto-delete head branches(Repository settings)

docs/
└──(可选)README.md 更新,引用本 spec 作为工作流权威源
```

**Structure Decision**:
- 不在 `src/` 下新增任何文件 —— 本 spec 是工程流程,与业务代码完全解耦。
- `.github/` 集中所有 GitHub 资产(workflows / templates / CODEOWNERS)。
- `scripts/` 放本地工具脚本(校验、未来可能的自动化)。
- `specs/015-git-release-workflow/` 是本 feature 的文档锚点,后续工作流变更都在此目录迭代。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

无违反,本表留空。
