# Phase 0 Research: 014-ops-docs

**Date**: 2026-07-08

本文档解决 spec.md Technical Context 中潜在模糊项 + Deferred 实现细节。

---

## Q1: DRY 策略 — 备份/升级/恢复信息放在哪份文档?

### Decision

**单一主源 + 其他文档引用链接**。具体:

| 主题 | 主源文档 | 其他文档 |
|---|---|---|
| 备份命令 | `docs/operations.md#备份` | troubleshooting 症状"备份失败" → 链接;configuration 中 `BACKUP_DIR` 变量描述 → 链接 |
| 升级流程 | `docs/operations.md#升级` | deployment "首次部署" 章节末"未来升级见..." → 链接 |
| 恢复流程 | `docs/operations.md#恢复` | troubleshooting "数据丢失" 症状 → 链接 |
| 环境变量 | `docs/configuration.md` | 所有文档用到具体变量时 → 链接 |
| 启动命令 | `docs/getting-started.md` | deployment 中"开发者模式" → 链接 |

### Rationale

- **避免漂移**:命令更新时只改一处,其他自动跟进。
- **GitHub Markdown 友好**:相对路径链接在 GitHub 渲染时直接可点击。
- **业界标准**:Stripe / Vaultwarden / Nextcloud 文档都用此模式。

### Alternatives Considered

- **每份文档自包含**:重复信息,版本演化时易漂移 (违反 SC-007)。
- **中央 INDEX.md**:增加一层间接,违反 YAGNI。

---

## Q2: TOC (目录) 自动 vs 手写

### Decision

**手写 TOC + GitHub 自动锚点**。每份文档头部 5-10 行 TOC,锚点用 GitHub 自动生成的 slug (小写 + 连字符)。

### Rationale

- GitHub 自动从 `## 标题` 生成 `#标题-slug`,无需工具。
- 手写 TOC 比 markdown-toc 等工具更可控 (中文锚点处理一致)。
- 不引入 pre-commit hook / CI 校验 (YAGNI)。

### Alternatives Considered

- **markdown-toc (npm)**:增加构建依赖,且中文锚点生成规则与 GitHub 偶有出入。
- **Doctoc / mdox**:同上。
- **Docusaurus**:违反 Assumptions (不引入静态站点生成器)。

---

## Q3: 文档间引用 — 相对路径 vs 绝对路径

### Decision

**相对路径**。例:`docs/operations.md` 引用 `docs/configuration.md` 用 `[配置参考](./configuration.md)`,引用仓库根 `README.md` 用 `[README](../README.md)`。

### Rationale

- GitHub 渲染相对路径为可点击链接,且在本地预览 (VSCode Markdown preview) 也工作。
- 绝对路径 (`/docs/configuration.md`) 在 GitHub 上是仓库根相对,但跨 fork / rename 时易断。
- 外部链接 (Better-Auth / Drizzle 文档) 用完整 URL。

### Alternatives Considered

- **绝对路径** (`/docs/...`):跨 fork / 重命名仓库时易断。
- **permalink (git SHA 锚点)**:维护成本高,且 GitHub 渲染普通相对路径已经够用。

---

## Q4: 跨文档搜索 — 是否需要 INDEX.md?

### Decision

**不需要**。`README.md` 顶部"按角色入口"矩阵就是入口,每份文档头部 TOC 提供二级导航。GitHub 仓库搜索 (`/search`) 是兜底。

### Rationale

- 4 角色 × 6 文档,信息密度低,INDEX 是过度工程 (YAGNI)。
- 业界自托管项目 (Immich / Vaultwarden / Nextcloud) 都用 README + 文档头部 TOC,无 INDEX。

### Alternatives Considered

- **`docs/INDEX.md`**:增加一层间接,且搜索引擎 (Google) 优先索引 README。
- **`docs/README.md`**:与仓库根 README 信息重复,违反 DRY。

---

## Q5: README 顶部"按角色入口"矩阵布局

### Decision

**4 行表格**,3 列 (角色 | 入口文档 | 你将学会)。位置:README 项目标语下方第一段。

```markdown
## 按角色入口

| 你是... | 入口文档 | 你将学会 |
|---|---|---|
| 新开发者 | [启动指南](docs/getting-started.md) | clone → install → dev → test,30 分钟跑通 |
| 部署运维者 | [部署指南](docs/deployment.md) | 选 dev/simple/prod 模式,15 分钟部署 |
| 已部署运维者 | [运维手册](docs/operations.md) | 升级 / 备份 / 恢复 / 改配置 |
| 排障中 | [故障排查](docs/troubleshooting.md) | 15+ 症状 → 原因 → 修复 |
```

### Rationale

- 4 角色覆盖所有读者 (开发者 / 未部署运维 / 已部署运维 / 排障)。
- "你将学会"列让用户预判文档价值,降低跳出率。
- 链接相对路径 (Q3),GitHub 渲染正确。

### Alternatives Considered

- **章节列表 (无表格)**:视觉密度低,扫读慢。
- **2 列表格 (角色 + 链接)**:缺"你将学会",用户需点进去才知道内容。

---

## Q6: 故障排查表格列数

### Decision

**4 栏**:`症状 | 原因 | 修复 | 验证`。

```markdown
| 症状 | 原因 | 修复 | 验证 |
|---|---|---|---|
| `docker compose up` 后 app 反复重启 | entrypoint 迁移失败 | `docker compose logs app` 看 SQL 错误 | 修复后 `docker compose ps` 显示 healthy |
```

