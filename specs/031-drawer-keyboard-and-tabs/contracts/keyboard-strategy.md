# UI Contract: 记一笔 Drawer 键盘避让策略

**Branch**: `031-drawer-keyboard-and-tabs` | **Date**: 2026-07-18
**Spec**: [spec.md](../spec.md) | **Research**: [research.md](../research.md) R1–R4

本文件是"记一笔"底部 Drawer 键盘交互的**唯一行为契约**。tasks.md 的实现任务 MUST 遵守
此契约;代码审查 MUST 据此核对。

## C1. 唯一键盘避让机制

| 项 | 契约 |
|---|---|
| 真相源 | `Drawer.Content`(或 `Drawer.Dialog`)可视高度受 `useVisualViewport().height` 钳制 |
| 实现 | inline style `maxHeight: <vv.height>px`(或 `height`,实测择优) + `transition: max-height 200ms ease-out` |
| 桌面端 | `vv.height === window.innerHeight`,钳制等价不钳制(identity) |
| **禁止** | 任何 `paddingBottom: keyboardHeight`、`transform: translateY(-keyboardHeight)` 等位移/补白补偿 |

满足: spec FR-001(单一机制)、FR-003(无空隙不透出)。

## C2. scroll 作用域

| 项 | 契约 |
|---|---|
| scroll 容器 | 仅 `Drawer.Body`(HeroUI native scrolling) |
| 触发 | `focusin` 事件(事件委托,挂 form 根) |
| 动作 | 计算 `target` 相对 `Drawer.Body` 的位置,调整 `bodyRef.scrollTop`;**禁止**调用 `target.scrollIntoView` |
| 去抖 | 新 `focusin` cancel 上一个 pending `requestAnimationFrame` |
| 时序 | 仅 `requestAnimationFrame`(等 React 渲染);**移除** 029 的 300ms `setTimeout` |

满足: spec FR-002(只滚 Body)、FR-007(去抖)。

## C3. 提交按钮位置

| 项 | 契约 |
|---|---|
| 位置 | `Drawer.Footer`(Body 之外,不可滚动) |
| 触达 | 键盘弹出时始终可见可达,无需先收键盘 |
| **禁止** | submit 放在 `Drawer.Body` 内、或在 submit 后用 padding 垫高 |

### 组件接口变化(唯一的 props 重构)

`TransactionForm` 的 `embedded` 模式需把 `submit` 按钮从内部 JSX 提升为对外暴露。两种可接受
方式(tasks.md 择一):

- **方式 A(render prop)**:`<TransactionForm embedded renderFooter={() => <submit/>} />`,
  `TransactionDrawer` 把 `renderFooter()` 放进 `Drawer.Footer`。
- **方式 B(children 分离)**:`TransactionForm` 的 embedded 分支不渲染 submit,由
  `TransactionDrawer` 直接在 `Drawer.Footer` 内渲染一个绑定同一 form(`form` attribute)的
  submit button。

非 embedded 模式(全屏 page)不受影响,沿用既有 `Card.Footer`。

满足: spec FR-005。

## C4. 类型 Tabs

| 项 | 契约 |
|---|---|
| 结构 | `<Tabs><Tabs.List><Tabs.Tab>{label}<Tabs.Indicator/></Tabs.Tab>…`(v3 compound,不变) |
| 密度 | `Tabs.List` 加 `*:h-8 *:px-3 *:text-sm`(或更紧,实测择优),首屏多露 ≥1 字段 |
| 颜色 | 支出 `--danger` / 收入 `--success` / 转账 `--accent`(docs/THEME.md 真相源,不变) |
| 语义 | 三类型切换 + 字段联动不变(转账显转入账户、隐藏分类) |
| 键盘可见性 | 键盘弹起时 Tabs 行留在 Drawer 可视区;若实测被滚出,提到 Body 外 sticky 区 |

满足: spec FR-008、FR-009、FR-010。

## C5. 桌面端回归

| 项 | 契约 |
|---|---|
| `useVisualViewport` | 桌面 `vv.height === innerHeight`,所有钳制/scroll 等价 identity |
| 全屏 page 模式 | 非 embedded 分支不受本 feature 影响,既有 `Card.Footer` 行为不变 |
| 回归标准 | 桌面端交易表单 0 新增缺陷(spec SC-004) |

满足: spec FR-011、SC-004。

## C6. HeroUI v3 合规(宪章原则七)

- 所有 Drawer/Tabs 改动**已先查** `/heroui-react` skill(research.md R2/R5/R6)。
- 不替换 HeroUI 组件、不引入新 UI 库、不回退 shadcn/cva/`class-variance-authority`。
- className 命中正确 slot(`Tabs.List`/`Tabs.Tab` 控密度,`Drawer.Content`/`Drawer.Dialog`
  控高度,`Drawer.Footer` 装 submit)。
- 颜色用 HeroUI 原生 token(`text-danger`/`text-success`/`text-accent` 或对应 CSS 变量),
  不用 shadcn legacy 命名。

满足: spec FR-010、SC-005。
