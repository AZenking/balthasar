# Data Model: 014-ops-docs

**Date**: 2026-07-08

本 feature 是**文档体系**,**不引入任何数据库 schema 变更**。本文档聚焦:
1. 文档目录结构
2. 文档元数据 (标题 / TOC / 字数预算)
3. 跨文档引用图
4. 文档与代码的对照关系 (env 变量校验)

---

## 1. 数据库表

**零变更**。本 feature 不触及任何 DB schema。

---

## 2. 文件系统布局

### 仓库内新增

```
docs/
├── getting-started.md      # 新开发者启动指南 (~1200 字)
├── deployment.md           # 部署指南,3 模式决策树 (~1500 字)
├── operations.md           # 运维手册 (升级/备份/恢复/配置变更) (~1200 字)
├── troubleshooting.md      # 故障排查,4 栏表格 ≥ 15 行 (~1200 字)
├── configuration.md        # 环境变量与配置参考 (~600 字)
└── architecture.md         # 架构导览 (~300 字)
```

### 仓库内修改

```
README.md                   # 顶部加"按角色入口"4 行表格 (链到上述 6 份)
```

### 不修改

```
docs/AGENTS.md              # 保留,被 architecture.md 引用
docs/DATABASE.md            # 保留,被 architecture.md 引用
docs/DOMAIN.md              # 保留,被 architecture.md 引用
docs/MVP.md                 # 保留,被 architecture.md 引用
docs/PRD.md                 # 保留,被 architecture.md 引用
docs/ROADMAP.md             # 保留,被 architecture.md 引用
deploy/simple/README.md     # 保留,被 deployment.md 引用
docker/docker-compose.yml   # 保留,被 deployment.md 引用
docker/docker-compose.prod.yml  # 保留,被 deployment.md 引用 (标注 V2)
```

---

## 3. 文档元数据 Schema

每份新文档 MUST 满足:

| 字段 | 类型 | 要求 |
|---|---|---|
| H1 标题 | string | 文件首行,格式 `# 标题 (短名)` |
| 元数据注释 | HTML 注释 | 标题下 3-5 行,记录创建日期 / 版本 / 维护者 |
| TOC | markdown list | 元数据后,5-10 行,锚点用 GitHub slug |
| 章节 H2 | markdown | 与 TOC 一一对应 |
| 字数 | int | ≤ 预算 (见 research.md Q9) |
| 跨文档引用 | 相对路径链接 | 不复制其他文档内容 |
| 代码块 | fenced | 必带语言标识 (bash / sh / ts / yaml) |

### 示例 (getting-started.md 头部)

```markdown
# 启动指南 (getting-started)

<!--
Created: 2026-07-08
Feature: 014-ops-docs
Audience: 新开发者
Budget: 1200 字
-->

## 目录

- [前置环境](#前置环境)
- [安装依赖](#安装依赖)
- [配置环境变量](#配置环境变量)
- [启动 Postgres](#启动-postgres)
- [跑迁移](#跑迁移)
- [启动 dev](#启动-dev)
- [验证](#验证)
- [常见首次启动失败](#常见首次启动失败)
- [下一步](#下一步)

## 前置环境

...
```

---

## 4. 跨文档引用图

```
README.md (角色矩阵)
  ├─→ docs/getting-started.md
  │     └─→ docs/architecture.md (理解代码结构)
  │     └─→ docs/configuration.md (env 变量详解)
  │
  ├─→ docs/deployment.md
  │     ├─→ docs/getting-started.md (dev 模式细节)
  │     ├─→ deploy/simple/README.md (simple 模式细节)
  │     ├─→ docker/docker-compose.prod.yml (prod 模式,V2)
  │     └─→ docs/operations.md (部署后运维)
  │
  ├─→ docs/operations.md
  │     ├─→ docs/configuration.md (env 修改)
  │     └─→ docs/troubleshooting.md (失败排查)
  │
  └─→ docs/troubleshooting.md
        ├─→ docs/getting-started.md (重装步骤)
        ├─→ docs/operations.md (备份恢复)
        └─→ docs/configuration.md (变量确认)

docs/architecture.md (独立)
  ├─→ docs/AGENTS.md
  ├─→ docs/DOMAIN.md
  ├─→ docs/DATABASE.md
  ├─→ docs/MVP.md
  ├─→ docs/PRD.md
  └─→ docs/ROADMAP.md

docs/configuration.md (独立,env 单一主源)
  └─→ src/lib/env.ts (源码对照)
```

**性质**:
- 有向无环图 (DAG),无循环引用
- configuration.md 与 architecture.md 是"叶子节点",被多文档引用但不引用其他操作文档
- getting-started.md 是"根节点"之一,被 README + deployment 引用

---

## 5. 环境变量校验 (SC-008 强制)

### 校验流程

```bash
# 1. 从 src/lib/env.ts 提取 zod schema 定义的变量名
grep -oE '"[A-Z_]+":' src/lib/env.ts | tr -d '"' | tr -d ':' | sort -u

# 2. 从 docs/configuration.md 提取文档化的变量名
grep -oE '^\| `[A-Z_]+`' docs/configuration.md | tr -d '|` ' | sort -u

# 3. diff 两份列表,期望为空
diff <(step1) <(step2)
```

### 期望变量清单 (基于 src/lib/env.ts 现状 + 013 新增)

| 变量 | 来源 | 类型 |
|---|---|---|
| DATABASE_URL | 既有 | server, URL |
| BETTER_AUTH_SECRET | 既有 | server, string ≥16 |
| BETTER_AUTH_URL | 既有 | server, URL |
| NODE_ENV | 既有 | server, enum |
| ALLOW_REGISTRATION | 013 新增 | server, enum true/false, default false |
| TZ | 013 新增 | server, string, default Asia/Shanghai |
| BALTHASAR_ENTRYPOINT_MODE | 013 新增 | server, enum serve/migrate |
| POSTGRES_HOST | 013 新增 | server, string, default postgres |
| NEXT_PUBLIC_ALLOW_REGISTRATION | 013 新增 | client, enum true/false |

合计 9 个变量。`docs/configuration.md` MUST 列出全部 9 个,无遗漏。

---

## 6. 状态机

文档无运行时状态。但**文档演化**有隐式状态机:

```
[新文档创建]
  └─ 字数 ≤ 预算 ✓
       └─ 跨文档引用校验 ✓ (无死链)
            └─ env 变量校验 ✓ (SC-008)
                 └─ [发布]
                      └─ 用户反馈 → 修订 → [新版本]
                           └─ 重大变更 → 同步更新引用方
```

**校验时机**:
- 实施完成时 (T018 验证)
- 每次 env.ts 改动后 (CI 可加 lint,但本 feature 不引入 CI)
- 每次 feature 完成后 (人工)

---

## 7. 与其他 feature 的关系

| Feature | 关系 |
|---|---|
| 001-011 (业务功能) | architecture.md 列出每个 feature 一行摘要 |
| 012-deploy-simplify (prod 部署) | deployment.md 引用,标注 "V2 待定" |
| 013-simple-deploy (NAS 部署) | deployment.md + operations.md 引用 `deploy/simple/README.md`,不复制 |
| 014-ops-docs (本 feature) | 不引入代码,只产文档 |

**零代码冲突**:本 feature 不修改任何 `.ts` / `.tsx` / `.yml` / `.sh` 文件,只新增 `.md` 与修改 `README.md`。