### Rationale

- **症状**:用户视角的"我看到了什么"。
- **原因**:技术解释 (1 句)。
- **修复**:可复制命令或步骤。
- **验证**:确认修复的检查命令。
- 4 栏信息密度高,符合 Stripe status / GitHub status 页风格。

### Alternatives Considered

- **3 栏** (症状 / 原因 / 修复):缺验证,用户不确定修复是否生效。
- **5 栏** (加"预防"):冗长,违反 SC-004 (≤ 6000 字)。

---

## Q7: 部署模式决策树形式

### Decision

**4 问表格 + 推荐模式**。在 `docs/deployment.md` 头部:

```markdown
## 选哪种模式?

回答 4 个问题,推荐唯一模式:

| 问题 | 你的回答 | 推荐模式 |
|---|---|---|
| 目标? | 本地开发 / 评估产品 | **dev** |
| 部署位置? | 家用 NAS / 内网 / VPN 后端 | **simple** |
| 部署位置? | VPS / 云主机 + 公网域名 + 自动备份需求 | **prod (012,V2)** |
| 都不是? | 测试 CI / 临时 | **dev** |
```

### Rationale

- 表格扫读快,4 个问题 ≤ 30 秒能定位。
- 不用 Mermaid 流程图 (渲染依赖,GitHub 部分客户端不显示)。
- "都不是?"兜底,防止用户卡在选型。

### Alternatives Considered

- **Mermaid 流程图**:渲染依赖,邮件 / RSS 阅读器不显示。
- **决策树文字段落**:扫读慢,易遗漏分支。
- **AI 助手交互式问答**:YAGNI。

---

## Q8: 环境变量文档来源 — 手写 vs 自动生成

### Decision

**手写,但对照 `src/lib/env.ts` zod schema 校验**。SC-008 已要求 env 变量数对齐。

```bash
# 实施时校验脚本 (临时):
grep -oE '"[A-Z_]+":\s*z\.' src/lib/env.ts | sort -u
# 输出对照 docs/configuration.md 列表
```

### Rationale

- 手写允许加"修改后是否需重启"等人话描述,zod schema 无法自动派生。
- zod 自动生成 (ts-doc / zod-to-md) 引入新工具链,违反 YAGNI。
- 校验用 grep + 人工对照即可,SC-008 是 acceptance criteria。

### Alternatives Considered

- **zod-to-markdown**:增加构建步骤,且输出格式僵硬。
- **interface 文档生成 (typedoc)**:过度工程。
- **完全不校验**:违反 SC-008,环境变量漂移风险。

---

## Q9: 文档总字数控制 (SC-004 ≤ 6000 字)

### Decision

**每份文档预算**:

| 文档 | 预算 (字) | 主要内容 |
|---|---|---|
| getting-started.md | 1200 | 7 章节,每章 100-200 字 |
| deployment.md | 1500 | 决策树 + 3 模式各 400 字 |
| operations.md | 1200 | 6 章节,每章 200 字 |
| troubleshooting.md | 1200 | 4 栏表格 15+ 行 |
| configuration.md | 600 | env 变量表格 |
| architecture.md | 300 | 分层图 + 目录表 |
| **合计** | **6000** | — |

### Rationale

- 字数硬上限倒逼精炼,避免冗长。
- 每份文档单一职责,易维持预算。
- 实施时若超出,优先砍冗余示例 (留 1 个最具代表性)。

### Alternatives Considered

- **不限字数**:违反 SC-004,且长文档阅读完成率低。
- **每份独立字数限制**:已通过预算表实现。

---

## Q10: 与既有 docs/ 文档的关系

### Decision

**架构导览引用,不复制**。`docs/architecture.md` 在头部加"延伸阅读"列表,链到既有 6 份:

```markdown
## 延伸阅读

- [AGENTS.md](AGENTS.md) — 开发原则与技术栈
- [DOMAIN.md](DOMAIN.md) — 领域模型详解
- [DATABASE.md](DATABASE.md) — 数据库 schema
- [MVP.md](MVP.md) — MVP 范围契约
- [PRD.md](PRD.md) — 产品需求文档
- [ROADMAP.md](ROADMAP.md) — V2+ 路线图
```

### Rationale

- 既有 6 份是给开发者的产品/架构规约,本 feature 6 份是面向用户角色的操作指南,职责互补。
- 不修改既有 6 份 (Assumptions 已声明),只引用。
- architecture.md 是"快速理解全局",既有文档是"深入某层"。

### Alternatives Considered

- **重写 AGENTS.md**:违反 Assumptions,且与 constitution 冲突。
- **复制 DOMAIN.md 关键点到 architecture.md**:违反 DRY (SC-007)。

---

## 总结

10 项 NEEDS CLARIFICATION 全部解决。Phase 1 设计基于以下原则:

1. **DRY**:每事实单一主源,其他文档相对路径引用。
2. **手写 TOC**:GitHub 自动锚点,无构建依赖。
3. **角色矩阵**:README 顶部 4 行表格,角色 → 入口文档 → 你将学会。
4. **决策树**:deployment.md 头部 4 问表格,推荐唯一模式。
5. **故障排查**:4 栏表格 (症状 / 原因 / 修复 / 验证),≥ 15 行。
6. **配置参考**:手写但对照 env.ts 校验,SC-008 强制对齐。
7. **字数控制**:每份文档预算,合计 ≤ 6000 字。
8. **架构导览引用**:不复制既有 docs/ 内容。
