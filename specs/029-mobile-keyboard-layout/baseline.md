# Baseline: 029 移动端键盘弹起布局稳定性

**Branch**: `029-mobile-keyboard-layout` | **Created**: 2026-07-17

本文件归档"修复前"测量数据,作为后续 PR-after 区块的对比基准。对齐 `specs/025-perf-code-optimization/baseline.md` 的模式:机械化测量 + NEEDS-MANUAL(GUI/真机)分项。

## 环境

| 项 | 值 |
|---|---|
| 设备(NEEDS-MANUAL) | iPhone 12 / 13 + Redmi Note 12 / Samsung A 系列 |
| 浏览器 | iOS Safari 16+ / Android Chrome 最新两版本 |
| DevTools 模拟 | iPhone 12 Pro + Mid-Tier Mobile(CPU 4× slowdown + Slow 3G) |
| 测量日期(NEEDS-MANUAL) | [待填写] |
| Node | 22.x LTS |
| pnpm | v10+ |

## Baseline(修复前,PR-1 之前)

### JS Bundle(gzipped,首次加载)

| 路由 | first-load JS | 备注 |
|---|---|---|
| `/` | [NEEDS-MANUAL: ANALYZE=true pnpm build 后读 .next/analyze/client.html] | 修复后不应显著增加(无新依赖) |
| `/transactions` | [NEEDS-MANUAL] | 同上 |
| `/transaction/new` | [NEEDS-MANUAL] | 同上 |

### Lighthouse 指标(Mid-Tier Mobile,3 次中位数)

| 路由 | LCP | TTI | INP | CLS | 备注 |
|---|---|---|---|---|---|
| `/` | [NEEDS-MANUAL]s | [NEEDS-MANUAL]s | [NEEDS-MANUAL]ms | [NEEDS-MANUAL] | SC-003 要求 after CLS ≤ 0.05 |
| `/transactions` | [NEEDS-MANUAL]s | [NEEDS-MANUAL]s | [NEEDS-MANUAL]ms | [NEEDS-MANUAL] | 同上 |
| `/transaction/new` | [NEEDS-MANUAL]s | [NEEDS-MANUAL]s | [NEEDS-MANUAL]ms | [NEEDS-MANUAL] | 同上 |

### 键盘交互基线(NEEDS-MANUAL — 真机/DevTools GUI)

走查步骤(对应 quickstart.md §3.1.1 – §3.1.4):

1. **打开 Drawer**(FAB 点击)— 是否平滑滑出
2. **聚焦金额字段**(autoFocus)— 键盘弹起后金额输入框是否完整可见
3. **切换到备注字段**(TextArea tap)— 备注是否自动滚入可视区域
4. **切换到日期字段**(DatePicker tap)— 日历 Popover 是否在键盘上方展开
5. **点击保存按钮**(键盘弹起状态)— 是否需要先收键盘
6. **收起键盘** — 布局是否回弹

**修复前观察(NEEDS-MANUAL)**:
- [NEEDS-MANUAL: 各步骤实际表现描述,例如"步骤2金额输入框被键盘遮挡 50%"、"步骤5保存按钮完全被键盘挡住,需收键盘才能点"]

### 端到端耗时(SC-006 分母)

| 流程 | 中位耗时 | 备注 |
|---|---|---|
| iPhone 12 Safari: 打开应用 → 进入记一笔 → 输入完整一笔 → 保存 | [NEEDS-MANUAL]ms | SC-006 要求 after ≤ baseline |

### 测试基线(SC-010 分母)

| 命令 | 通过数 |
|---|---|
| `pnpm test:unit run` | [NEEDS-MANUAL: 数字]/[NEEDS-MANUAL: 总数] |
| `pnpm type-check` | [NEEDS-MANUAL: 0 errors 预期] |
| `pnpm lint` | [NEEDS-MANUAL: 0 errors 预期] |
| `pnpm build` | [NEEDS-MANUAL: success 预期] |

---

## After(PR-by-PR 增量)

> 每个 PR 合并后,在本节追加一行记录"该 PR 后"的测量值。格式对齐 025 baseline.md。

| PR | 标题 | 测试路由 | CLS | LCP | 端到端耗时 | 测试通过 | FR/SC 验证 |
|----|------|---------|-----|-----|-----------|---------|-----------|
| PR-1 | `feat(mobile): useVisualViewport + useScrollIntoViewOnFocus hooks` | n/a(基础设施) | n/a | n/a | n/a | [NEEDS-MANUAL] | 无可观察行为变化(纯基础设施) |

---

## NEEDS-MANUAL 说明

下列测量只能通过 Chrome DevTools GUI / 真机完成,无法 CI 自动化(对齐 025 模式):

- JS Bundle 体积(需 `ANALYZE=true pnpm build` 后读 `.next/analyze/client.html`)
- Lighthouse Mobile 三路由 LCP/TTI/INP/CLS 中位数
- 键盘交互走查(只能在真机或 DevTools Device Emulation 下手测)
- 端到端耗时秒表(真机 + 人工启停)

PR 描述必须列出"已自动化 vs NEEDS-MANUAL"清单。reviewer 按 `quickstart.md` 执行 NEEDS-MANUAL 步骤,结果回填到本文件。

参考 025 reviewer runbook 模式:`specs/025-perf-code-optimization/REVIEWER-RUNBOOK.md`。
