# Visual & Behavioral Equivalence Contract: 029 移动端键盘弹起布局稳定性

**Branch**: `029-mobile-keyboard-layout` | **Date**: 2026-07-17 | **Spec**: [spec.md](../spec.md)

本契约定义"修复前 vs 修复后"用户可感知的视觉与行为等价 / 差异边界。所有 P1/P2 入口必须 100% 满足;P3 入口与 P1/P2 等价达标(spec clarification Q1,2026-07-17)。

---

## §1. 视觉等价 invariant(必须保持)

| 维度 | 修复前 | 修复后 | 验证方式 |
|---|---|---|---|
| HeroUI token 配色 | `--accent` / `--danger` / `--success` / `--background` 等 | **不变** | grep `text-muted-foreground` 全局 0 命中(宪章原则七) |
| HeroUI 组件用 API | `Drawer placement="bottom"` + `Drawer.Handle` + `Drawer.Header` + `Drawer.Body` | **不变**(只在外层加 className/style + onFocus handler) | codegraph 反向查询 HeroUI 组件 import |
| 字段顺序 | 金额 → 账户 → [转账账户] → 分类 → 备注 → 日期 | **不变** | 截图对照 |
| 标题与图标 | "记一笔" / ChevronLeft / Drawer.Handle | **不变** | 截图对照 |
| 桌面端布局 | Card + Header + Content + Footer | **不变** | 桌面 Chrome 截图对照 |

---

## §2. 行为等价 invariant(必须保持)

| 行为 | 修复前 | 修复后 | 验证 |
|---|---|---|---|
| Drawer 打开/关闭动画 | HeroUI 默认 CSS transition | **不变** | 视觉观察 |
| 提交流程 | optimistic toast → mutation → invalidate → navigate / close drawer | **不变** | 手测一笔 |
| 表单校验 | zodResolver + HeroUI `isInvalid` | **不变** | 手测错误路径 |
| 中键新标签打开链接 | `<Link>` 默认行为 | **不变** | 桌面 Chrome 中键点击 |
| 物理键盘 Tab 导航 | React Aria focus trap + 默认 Tab 顺序 | **不变**(只叠加,不替换) | 桌面 Chrome Tab 键走查 |
| ESC 关闭 Drawer | HeroUI 默认(`isKeyboardDismissDisabled=false`) | **不变** | 桌面 ESC 测试 |

---

## §3. 必须改变的行为(修复目标)

| 行为 | 修复前 | 修复后 | spec FR/SC 引用 |
|---|---|---|---|
| 聚焦字段在键盘弹起后是否可见 | 经常被遮挡 | **300ms 内自动滚入可视区域中心** | FR-001 / SC-001 |
| 保存按钮在键盘弹起时是否可达 | 经常被遮挡 | **始终在键盘上方 16px,可直接 tap** | FR-002 / SC-002 |
| 键盘弹起/收起瞬间布局 | 经常闪烁/跳变 | **200ms ease 过渡,CLS ≤ 0.05** | FR-003 / SC-003 |
| 表单顶部标题在键盘弹起时 | 经常被推出视口 | **保持可见**(Drawer.Header sticky) | FR-004 |
| 跨浏览器行为 | iOS Safari 与 Android Chrome 差异显著 | **行为一致**(都基于 `visualViewport`) | FR-005 |

---

## §4. 允许的视觉差异(不算违反 invariant)

| 场景 | 允许的差异 |
|---|---|
| 键盘弹起瞬间 | Drawer.Body 底部 paddingBottom 从 0 → `keyboardHeight` 平滑过渡(200ms) |
| 键盘收起瞬间 | Drawer.Footer 从 `bottom: keyboardHeight` → `bottom: 0` 平滑过渡(200ms) |
| 聚焦备注字段 | 该字段 smooth scroll 到 Drawer.Body 可视中心(`block: "center"`) |
| 中端 Android 设备帧率 | 过渡期间 FPS 允许 60 → 55 短暂下降,过渡结束恢复 60 |

---

## §5. 不允许的差异(回归即视为违反)

| 场景 | 不允许的差异 |
|---|---|
| 字段配色 / 字号 / 字重 | 任何修改 |
| HeroUI 组件替换 | 用原生 HTML 表单元素替换 HeroUI(违反宪章原则七) |
| 桌面端表单交互 | 任何修改(物理键盘、Tab 顺序、auto-complete) |
| 数据提交 payload | 任何修改(zod schema 不变,tRPC procedure 不变) |
| Drawer 关闭手势 | 下滑关闭(`Drawer.Handle`)仍可用 |

---

## §6. 验证流程

### §6.1 视觉对照(每 PR 必跑)
1. 在 Chrome DevTools Mobile Emulation(iPhone 12 + Mid-Tier Mobile + Slow 3G)截:
   - `/dashboard`(关闭 Drawer 状态)
   - 打开 Drawer 后未聚焦任何字段
   - 聚焦金额字段(键盘弹起)
   - 聚焦备注字段(键盘弹起)
   - 收起键盘
2. 与 `specs/025-perf-code-optimization/baseline.md` 中的 baseline 截图对照(只允许 §4 列出的差异)。

### §6.2 真机测试(initiative 收尾必跑)
| 设备 | 浏览器 | 必跑流程 |
|---|---|---|
| iPhone 12 / 13 | Safari | US1.1 – US1.5 全部 acceptance scenario |
| Redmi Note 12 / Samsung A 系列 | Chrome | 同上 |
| 桌面笔记本 | Chrome | 回归测试:全部表单交互 0 退化 |

### §6.3 Lighthouse 测量
- `performance_start_trace` 在 `/dashboard` 上跑 3 次,取中位数;
- 关键指标:**CLS ≤ 0.05**(SC-003)、LCP、INP。

---

## §7. 与 025 `contracts/visual-equivalence.md` 的关系

025 已建立的视觉等价 invariant(token、HeroUI API、配色)**继续适用**。本契约在 025 之上**只新增键盘交互相关的等价规则**,不与 025 冲突。
