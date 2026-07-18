# Data Model: 031 记一笔 Drawer 键盘避让收敛 + 类型 Tabs 优化

**Branch**: `031-drawer-keyboard-and-tabs` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

## 持久化实体

**无。** 本 feature 是纯前端 UI 行为收敛,不触及:
- 数据库 schema(`src/server/db/schema/*`)—— 无新增/修改表
- tRPC procedure(`src/server/api/routers/*`)—— 无新增/修改路由
- 领域函数(`src/server/domain/*`)—— 无业务规则变更
- Drizzle migration —— 无

依据宪章原则三(领域驱动)与本 feature spec Clarifications Q1 范围限定,领域层完全不受影响。

## 行为实体(非持久化)

本 feature 涉及的是**运行时行为契约**,不是数据实体。记录于此供 tasks.md 与 contracts/
引用:

### BE-1: Drawer 键盘避让策略(单一机制)

- **职责**:决定"记一笔"底部 Drawer 在虚拟键盘弹出/收起时的可见高度与位置。
- **唯一规则**(收敛后):`Drawer.Content` 可视高度 = `visualViewport.height`(`useVisualViewport`
  读取),键盘弹起时 Drawer 自然变矮并紧贴键盘上方。
- **禁止项**(本 feature 移除):
  - 全局 `element.scrollIntoView`(改 R3 的 Body 内部 scroll);
  - 表单 wrapper 的 `paddingBottom: keyboardHeight`(改 R4 的 Footer 装载 submit)。
- **状态**:无内部状态,纯派生自 `useVisualViewport`。

### BE-2: Drawer.Body 内部滚动

- **职责**:输入框 focus 时,只调整 `Drawer.Body` 自身的 `scrollTop`,把目标字段滚到 Body
  视觉中心。
- **输入**:`focusin` 事件目标 + `Drawer.Body` scroll container ref。
- **输岀**:`bodyRef.scrollTop` 的增量调整(不调用全局 scrollIntoView)。
- **去抖**:新 focusin 取消上一个 pending rAF(spec FR-007)。

### BE-3: 类型 Tabs(支出/收入/转账)

- **职责**:交易类型切换,承载颜色映射(支出红/收入绿/转账蓝)与字段联动。
- **不变量**(本 feature 不改):三类型语义、颜色 token(`--danger`/`--success`/`--accent`)、
  切换后字段联动(转账显示转入账户、隐藏分类)。
- **可变量**(本 feature 调):视觉密度(`Tabs.List`/`Tabs.Tab` 的 className)、键盘弹起时的
  可见位置。

## 关系图(行为层)

```text
TransactionDrawer
  └─ useVisualViewport (029 既有) ──→ vv.height
  └─ Drawer.Content { maxHeight: vv.height }          ← BE-1
       └─ Drawer.Header (记一笔 + 关闭)
       └─ Drawer.Body { ref=scrollRef }                ← BE-2 (scroll 只在此)
            └─ TransactionForm embedded
                 ├─ Tabs (支出/收入/转账)              ← BE-3 (密度收紧)
                 └─ form fields
       └─ Drawer.Footer { submit }                     ← R4 (submit 移入)
```

注:`TransactionForm` 的 `embedded` 分支需把 `submit` 提升为对外暴露(由 `TransactionDrawer`
放进 `Drawer.Footer`),这是唯一的组件接口变化,详见 contracts/keyboard-strategy.md。
