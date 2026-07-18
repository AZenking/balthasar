# Baseline: 031 记一笔 Drawer 键盘避让收敛 + 类型 Tabs 优化

**Branch**: `031-drawer-keyboard-and-tabs` | **Created**: 2026-07-18

本文件归档"修复前/后"测量数据,作为 PR 对照基准。对齐 `specs/029-mobile-keyboard-layout/baseline.md`
模式:机械化测量 + NEEDS-MANUAL(GUI/真机)分项。

## 环境

| 项 | 值 |
|---|---|
| 设备(NEEDS-MANUAL) | iPhone(Safari + PWA standalone)+ 中端 Android(Redmi Note / Samsung A 系列,Chrome) |
| DevTools 模拟 | iPhone 12 Pro + Mid-Tier Mobile(CPU 4× slowdown) |
| Node | 22.x LTS |
| pnpm | v11.9.0 |
| HeroUI | `@heroui/react` / `@heroui/styles` v3.2.2 |
| 测量日期(NEEDS-MANUAL) | [待填写] |

## Baseline 修复前(BEFORE,PR-1 之前)

### 自动化测试基线(机械化)

| 项 | 值 | 备注 |
|---|---|---|
| `pnpm test:unit`(unit + ui) | **42 文件 / 305 测试 全绿** | T001 已验证。本 feature 改动后 MUST 不打破既有测试。 |
| `pnpm build` | [NEEDS-MANUAL:提交前跑一次确认 TS strict 通过] | — |

### 键盘交互基线(NEEDS-MANUAL — 真机/DevTools GUI)

**修复前症状(用户截图 + 诊断,R1 已确认根因)**:

走查步骤(对应 quickstart.md §3.1.1 – §3.1.6):

1. **打开 Drawer**(首页 FAB 点击)
   - [NEEDS-MANUAL:截图 1 — 键盘未弹起时 Drawer 正常态]
2. **聚焦金额输入框** → 键盘弹起
   - [NEEDS-MANUAL:截图 2 — 预期症状:Drawer 被上移,底部与键盘间出现空隙,设置页从空隙透出]
   - 症状描述:029 的两套键盘补偿(全局 `scrollIntoView` + 表单 `paddingBottom: keyboardHeight`)在 iOS Safari/PWA 叠加,固定定位的 Drawer 被带着上移。
3. **切换到备注字段**
   - [NEEDS-MANUAL:截图 3 — 预期症状:全局 scrollIntoView 滚动整个文档/Visual Viewport,加剧 Drawer 位移]
4. **收起键盘**
   - [NEEDS-MANUAL:截图 4 — 预期症状:回弹过程可能有抖动/跳变]
5. **类型 Tabs 首屏密度**
   - [NEEDS-MANUAL:截图 5 — Tabs 默认高度,首屏可见字段数 N_before]
6. **CLS 测量**
   - [NEEDS-MANUAL:Lighthouse `/dashboard` CLS = ?,`/transaction/new` CLS = ?]

### JS Bundle(gzipped,首次加载)

| 路由 | first-load JS | 备注 |
|---|---|---|
| `/` | [NEEDS-MANUAL:ANALYZE=true pnpm build 后读 .next/analyze/client.html] | 本 feature 不增依赖,bundle 不应显著变化 |
| `/transactions` | [NEEDS-MANUAL] | 同上 |
| `/transaction/new` | [NEEDS-MANUAL] | 同上 |

## 修复后(AFTER,PR-1 / PR-2 完成后回填)

> 本区块在 US1(T018)/US2(T025)/Polish(T030/T031)走查完成后回填,与 BEFORE 对照。

### 键盘交互(US1 — Drawer 不透出背景)

| 步骤 | BEFORE 症状 | AFTER 结果 | 平台 |
|---|---|---|---|
| 聚焦金额 → 键盘弹起 | Drawer 上移、空隙、设置页透出 | [NEEDS-MANUAL:截图,目标:Drawer 紧贴键盘、无空隙、背景不透出] | iPhone Safari / PWA / Android |
| 切换备注字段 | 全局 scroll 滚 fixed 容器 | [NEEDS-MANUAL:目标:只 Drawer.Body 内部滚动] | 同上 |
| 收起键盘 | 可能抖动 | [NEEDS-MANUAL:目标:平滑回弹,CLS ≤ 0.05] | 同上 |

### Tabs 密度(US2)

| 项 | BEFORE | AFTER | 目标 |
|---|---|---|---|
| 首屏可见字段数 | N_before = [NEEDS-MANUAL] | N_after = [NEEDS-MANUAL] | N_after ≥ N_before + 1(SC-003) |
| Tabs 收紧 className | (默认高度) | [T022 择优值] | — |

### CLS 机械测量(SC-002)

| 路由 | BEFORE CLS | AFTER CLS | 目标 |
|---|---|---|---|
| `/dashboard` | [NEEDS-MANUAL] | [NEEDS-MANUAL] | ≤ 0.05 |
| `/transaction/new` | [NEEDS-MANUAL] | [NEEDS-MANUAL] | ≤ 0.05 |

### 自动化测试回归

| 项 | BEFORE | AFTER | 目标 |
|---|---|---|---|
| `pnpm test:unit` | 305 passed | [T027 回填] | 全绿(本 feature 新增测试 + 既有 305 不破) |
| `pnpm build` | [NEEDS-MANUAL] | [T028 回填] | TS strict 通过 |

### 桌面端回归(SC-004)

- [NEEDS-MANUAL:T026 桌面走查,目标:与修复前无差异、0 新增缺陷]
