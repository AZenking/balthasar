# Phase 1 Data Model: Git 发布工作流

**Feature**: 015-git-release-workflow
**Date**: 2026-07-09

本 spec 不引入数据库实体(宪法 v2.0.0 的 Drizzle/PostgreSQL 边界不受影响)。本文档定义工作流层的 **5 个抽象实体**及其属性、关系、生命周期,作为 contracts 与 quickstart 的语义基础。

---

## 实体关系图(文字版)

```
PullRequest ──merges into──> Branch(main | release/vX.Y)
                                  │
                                  │ carries
                                  ▼
                                Tag(vX.Y.Z)
                                  │
                                  │ 1:1 maps to
                                  ▼
                                Release(GitHub Release)
                                  │
                                  │ built from
                                  ▼
                                GHCR Image(version tags)
```

短分支(feat/fix/...)是临时实体,合并后自动删除。

---

## 1. Branch(分支)

**含义**: 一条 git ref,指向某个 commit。

**字段**:

| 字段 | 类型 | 约束 |
|------|------|------|
| `name` | string | `<type>/<scope>`(短分支)/ `main` / `release/vX.Y` |
| `type` | enum | `feature` / `main` / `release` |
| `base_commit` | sha | 切出时指向的父 commit |
| `head_commit` | sha | 当前 HEAD |
| `created_at` | timestamp | GitHub API: `branch._links.html` |
| `lifecycle_days` | int | feature 分支 ≤ 7;main/release 无上限 |

**校验规则**(对应 FR):
- FR-002:`name` 必须匹配 `^(feat|fix|chore|docs|refactor|perf|test)/[a-z0-9-]+$`(feature 分支)
- FR-003:`lifecycle_days <= 7`(feature 分支)
- FR-004:`release/vX.Y` 必须只到 minor,禁止 `release/vX.Y.Z`
- FR-005:仓库 MUST NOT 存在 `develop` / `staging` 等第二条长期主干

**生命周期**:
- **feature 分支**:`created` → PR opened → CI passes → squash merged → **deleted**(自动)
- **main**:永续;每次 squash merge 前进一个 commit
- **release/vX.Y**:`created`(按需,FR-016)→ 收 patch → 不再需要时 `deleted`(tag 永久保留可重建)

---

## 2. Tag

**含义**: annotated git ref,标记某个 commit 为版本 `X.Y.Z`。

**字段**:

| 字段 | 类型 | 约束 |
|------|------|------|
| `name` | string | `vX.Y.Z`(SemVer,v 前缀必须) |
| `target_commit` | sha | MUST 是 version-bump commit(FR-012) |
| `annotation` | string | 非空(annotated,非 lightweight) |
| `tagger` | string | git user |
| `created_at` | timestamp | tagger 时刻 |

**校验规则**:
- FR-011:`name` 匹配 `^v\d+\.\d+\.\d+$`,必须 `git tag -a`(annotated)
- FR-012:`target_commit` 的 `package.json.version` 必须等于 `name` 去掉 `v` 前缀的值
- FR-013:与 `Release.tagName` / `GHCR Image.X.Y.Z` / `package.json.version` 四者相等

**生命周期**:
- `created` → push to origin → **永久不可删除**(FR-018 禁止 force push;tag 是发布即不可撤销的事实)

---

## 3. Release(GitHub Release)

**含义**: GitHub Release 实体,与 tag 1:1 对应。

**字段**:

| 字段 | 类型 | 约束 |
|------|------|------|
| `tag_name` | string | = 对应 Tag.name |
| `title` | string | 默认 = tag_name(可定制) |
| `body` | markdown | `--generate-notes` 自动生成 |
| `is_latest` | bool | 最新非 patch release 为 true |
| `assets` | list | 暂无附件(纯容器发布) |

**校验规则**:
- FR-014:`body` 必须来自 GitHub auto-generated notes,**禁止** 维护独立 `CHANGELOG.md`
- 每个 tag 必须有对应 Release(可通过 `gh release create --generate-notes` 一次创建)

**生命周期**:
- `created`(tag push 后) → `published` → 永久(可标记为 prerelease,但一般直接 latest)

---

## 4. Pull Request

**含义**: GitHub PR 实体,把短分支的变更合并到 main/release。

**字段**:

| 字段 | 类型 | 约束 |
|------|------|------|
| `source_branch` | string | feature 分支 name |
| `target_branch` | string | `main` 或 `release/vX.Y` |
| `status_checks` | map<string, status> | 必须 = `{lint: pass, type-check: pass, test: pass}` |
| `merge_method` | enum | `squash`(唯一允许) |
| `linked_spec` | string? | `specs/NNN-*` 或 `null`(trivial 修复可空) |
| `state` | enum | `open` / `closed` / `merged` |

**校验规则**:
- FR-007:`status_checks` 必须三项全 pass
- FR-008:`merge_method` 必须为 `squash`
- FR-010:`linked_spec` 必须存在,或 PR 描述明确写 `no spec required`

**生命周期**:
- `open` → CI runs → (CI red:回到 open 等修复 / CI green:可 merge)→ `merged` → 短分支自动删除 → PR 转为只读归档

---

## 5. GHCR Image

**含义**: 推送到 `ghcr.io/<owner>/<repo>/app` 的容器镜像,以 tag 区分版本。

**字段**:

| 字段 | 类型 | 约束 |
|------|------|------|
| `registry` | string | `ghcr.io/azenking/balthasar/app` |
| `tags` | list<string> | 见下表分类 |
| `digest` | sha256 | 同 digest 可有多个 tag |
| `arch` | list<enum> | `[linux/amd64, linux/arm64]` |
| `built_from_commit` | sha | 触发构建的 commit |

**Tag 分类**(FR-019):

| 类别 | Tags | 触发事件 | 用途 |
|------|------|----------|------|
| Version tags | `X.Y.Z` / `X.Y` / `X` / `latest` | tag push (`v*`) | 用户/部署环境拉取 |
| Rolling tags | `<short-sha>` / `edge` | main push | 开发/测试拉取复现 |

**校验规则**:
- FR-019:两类触发器互斥,同一 tag 不能被两个事件竞争构建
- FR-013:`app:X.Y.Z` 的 digest 必须与 git tag `vX.Y.Z` 指向的 commit 一致
- `latest` 必须始终指向最新的稳定 tag(由 tag-push job 维护)

**生命周期**:
- Version tag:`built` → `pushed to GHCR` → 永久保留(不删,支持回滚拉取旧版本)
- Rolling tag:`built` → `pushed` → 被下一次 main push 覆盖(`edge` 是滚动别名)

---

## 跨实体不变量

1. **Tag ↔ Commit ↔ Image 三方绑定**:`vX.Y.Z` → version-bump commit → `app:X.Y.Z` 镜像,三者通过 `package.json.version` 派生,任何一方缺失即违反 FR-013。
2. **PR ↔ Spec 关联**:每个非 trivial PR 必须有 `specs/NNN-*` 锚点(FR-010)。
3. **Release line 单一性**:同一 minor line 同一时刻最多一个 `release/vX.Y` 分支(不允许 `release/v0.1` 与 `release/v0.1.x` 共存)。

## 不引入的实体(YAGNI)

- ❌ `CHANGELOG.md`(用 GitHub Release 替代)
- ❌ "Release Candidate" tag(`vX.Y.Z-rc.N`)—— 当前规模不需要 RC 流程
- ❌ "LTS" 标记 —— 单人项目无 LTS 概念
- ❌ Multi-registry 同步(只发 GHCR,不复制到 Docker Hub)
