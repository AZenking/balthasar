# Feature Specification: Git 发布工作流 (主线 + 短分支 PR + Tag 发布)

**Feature Branch**: `015-git-release-workflow`(本 spec 为文档型,无代码分支)

**Created**: 2026-07-09

**Status**: Draft

**Input**: User description: "主线分支策略 + 短分支 PR + tag 发布"

## Clarifications

### Session 2026-07-09

- Q: 单人项目下 `main` 分支保护严格度? → A: **B** —— 日常 PR + admin 紧急 bypass 允许;默认走 PR 留痕,紧急时(线上挂)可直接 push main,但所有 bypass 必须事后补 PR 说明。
- Q: `release/vX.Y` 分支创建时机? → A: **B** —— 按需创建:仅当某个已发布 minor line 首次需要 patch 时才从对应 tag 切出;patch 周期结束后可删除(保留 tag 即可重建)。避免无用分支堆积。
- Q: `deploy.yml` 触发策略? → A: **B** —— tag 与镜像严格 1:1 绑定。main push 改为只构建 `<short-sha>` / `edge` 滚动镜像;tag push 才构建 `X.Y.Z` / `X.Y` / `X` / `latest` version 镜像。修复 patch 流程无法触发构建的漏洞,同时避免 main 上 version 提前漂移。
- Q(执行时发现):仓库当前 `lint` 跑不起来 —— `next lint` 在 Next 16 被移除,直接 `eslint .` 又因 `eslint-config-next` 与 ESLint 9 FlatConfig 不兼容而 crash(`circular structure`)。 → A: **FR-007 降级** —— `type-check` + `test` 为 MUST;`lint` 在 CI 中以 `continue-on-error: true` 运行作为非阻塞质量信号。lint 兼容性修复 defer 到独立 task(超出 015 范围)。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 开发者提交一次变更 (Priority: P1)

开发者完成一个功能、修复或文档变更后,从最新 `main` 切出一条短生命周期的分支,推送后开 PR;在 CI 全绿后由维护者合并回 `main`。这是仓库日常推进的唯一入口。

**Why this priority**: 这是工作流的"心跳" —— 每一次代码进库都走这条路。没有它,后续的发布与 patch 流程都失去前提。

**Independent Test**: 在一个空白工作日里完成一次"切分支 → 提交 → PR → CI 绿 → 合并"的完整循环,即可独立验证。最终产物是 `main` 上多出一条 squash commit。

**Acceptance Scenarios**:

1. **Given** `main` 处于干净状态, **When** 开发者从 `main` 切出 `feat/<scope>` 分支并推送数个 commit, **Then** GitHub 自动提供 "Create a pull request" 入口,且 PR 模板引导填写动机/测试/风险。
2. **Given** 一个开启的 PR, **When** CI(`lint` / `type-check` / `test`)全部通过, **Then** 该 PR 进入可合并状态;若任一检查失败,合并按钮被禁用。
3. **Given** 一个 CI 全绿的 PR, **When** 维护者点击合并, **Then** 合并方式为 **squash merge**,合并后 `main` 上只新增一条遵循 Conventional Commits 的 commit。
4. **Given** 短分支已合并, **When** 维护者查看分支列表, **Then** 该短分支被自动删除(GitHub 选项 "Automatically delete head branches")。

---

### User Story 2 - 维护者发布新版本 (Priority: P2)

维护者在 `main` 推进到稳定点后,通过打 annotated tag 触发一次正式发布:GitHub Release 自动生成 changelog,GHCR 上的镜像 tag 同步更新到新版本号。

**Why this priority**: 发布是把"开发完成"转化为"用户可用"的唯一动作;没有它,代码进库但永远不达用户。但它的频率远低于 US1,所以是 P2。

**Independent Test**: 选定一个稳定 commit,完成"升 package.json version → commit → 打 tag → push → 创建 Release"全流程,30 分钟内在 GHCR 看到对应 version 的镜像 tag。

**Acceptance Scenarios**:

1. **Given** `main` 处于待发布状态, **When** 维护者把 `package.json` 的 `version` 字段改成 `X.Y.Z` 并提交, **Then** 该 commit 是即将打的 tag 所指向的 commit。
2. **Given** 上一步已完成, **When** 维护者执行 `git tag -a vX.Y.Z -m "Release vX.Y.Z"` 并 `git push origin vX.Y.Z`, **Then** 远端出现该 annotated tag,且指向 version-bump commit。
3. **Given** tag 已推送, **When** 维护者执行 `gh release create vX.Y.Z --generate-notes`, **Then** GitHub Release 页面出现 `vX.Y.Z`,Release notes 自动汇总自上次 Release 以来的所有 PR/commit。
4. **Given** tag 已推送或 `main` 已收到 version-bump commit, **When** CI(`deploy.yml`)运行完毕, **Then** GHCR 上出现 `app:X.Y.Z`、`app:X.Y`、`app:X`、`app:latest` 四个 tag(其中 `X.Y.Z` 与 package.json 完全一致)。
5. **Given** 一次发布完成, **When** 任意第三方执行 `docker pull ghcr.io/azenking/balthasar/app:X.Y.Z`, **Then** 拉到的是 tag `vX.Y.Z` 所指向 commit 构建的镜像。

---

### User Story 3 - 维护者发布 Patch 修复 (Priority: P3)

线上运行 `vX.Y.Z` 后发现 bug,维护者在对应 `release/vX.Y` 分支上 cherry-pick 修复,打 `vX.Y.(Z+1)` tag 发布 patch;`main` 上同期或稍后也得到该修复(若尚未包含)。

**Why this priority**: patch 流程只在 0.1.x / 0.2.x 等已发布线上版本需要热修时触发,频率最低,但每次都不能出错。所以是 P3 但不能省略。

**Independent Test**: 模拟一次"在 main 上修一个 bug → cherry-pick 到 `release/v0.1` → 打 `v0.1.1` → 创建 Release"的完整路径,验证 GHCR 上出现 `app:0.1.1` 镜像。

**Acceptance Scenarios**:

1. **Given** `release/vX.Y` 分支存在(由本次或上次发布建立), **When** 维护者从 `main` 把修复 commit cherry-pick 到该分支, **Then** 该分支 HEAD 包含修复,且不引入 main 上的非相关变更。
2. **Given** cherry-pick 完成, **When** 维护者更新 `package.json` 到 `X.Y.(Z+1)` 并打 annotated tag `vX.Y.(Z+1)`, **Then** tag 指向该 patch 的 version-bump commit。
3. **Given** tag 已推送, **When** CI 运行, **Then** GHCR 上出现 `app:X.Y.(Z+1)` 镜像,且 `app:X.Y` / `app:X` / `app:latest` 的 tag 也被更新到该 patch commit(因为 patch 是该 minor line 的最新)。
4. **Given** patch 已发布, **When** 维护者创建 GitHub Release `vX.Y.(Z+1)`, **Then** Release notes 仅包含该 patch 引入的变更(不包含 main 上未发布的 feature)。

---

### Edge Cases

- **短分支长期未合并**:`feat/*` 分支开 PR 超过 7 天未合并时如何处理?(关闭 / 拆分 / 强制合并 — 由 Assumptions 给默认)
- **PR CI 失败**:CI 红时,合并按钮禁用;维护者不得手动 bypass。
- **package.json version 与 git tag 不一致**:例如 `package.json=0.2.0` 但打了 `v0.3.0` tag —— 此时 GHCR 镜像 tag 仍是 `0.2.0`,与 git tag 解耦。修复策略见 FR-007。
- **main 上紧急 hotfix**:线上挂了,等不及 PR?默认仍走 PR(单人项目可 self-merge 但必须留 PR 痕迹),禁止直接 push main。
- **同一天连续发多个 patch**:0.1.1 → 0.1.2 在数小时内?允许,只要每次都走完整发版流程。
- **release/vX.Y 分支需要回退某次 patch**:不删除已发布的 tag(发布即不可撤销),通过新 patch 反向修复。
- **PR 跨 release line cherry-pick**:同一 bug 需要分别 cherry-pick 到多个 release line(如 0.1.x 和 0.2.x 都受影响)时,各自独立 cherry-pick + 打 tag。

## Requirements *(mandatory)*

### Functional Requirements

#### 分支策略

