# Implementation Plan: 014-ops-docs (运维文档)

**Branch**: `014-ops-docs` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-ops-docs/spec.md`

## Summary

为 BALTHASAR 提供**统一、可导航、面向用户角色**的文档体系。**零代码变更**,只新增 6 份 markdown 文档 + 修改 README 顶部加"按角色入口"矩阵。

核心交付:
- `docs/getting-started.md` — 新开发者启动指南 (~1200 字)
- `docs/deployment.md` — 部署指南,3 模式决策树 (~1500 字)
- `docs/operations.md` — 运维手册 (升级/备份/恢复/配置变更) (~1200 字)
- `docs/troubleshooting.md` — 故障排查,4 栏表格 ≥ 15 行 (~1200 字)
- `docs/configuration.md` — 环境变量参考,对照 `src/lib/env.ts` (~600 字)
- `docs/architecture.md` — 架构导览,链既有 docs/ (~300 字)
- `README.md` 顶部加 4 行表格 (4 角色 → 6 文档)

技术决策详见 [research.md](./research.md),数据/契约详见 [data-model.md](./data-model.md) + [contracts/README.md](./contracts/README.md)。

## Technical Context

**Language/Version**: Markdown (GitHub Flavored),中文

**Primary Dependencies**:
- 既有: GitHub Markdown 渲染 (无构建依赖)
- 新增: 无

**Storage**:
- 文件系统: 仓库内 `docs/` 目录
- 无数据库 / 无运行时状态

**Testing**:
- 字数检查: `wc -w`
- TOC 锚点: 人工点击 / GitHub 预览
- DRY 检查: `grep -r` 关键命令
- env 对齐: `diff <(grep src) <(grep docs)`

**Target Platform**:
- GitHub Markdown 渲染 (主要)
- VSCode Markdown preview (次要)
- 邮件 / RSS 阅读器 (兜底,放弃 Mermaid 等渲染依赖)

**Project Type**: documentation (无代码)

**Performance Goals** (来自 spec SC):
- 6 份文档总字数 ≤ 6000 (SC-004)
- troubleshooting ≥ 15 症状 (SC-005)
- 配置变量数 = env.ts 变量数 (SC-008)

**Constraints**:
- 不引入 Docusaurus / MkDocs 等静态站点生成器
- 不引入截图 / 视频
- 不修改既有 `docs/AGENTS.md` / `DOMAIN.md` / `DATABASE.md` / `MVP.md` / `PRD.md` / `ROADMAP.md`
- 不引入 pre-commit hook / CI 校验脚本 (YAGNI)

**Scale/Scope**:
- 6 份新文档 + 1 份 README 修改
- 总字数预算 6000 (软上限 7600)
- 覆盖 3 个用户角色 + 排障

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

宪章 v2.0.0 六大原则逐条检查:

### 一、MVP Scope ✓ PASS

本 feature 不引入新业务功能 (转账/预算/AI/OCR 等均在 MVP 外)。文档服务于既有 MVP 功能,符合"每天真在用、10 秒完成的家庭记账"的产品假设 (降低上手门槛 = 提高使用率)。

### 二、Feature-Sliced Architecture ✓ PASS

- 不新增代码,不涉及 feature slice 边界
- 文档按"用户角色"切片,与代码 feature 切片互补,不冲突
- `docs/` 目录是仓库级共享资源 (与 `specs/` 平级),不归属任何业务 feature

### 三、领域驱动设计 ✓ PASS

- 零聚合变更,零新表
- 不影响 `Family` 聚合根
- architecture.md 引用 `docs/DOMAIN.md` (现有 DDD 文档),不复制

### 四、测试优先 ✓ N/A (文档无测试)

- 文档不能用 Vitest 测试
- 但 SC-001 ~ SC-010 是可量化验收标准,等价于"测试"
- 实施任务 T018 跑 quickstart.md 4 场景验证

### 五、性能与极速录入 ✓ PASS

- 文档不影响运行时性能
- troubleshooting.md 帮助运维者快速定位性能问题 (容器 OOM / 日志爆盘 / PG 慢查询)
- 字数控制 (SC-004) 倒逼精炼,符合"10 秒记账"精神 (读者 10 秒内找到答案)

### 六、简单 (YAGNI) ✓ PASS

- 不引入 Docusaurus / MkDocs / Doctoc / 等工具链
- 不写 PDF / EPUB 导出
- 不引入截图 (会过期 + 仓库膨胀)
- 不写视频教程 (V2 范围)
- 不引入 INDEX.md (README 顶部矩阵即是入口)
- 不引入 pre-commit hook 校验 TOC (手写 + 人工 review)
- 不重写既有 6 份 `docs/` 文档 (只引用)

**Constitution Check 结论**: 6/6 全部 PASS (原则四 N/A),**无 Complexity Tracking 违规**。

## Project Structure

### Documentation (this feature)

```text
specs/014-ops-docs/
├── plan.md              # 本文件
├── spec.md              # /speckit-specify 产物
├── checklists/
│   └── requirements.md  # /speckit-specify 产物 (12/12 通过)
├── research.md          # Phase 0: 10 项设计决策
├── data-model.md        # Phase 1: 文档结构 + 元数据 schema + 引用图
├── contracts/
│   └── README.md        # Phase 1: 读者/维护者/代码/演化 4 类契约
├── quickstart.md        # Phase 1: 4 验证场景 (开发者/运维/排障/质量交叉)
└── tasks.md             # Phase 2 (/speckit-tasks 待生成)
```

### Source Code (repository root)

```text
.
├── README.md                            # 修改:顶部加"按角色入口"4 行表格
└── docs/                                # 新增 6 份 + 保留 6 份既有
    ├── getting-started.md               # 新增
    ├── deployment.md                    # 新增
    ├── operations.md                    # 新增
    ├── troubleshooting.md               # 新增
    ├── configuration.md                 # 新增
    ├── architecture.md                  # 新增
    │
    ├── AGENTS.md                        # 保留 (被 architecture.md 引用)
    ├── DATABASE.md                      # 保留
    ├── DOMAIN.md                        # 保留
    ├── MVP.md                           # 保留
    ├── PRD.md                           # 保留
    └── ROADMAP.md                       # 保留
```

**Structure Decision**: 文档集中在 `docs/`,与既有 6 份规约文档共存。`README.md` 顶部矩阵作为统一入口,链到 6 份新文档。零代码改动 (无 `src/` 变更)。

## Complexity Tracking

> 无 Constitution Check 违规,本表为空。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (无) | — | — |

## 实施前检查清单

进入 `/speckit-tasks` 前,确认以下产物就绪:

- [x] spec.md (12/12 checklist 通过,0 clarification)
- [x] research.md (10 项设计决策解决)
- [x] data-model.md (文档结构 + 元数据 + 引用图 + env 校验)
- [x] contracts/README.md (4 类契约:读者/维护者/代码/演化)
- [x] quickstart.md (4 验证场景 + 11 项 SC 验收清单)
- [ ] tasks.md (待 `/speckit-tasks` 生成)

**下一步**: 执行 `/speckit-tasks` 生成任务清单。
