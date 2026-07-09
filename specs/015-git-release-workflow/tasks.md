# Tasks: Git 发布工作流 (主线 + 短分支 PR + Tag 发布)

**Input**: Design documents from `/specs/015-git-release-workflow/`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: 本 spec 是工程流程,无单元测试任务。验收通过 quickstart.md 的 5 个端到端场景完成(每个场景对应一条 [USx] 验证 task)。

**Organization**: 按 spec 的 3 个 user story(US1: 日常 PR / US2: Tag 发布 / US3: Patch 流程)分组。US1 是 P1 MVP,US2 是 P2,US3 是 P3。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- 本 spec 产出物落在 `.github/`、`scripts/`、`specs/015-git-release-workflow/`,**不动 `src/` 业务代码**
- GitHub 仓库设置通过 `gh api` 命令配置(非文件),命令本身即配置 source of truth

---

## Phase 1: Setup (前置依赖验证)

**Purpose**: 确认本 spec 落地所需的本地工具就绪

- [ ] T001 验证前置依赖:`gh auth status` ✓ + `jq --version` ✓ + `docker version` ✓ + `git --version` ✓,记录到 plan.md Notes(若任一缺失,先安装)

**Checkpoint**: 本地工具链就绪,可执行后续 `gh api` / `docker manifest inspect` / `jq` 命令

---

## Phase 2: Foundational (GitHub 仓库基建)

**Purpose**: 配置 PR + 合并 + 分支保护基础 —— 所有 US 的前置

**⚠️ CRITICAL**: US1 完全依赖此阶段;US2/US3 间接依赖(repo 必须有基础工作流才能跑发布与 patch)

- [ ] T002 [P] 配置 GitHub Repository Settings:仅允许 squash merge、自动删除 head branches、squash commit message 用 "PR title + description" 模式。通过 Web UI 或 `gh api -X PATCH repos/:owner/:repo -f allow_squash_merge=true -f allow_merge_commit=false -f allow_rebase_merge=false -f delete_branch_on_merge=true -f squash_merge_commit_message=PR_BODY -f squash_merge_commit_title=PR_TITLE`
- [ ] T003 [P] 配置 `main` 分支保护(允许 admin bypass):`gh api -X PUT repos/AZenking/balthasar/branches/main/protection -F required_status_checks[strict]=true -F required_status_checks[checks][][context]=lint -F required_status_checks[checks][][context]=type-check -F required_status_checks[checks][][context]=test -F enforce_admins=false -F required_pull_request_reviews[required_approving_review_count]=0 -F restrictions=null -F allow_force_pushes=false -F allow_deletions=false`。对应 FR-006 / FR-017 / Clarifications Q1
- [ ] T004 [P] [US1] 创建 PR 模板 `.github/pull_request_template.md`,字段:概要 / 关联 spec 或 issue / 测试 checklist(lint/type-check/test)/ 风险与回滚 / 部署影响(可选)。内容参考 research.md D7

**Checkpoint**: 仓库工作流基建就绪,后续 US 可在它之上跑通

---

## Phase 3: User Story 1 - 日常 PR 流程 (Priority: P1) 🎯 MVP

**Goal**: 开发者从 main 切短分支 → 开 PR → CI 全绿 → squash merge → 短分支自动删除。这是仓库日常推进的唯一入口。

**Independent Test**: 跑 quickstart 场景 1(docs/verify-pr-flow 测试分支,完整走一遍 PR 流程)

### Implementation for User Story 1

- [ ] T005 [US1] 跑 quickstart 场景 1 验证(切 `docs/verify-pr-flow` 分支 → 改文件 → `gh pr create` → `gh pr checks --watch` → `gh pr merge --squash --delete-branch` → 确认短分支已自动删 + main 上有 squash commit)。对应 spec FR-002 / FR-007 / FR-008 / FR-009 / FR-010

**Checkpoint**: US1 完成 —— 任何后续变更都可走标准 PR 流程

---

## Phase 4: User Story 2 - Tag 发布流程 (Priority: P2)

**Goal**: 维护者在 main HEAD 打 annotated tag → tag push 触发 deploy.yml → GHCR 出现 `X.Y.Z` / `X.Y` / `X` / `latest` version 镜像 → GitHub Release 自动生成 notes。修复**当前 patch 流程无法触发镜像构建的核心漏洞**。