- **FR-001**: 仓库 MUST 以 `main` 作为唯一长期主干;所有功能、修复、文档变更 MUST 从 `main` 切出短分支开始。
- **FR-002**: 短分支命名 MUST 采用 `<type>/<scope>` 格式,`<type>` ∈ `{feat, fix, chore, docs, refactor, perf, test}`;`<scope>` 为简短 kebab-case 标识(如 `feat/transaction-filter`、`fix/auth-500`)。
- **FR-003**: 短分支生命周期 MUST ≤ 7 自然日;超过 7 天未合并的分支 MUST 拆分为更小 PR 或显式关闭。
- **FR-004**: 发布线分支(若启用)MUST 命名为 `release/vX.Y`,**只到 minor**,禁止用 `release/vX.Y.Z` 或裸 `vX.Y.Z` 作为分支名(避免与同名 tag 冲突)。
- **FR-005**: 仓库 MUST NOT 存在第二条长期主干(如 `develop`、`staging`);所有"集成"都发生在 `main` 上。

#### PR & 合并

- **FR-006**: 日常合并到 `main` 的变更 MUST 经 Pull Request;**禁止** 非紧急情况直接 push 到 `main`。管理员紧急情况下(线上故障、回滚等)MAY 直接 push 到 `main`,但 MUST 在 **24 小时内补一条 PR**(描述变更原因、影响、回滚方案),以保留审计痕迹。
- **FR-007**: PR MUST 通过以下状态检查后方可合并:`type-check`、`test`(单元 + 集成);任一失败 MUST 阻断合并。`lint` 为非阻塞检查(允许失败,作为质量信号),待 `eslint-config-next` 与 ESLint 9 FlatConfig 兼容性修复后升级为 MUST(详见 Clarifications Q4 与 tasks.md T014)。
- **FR-008**: 合并方式 MUST 为 **squash merge**;合并后的 commit message MUST 遵循 Conventional Commits(类型 + 可选 scope + 描述 + 可选 footer)。
- **FR-009**: 合并后短分支 MUST 自动删除(GitHub 仓库设置 "Automatically delete head branches" 启用)。
- **FR-010**: 每个 PR MUST 在描述中链接到对应的 `specs/NNN-*` 目录或 issue;无对应 spec 的 trivial 修复(如 typo)MUST 在 PR 描述中说明 "no spec required"。

#### Tag & 发布

- **FR-011**: 发布 MUST 通过 annotated tag(`git tag -a`),命名 `vX.Y.Z`,符合 SemVer;**禁止** 使用轻量 tag(`git tag` 不带 `-a`)。
- **FR-012**: tag `vX.Y.Z` MUST 指向"version-bump commit" —— 即把 `package.json` 的 `version` 改为 `X.Y.Z` 的那一次 commit。**禁止** 让 tag 指向版本号仍是旧值的 commit。
- **FR-013**: `package.json` version / git tag / GitHub Release / GHCR 镜像 version tag 四者 MUST 在每次发布后保持一致。GHCR 镜像 version tag(`X.Y.Z` / `X.Y` / `X` / `latest`)由 **tag push 事件**触发构建(deploy.yml),不手动设置,不与 main push 共用同一组 tag 命名空间。
- **FR-014**: 每次 tag 推送后 MUST 同步创建 GitHub Release,Release notes 使用 `--generate-notes` 自动生成;**禁止** 维护独立的 `CHANGELOG.md`(单一真相源是 GitHub Release 页)。
- **FR-015**: Patch release(`X.Y.Z → X.Y.(Z+1)`)MUST 在对应的 `release/vX.Y` 分支上进行,通过 cherry-pick 引入修复;**禁止** 在 main 上直接累积 patch。
- **FR-016**: Minor / Major release(`X.Y.Z → X.(Y+1).0` 或 `(X+1).0.0`)MUST 在 `main` 上进行。**`release/vX.Y` 分支按需创建**:仅当某个已发布 minor line 首次需要 patch 时,才从对应 `vX.Y.Z` tag 切出 `release/vX.Y`;patch 周期结束(无更多 patch 计划)后,该分支 MAY 删除(git tag 永久保留,需要时可从 tag 重建分支)。

#### 分支保护

