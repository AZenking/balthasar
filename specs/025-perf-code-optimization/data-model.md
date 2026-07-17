# Data Model: 性能与代码优化 (React Best Practices 对齐)

**Branch**: `025-perf-code-optimization` | **Date**: 2026-07-16
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

> Phase 1 输出。本 initiative **不引入新数据库实体、不修改 schema、
> 不生成 Drizzle migration**。本文件仅记录"非功能性"概念模型,作为
> tasks 阶段的语义对齐基础。

## 1. 数据库实体

**无新增,无修改**。所有现有 schema(`Family` / `Member` / `Account` /
`Category` / `Transaction` / `Budget` / Better-Auth `user` / `session` /
`verification` / `account`)保持原状。tRPC procedure 输入/输出契约保持
原状(由 TS 编译器自动派生)。

## 2. 非功能性"实体"

本 initiative 引入的"实体"是 **产物文件 + 概念对象**,不入数据库,
仅用于工程治理。

### 2.1 Performance Baseline

**定义**: 优化前(本 initiative PR-1 之前)各核心页面关键性能指标的
快照。一旦写入 `baseline.md`,在本 initiative 周期内**不可变**;
后续 PR 的 "after" 数字与该 baseline 对照计算改善比例。

**字段**(对应 `baseline.md` 表格列):
- `metric`: 指标名(LCP / TTI / FID / CLS / JS-gzipped / FPS)
- `value`: 数值(秒 / 毫秒 / KB / FPS)
- `route`: 测量路由(`/`、`/transactions`、`/transaction/new`)
- `measurement_method`: 工具 + 配置(`Lighthouse Mobile/Slow 3G`、
  `@next/bundle-analyzer`、`DevTools Performance`)
- `measurement_date`: ISO-8601 日期
- `run_count`: 取中位数的跑测次数(默认 3)

**状态转换**: 无 —— baseline 是不可变快照。

### 2.2 Code Review Checklist Item

**定义**: 从 Vercel React Best Practices skill 派生的审查清单中的
单项检查(见 research.md R1,17 项)。

**字段**:
- `id`: A1 / A2 / ... / E2
- `category`: A-E 五组之一(Server/Client 边界、Hooks、Suspense、
  Code-splitting、Next.js 范式)
- `rule`: 检查规则描述(如"无 hooks 的组件不应标 use client")
- `applies_to_feature`: Dashboard / 流水 / 新增交易 / 全部
- `pass_status`(审查时填): `pass` / `fail` / `n/a`

### 2.3 Anti-Pattern Instance

**定义**: 在本仓库代码中识别到的、违反 Vercel React Best Practices
审查项的具体代码实例。

**字段**:
- `id`: AP-01、AP-02、...
- `file_path`: 代码位置(`src/components/transactions/transaction-list-item.tsx`)
- `line_range`: 行号范围
- `violated_checklist_id`: 对应 R1 审查项(如 `A1`)
- `description`: 反模式描述
- `fix_strategy`: 修复方案(`删除 "use client"`、`改用 <Link>`、...)
- `before_code`: 修复前代码片段
- `after_code`: 修复后代码片段
- `impact`: 高 / 中 / 低(对 SC-004 JS 减少的预期贡献)
- `status`: `identified` → `fixed` → `verified`

**状态转换**:
```text
identified ──(PR 提出)──> fixed ──(SC-009/010 通过)──> verified
```

### 2.4 PR Increment Record

**定义**: 单个 PR 合并后,`baseline.md` 中新增的"after"快照行,
附改善百分比与对应 SC 编号。

**字段**:
- `pr_number`: GitHub PR 编号
- `pr_type`: `tooling` / `feature-slice-vertical` / `cross-cutting`
- `affected_feature`: Dashboard / 流水 / 新增交易 / 全局
- `metrics_after`: 各指标 after 数值
- `delta_vs_baseline`: 较 baseline 的百分比变化
- `sc_verification`: 该 PR 达成/推进的 SC 编号列表

## 3. 关系图

```text
Performance Baseline (1)
        │
        │ compared against
        ▼
PR Increment Record (N) ──── fixes ────> Anti-Pattern Instance (N)
        │                                      │
        │                                      │ violates
        │                                      ▼
        │                              Code Review Checklist Item (17)
        │                                      │
        │                                      │ derived from
        │                                      ▼
        │                              Vercel React Best Practices skill
        │
        │ tracked in
        ▼
baseline.md (artifact file)
anti-patterns.md (artifact file)
```

## 4. 校验规则

- **Baseline 不变性**: `baseline.md` 的 "Baseline" 区块在本 initiative
  PR-1 合并后冻结;任何后续 PR 修改该区块 = 违反 spec FR-010
- **Anti-pattern 完整性**: 每个 `verified` 状态的 AP 必须有
  `before_code` + `after_code` + 对应 PR 链接
- **SC 追溯**: 每个 SC-001 ~ SC-010 必须可追溯至 baseline.md 中的
  具体数值行或 anti-patterns.md 中的具体 AP 条目

## 5. 不在本次范围

- 任何数据库 schema 变更(零 migration)
- 任何 tRPC procedure 输入/输出契约变更
- 任何 Better-Auth 表结构变更
- 任何 domain 纯函数签名变更
- 任何新的状态机或聚合根

宪章原则三(DDD)与原则二(Feature-Sliced)零回归。