**Independent Test**: 跑 quickstart 场景 2(发一个真实 patch 或测试 tag,验证 GHCR `app:X.Y.Z` 可拉取)+ 场景 5(验证 main push 不污染 version 镜像)

### Implementation for User Story 2

- [ ] T006 [US2] 重构 `.github/workflows/deploy.yml`:① `on.push` 增加 `tags: ['v*']` 触发器;② 把现有单一 job 拆为两个互斥 job —— `build-rolling`(if `github.ref_type == 'branch'`,只 push `<short-sha>` + `edge` 到 GHCR)与 `build-release`(if `github.ref_type == 'tag'`,从 tag 名解析 version,push `X.Y.Z` / `X.Y` / `X` / `latest`);③ 共享 QEMU/Buildx/login 步骤但 `tags` 字段互斥。对应 FR-019 / research.md D1 / D2
- [ ] T007 [US2] 跑 quickstart 场景 2:发 `v0.1.x` patch 或 `v0.2.0` minor,确认 tag push 触发了 `build-release` job、GHCR 上 `app:X.Y.Z` 可 `docker manifest inspect`、GitHub Release notes 已生成
- [ ] T008 [US2] 跑 quickstart 场景 5:在 main 上做一个无关 commit 并 push,确认只触发 `build-rolling` job、只更新 `app:edge` 与 `app:<short-sha>`、`app:latest` 仍指向上一次 tag 的 commit(FR-019 互斥分流验证)

**Checkpoint**: US2 完成 —— 任何 tag push 都能正确触发镜像构建;main push 不污染 version 镜像

---

## Phase 5: User Story 3 - Patch 流程 (Priority: P3)

**Goal**: 维护者在 `release/vX.Y` 分支 cherry-pick 修复 → 打 patch tag → GHCR 出 `app:X.Y.(Z+1)` 镜像 → Release notes 仅含该 patch 引入的变更。

**Independent Test**: 跑 quickstart 场景 3(从 main cherry-pick 一个 fix commit 到 release/v0.1 → bump version → tag → push → Release)

### Implementation for User Story 3

- [ ] T009 [P] [US3] 配置 `release/v0.1` 分支保护:`gh api -X PUT repos/AZenking/balthasar/branches/release%2Fv0.1/protection`(URL-encoded slash),参数同 T003 但 `allow_deletions=false`(FR-018 禁止删 release 分支,但 patch 周期结束允许删 —— 见 Clarifications Q2,通过 GitHub UI 删除时仍受 branch protection 阻挡,需先移除保护再删)
- [ ] T010 [US3] 跑 quickstart 场景 3:从 main 找一个 fix commit(或造一个 trivial fix)→ `git checkout release/v0.1 && git cherry-pick <sha>` → `jq '.version = "0.1.2"' package.json` → commit + `git tag -a v0.1.2` → push 分支与 tag → `gh release create v0.1.2 --generate-notes` → 确认 GHCR `app:0.1.2` 可拉取 + Release notes 仅含 patch 变更

**Checkpoint**: US3 完成 —— 后续任何 0.1.x patch 都可走标准 cherry-pick 流程

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 校验工具与文档,完成 spec 收尾

- [ ] T011 [P] 创建 `scripts/verify-release.sh`(POSIX shell):从 `package.json` 读 version + `git describe --tags --abbrev=0` + `gh release view --json tagName --jq .tagName` + `docker manifest inspect ghcr.io/azenking/balthasar/app:<version>`,四者一致则退出 0,否则非零退出并输出差异。实现参考 research.md D8
- [ ] T012 跑 quickstart 场景 4:`bash scripts/verify-release.sh` 在当前已发布的 v0.1.x 上应退出 0;故意改 `package.json` version 制造不一致,确认脚本非零退出并准确报告差异(对应 SC-003)
- [ ] T013 [P] 在 `README.md` 添加 "Workflow" section 引用本 spec(`specs/015-git-release-workflow/`)作为分支策略 + 发布流程的权威源;简短说明 trunk-based / 短分支命名 / 发版三件套(对应 SC-006 新人 30 分钟上手目标)

