# Contracts: 014-ops-docs

**Date**: 2026-07-08

本 feature 是**文档体系**,不暴露 API / RPC / SDK。契约面向**文档读者**与**文档维护者**:

1. **读者契约**: 谁该读哪份文档,期望学到什么
2. **维护者契约**: 文档结构 / 字数 / 引用规则
3. **代码契约**: 文档与源码的对照关系 (env 变量)
4. **演化契约**: 文档修订时的同步规则

---

## 1. 读者契约 (README 顶部矩阵)

| 你是 | 入口文档 | 你将学会 | 预计阅读时间 |
|---|---|---|---|
| 新开发者 (首次 clone) | `docs/getting-started.md` | 30 分钟跑通本地 dev,理解测试 / lint / 类型检查 | 5 min |
| 部署运维者 (NAS / VPS) | `docs/deployment.md` | 15 分钟选对模式 + 部署成功 + HTTPS 配置 | 5 min |
| 已部署运维者 (升级 / 备份) | `docs/operations.md` | 一键升级 / 备份 / 恢复 / 改配置 | 4 min |
| 排障中 (遇到错误) | `docs/troubleshooting.md` | 15+ 症状 → 原因 → 修复 → 验证 | 按需 |
| 想理解架构 | `docs/architecture.md` | feature-sliced 分层 + 关键目录 + 11 个 feature 摘要 | 2 min |
| 查 env 变量 | `docs/configuration.md` | 9 个变量类型 / 默认 / 修改后是否重启 | 按需 |

**契约**:
- 每份文档 MUST 在标题下 5 行内说明"适合谁"与"读完能做什么"
- 不属于目标读者的内容 MUST 链接到对应文档,不展开 (DRY)

---

## 2. 维护者契约

### 2.1 文件结构

每份文档 MUST 满足:

```markdown
# 标题 (短名)

<!--
Created: YYYY-MM-DD
Feature: 014-ops-docs
Audience: <角色>
Budget: <字数>
-->

## 目录

- [章节 1](#章节-1)
- [章节 2](#章节-2)
  ...

## 章节 1

内容...
```

### 2.2 字数预算

| 文档 | 预算 | 软上限 |
|---|---|---|
| getting-started.md | 1200 字 | 1500 |
| deployment.md | 1500 字 | 1800 |
| operations.md | 1200 字 | 1500 |
| troubleshooting.md | 1200 字 | 1500 (表格行数 ≥ 15) |
| configuration.md | 600 字 | 800 |
| architecture.md | 300 字 | 500 |
| **合计** | **6000 字** | **7600 字** |

超预算时优先砍示例,不砍章节。

### 2.3 引用规则

- **跨文档引用**: 相对路径 (`./configuration.md` / `../README.md`)
- **代码引用**: 链接到具体文件 (`src/lib/env.ts`),不复制代码
- **外部引用**: 完整 URL,优先官方文档锚点 (例:`https://www.better-auth.com/docs/...#section`)
- **死链检查**: 实施时人工点击每个链接验证 (T018 任务)

### 2.4 命令示例规则

所有命令 MUST:
- 标注语言 (`bash` / `sh` / `yaml`)
- 默认 Linux/macOS 语法,Windows 提示用 WSL2
- 复制即可运行,不需要用户先 export 中间变量 (除非变量名明显,如 `BETTER_AUTH_SECRET`)

---

## 3. 代码契约 (env 变量对齐)

### 3.1 单一主源

`src/lib/env.ts` 的 zod schema 是环境变量的**唯一主源**。`docs/configuration.md` 是**派生文档**,必须与主源一致。

### 3.2 校验流程 (实施时执行)

```bash
# 提取源码中的变量名
SRC_VARS=$(grep -oE '^\s+[A-Z_]+:\s+z\.' src/lib/env.ts | tr -d ' :' | awk -F: '{print $1}' | sort -u)

# 提取文档中的变量名
DOC_VARS=$(grep -oE '^\| `[A-Z_]+`' docs/configuration.md | tr -d '|` ' | sort -u)