- **FR-017**: `main` 分支 MUST 启用分支保护:要求 PR、要求 status check(`lint` / `type-check` / `test`)通过、禁止 force push。允许管理员在紧急情况下 bypass(GitHub "Do not allow bypasses" 设置中保留 "Administrators" 例外);每次 bypass 触发 FR-006 的 24 小时补 PR 义务。
- **FR-018**: `release/vX.Y` 分支 MUST 启用分支保护:只允许 fast-forward 或 squash merge,禁止 force push,禁止删除。
- **FR-019**: `deploy.yml` MUST 按 push 事件类型分流构建逻辑,两类触发器互斥:
  - `push` to `main`:构建 `<short-sha>` 与 `edge` 滚动镜像(反映 main HEAD 状态),**禁止** 构建 version 形式的镜像 tag(`X.Y.Z` / `X.Y` / `X` / `latest`)。
  - `push` of tag `v*`:构建 `X.Y.Z` / `X.Y` / `X` / `latest` 四个 version 镜像 tag,**禁止** 构建 `<short-sha>` / `edge`(由 main push 负责)。
  - 这样设计的目的是让 `latest` / `X.Y.Z` 等用户可拉取的镜像 tag 严格与某个 git tag 一一对应,避免 main 上 version 字段提前修改导致镜像 tag 漂移。

### Key Entities *(include if feature involves data)*

- **Branch(分支)**: 一条 git ref。属性:name(`<type>/<scope>` 或 `main` 或 `release/vX.Y`)、起点 commit、生命周期(短分支 ≤ 7 天)。
- **Tag**: 一个 annotated git ref,命名 `vX.Y.Z`,指向 version-bump commit。属性:semver 三元组、tagger、tag message、创建时间。
- **Release**: GitHub Release 实体,与 tag 一一对应。属性:title、auto-generated notes、是否标记为 latest、关联的 GHCR 镜像 tag。
- **Pull Request**: GitHub PR 实体。属性:source branch、target branch(`main` 或 `release/vX.Y`)、status checks、merge method(squash)、关联 spec。
- **GHCR Image**: 容器镜像,分两类:
  - **Version tags**(`X.Y.Z` / `X.Y` / `X` / `latest`):由 **tag push** 触发 deploy.yml 构建,与某个 git tag 一一对应;面向最终用户/部署环境。
  - **滚动 tags**(`<short-sha>` / `edge`):由 **main push** 触发构建,反映 main HEAD;不与任何 version 绑定,仅供开发/测试拉取复现。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `main` 上 95% 的 commit 通过 "PR + CI 全绿 + squash merge" 路径进入(允许 ≤ 5% 的紧急 self-merge,但 MUST 留 PR 痕迹)。
- **SC-002**: 短分支从创建到合并的耗时中位数 ≤ 3 自然日,P90 ≤ 7 自然日;超过 7 天的分支必须被拆分或关闭。
- **SC-003**: 每次发布后,`package.json` version / git tag / GitHub Release / GHCR 镜像 tag 四者 100% 一致(用脚本可一键校验)。
- **SC-004**: 从 tag 推送到 GHCR 上对应 `app:X.Y.Z` 镜像可用,耗时 ≤ 30 分钟(CI 中位时长)。
- **SC-005**: `main` 与 `release/vX.Y` 分支的 CI 在最近 30 天内 100% 绿(失败的 commit 必须立即回滚或修复,不允许"红着往前走")。
- **SC-006**: 一名新贡献者(或三个月后的自己)能在 ≤ 30 分钟内仅凭仓库文档完成"切分支 → PR → 合并"或"打 tag → Release"的完整流程,无需口头追问。

## Assumptions

- 仓库已经事实采用 trunk-based development(主线 `main` 推进);本 spec 是把既有实践形式化,不引入新工作流。
- 维护者目前为单人(git user: yangyang),PR review 默认 self-merge;若未来引入贡献者,review 策略需要重新审视。
- `deploy.yml` 当前(2026-07-09)只在 push to main 时触发,用 `package.json` version 作为镜像 tag —— 本 spec **要求修改**:拆为 main-push(构建 `<short-sha>` / `edge`)和 tag-push(构建 `X.Y.Z` / `X.Y` / `X` / `latest`)两类触发器(详见 FR-019)。
- Conventional Commits 作为 commit message 标准;SemVer 作为版本号标准 —— 二者已被仓库历史采纳,本 spec 沿用。
- GitHub Release auto-generated notes 足够作为 changelog;**不**维护独立的 `CHANGELOG.md`(避免双重维护与漂移)。
- 短分支 7 天上限基于"功能应在数天内完成"的工程直觉;若一个 feature 确实需要更长时间,拆分为多个 ≤ 7 天的增量 PR。
- patch release 频率预期低(每月 ≤ 1 次);若某个 minor line 持续高频 patch,考虑加速 major/minor 推进,而非长期维护多条 release line。
- 本 spec 不覆盖:issue 模板、PR 模板的具体字段、code review checklist 的细则 —— 这些属于 plan 阶段的实现细节。