**Checkpoint**: spec 全部 FR 与 SC 落地,quickstart 5 场景全跑通

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖,立即开始
- **Foundational (Phase 2)**: 依赖 T001(本地工具就绪)—— 阻塞所有 US
- **US1 (Phase 3)**: 依赖 Phase 2 完成
- **US2 (Phase 4)**: 依赖 Phase 2 完成(repo 必须支持 PR + CI);不依赖 US1(可并行)
- **US3 (Phase 5)**: 依赖 Phase 2 + US2(release 分支的镜像构建走 tag trigger,US2 已实现)
- **Polish (Phase 6)**: 依赖 US1 + US2 完成(verify-release.sh 校验的是已发布的 tag);US3 完成更佳

### User Story Dependencies

- **US1 (P1)**: 依赖 Foundational;不依赖其他 US
- **US2 (P2)**: 依赖 Foundational;不依赖 US1(可并行;但建议 US1 先,因为 deploy.yml 重构也走 PR 流程)
- **US3 (P3)**: 依赖 Foundational + **US2**(patch 流程必须靠 US2 实现的 tag-push trigger 才能真正发出去)

### Within Each User Story

- Foundational 任务全部 [P],可并行
- US2 的 T006(重构 deploy.yml)是单文件大改动,执行后再跑 T007/T008 验证
- US3 的 T009(分支保护)可与 US2 的 T006 并行(不同文件,无依赖)

### Parallel Opportunities

- T002 / T003 / T004 全部 [P](Foundational 内并行)
- T006 / T009 可并行(US2 deploy.yml 与 US3 release/v0.1 protection 不冲突)
- T011 / T013 可并行(Polish 内,scripts/ 与 README.md 不同文件)

---

## Parallel Example: Foundational + 跨 US

```bash
# Foundational 三个 task 可并行(不同 GitHub API endpoint 或不同文件):
Task: "T002 Repository settings via gh api -X PATCH"
Task: "T003 main branch protection via gh api -X PUT"
Task: "T004 PR template at .github/pull_request_template.md"

# US2 与 US3 的两条 task 也可并行:
Task: "T006 deploy.yml refactor in .github/workflows/deploy.yml"
Task: "T009 release/v0.1 branch protection via gh api"
```

---

## Implementation Strategy

### MVP First (仅 US1)

1. T001 Setup(验证工具)
2. T002 / T003 / T004 Foundational(repo settings + main protection + PR template)
3. T005 US1 验证(跑 quickstart 场景 1)
4. **STOP and VALIDATE**: 此时仓库已支持标准 PR 流程,**对日常开发已经够用**
5. 若立即要发版,继续 US2;否则可推迟

### Incremental Delivery

1. **Setup + Foundational** → repo 基建就绪
2. **+ US1** → 标准 PR 流程可用(MVP,日常开发即可推进)
3. **+ US2** → tag 触发镜像构建,可发版(修复 patch 漏洞)
4. **+ US3** → release/v0.1 分支保护,patch 流程规范化
5. **+ Polish** → verify-release.sh + README,新人可 30 分钟上手

### Single-Maintainer Strategy(当前场景)

- 本仓库当前单人维护,无并行团队
- 推荐顺序:T001 → T002/T003/T004(可一 PR 提交) → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013
- 每个 [USx] 验证 task 通过后再进下一阶段(避免 deploy.yml 改坏后影响 main)

---

## Notes

- 所有 `gh api` 命令需要 `gh auth login` 完成(T001 已验证)
- T003 / T009 的 branch protection 是**可逆**操作:错误配置后可通过 `gh api -X DELETE repos/:owner/:repo/branches/:branch/protection` 移除重设
- T006 的 deploy.yml 重构是**最大风险点**:若 `if` 分流写错,可能导致 main push 也构建 version 镜像(污染 `latest`)或 tag push 不触发构建(patch 发不出去)。务必先在 fork 或测试 tag(`v0.0.0-test-*`)上验证,再做真实 patch release
- T010 的 patch 验证会产生**真实发布**(`v0.1.2`);若不想污染 release 历史,可先在 fork 上测,或在 main 上手动跑一次 `v0.0.0-test-1` 后 `gh release delete` 清理(但 GHCR 镜像无法删,留痕可接受)
- 所有 task 完成后,`.specify/feature.json` 仍指向 `specs/015-git-release-workflow`;若要开始下一个 feature,重新跑 `/speckit-specify`