# 对比
diff <(echo "$SRC_VARS") <(echo "$DOC_VARS")
# 期望: 无输出
```

### 3.3 期望变量清单 (9 项)

| 变量 | 分类 | 默认 | 重启? |
|---|---|---|---|
| `DATABASE_URL` | 必填 | — | ✓ |
| `BETTER_AUTH_SECRET` | 必填 | — | ✓ |
| `BETTER_AUTH_URL` | 必填 | — | ✓ |
| `NODE_ENV` | 选填 | `development` | ✓ |
| `ALLOW_REGISTRATION` | 选填 | `false` | ✓ |
| `NEXT_PUBLIC_ALLOW_REGISTRATION` | 选填 | 同 `ALLOW_REGISTRATION` | ✓ (client bundle 编译时) |
| `TZ` | 选填 | `Asia/Shanghai` | ✓ |
| `BALTHASAR_ENTRYPOINT_MODE` | 选填 | `serve` | ✓ |
| `POSTGRES_HOST` | 选填 | `postgres` | ✓ |

---

## 4. 演化契约

### 4.1 新增 feature 时的同步规则

| 变更类型 | 必须更新 |
|---|---|
| 新 env 变量 | `docs/configuration.md` + `src/lib/env.ts` (主源) |
| 新部署模式 | `docs/deployment.md` 加章节 + 决策树更新 |
| 新故障症状 | `docs/troubleshooting.md` 加行 |
| 新 feature 完成 | `docs/architecture.md` 加摘要行 |
| 重大行为变更 | 所有受影响文档同步,加 `> ⚠️ v0.X 行为变更` 提示 |

### 4.2 修订流程

1. 改源文件 (主源文档)
2. 跑 SC-007 (DRY) 检查: 其他文档是否还引用旧事实
3. 跑 SC-008 (env 对齐) 检查: configuration.md 是否同步
4. 提交时 commit message 注明 `docs: update X for Y`

### 4.3 版本兼容性

文档不版本化 (用最新 git HEAD 即可),但**重大变更** MUST 在文档头部加 changelog 注释:

```markdown
<!--
Changelog:
  2026-07-08: 初版 (014-ops-docs)
  2026-08-01: 新增 ARM 部署章节
-->
```

---

## 5. 与 013-simple-deploy 的契约

`deploy/simple/README.md` (013 产物) 是**部署细节**主源。`docs/deployment.md` 的 simple 章节只做:

1. 决策树指向 simple 模式
2. 链接到 `deploy/simple/README.md`
3. 提供"5 步速览" (概述,不复制细节)
4. 部署后验证 checklist (引用 013 已有内容)

**禁止**: 在 `docs/deployment.md` 复制 013 README 的 DSM 反代步骤、env 变量等具体内容。

---

## 6. 与 012-deploy-simplify 的契约

012 prod 部署**未完成实施**。`docs/deployment.md` 的 prod 章节:

- 标注 `> ⚠️ V2 待定,012-deploy-simplify 完成后补全`
- 列出预期场景 (对外 HTTPS + 自动备份)
- 不展开步骤
- 链接到 `docker/docker-compose.prod.yml` (现状) 与 `specs/012-deploy-simplify/spec.md` (规划)

---

## 7. 测试场景

文档无单元测试。验证通过:

- **quickstart.md** (本 feature Phase 1 产物): 3 个用户角色场景跑通
- **SC-001 ~ SC-010** (spec.md): 字数 / 链接 / env 对齐 / 角色入口矩阵等量化指标
- **人工 review**: 至少 1 位新开发者 + 1 位运维者按文档操作,反馈体验

---

## 8. 与 constitution 的关系

- **原则六 (YAGNI)**: 不引入 Docusaurus / 截图 / 视频 / PDF 导出 / 自动 TOC 工具
- **原则二 (Feature-Sliced)**: 文档按"用户角色"切片,与代码 feature 切片互补
- **原则四 (Test-First)**: 不适用 (文档无测试),但 SC 是验收标准
