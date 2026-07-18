# Quickstart: 031 记一笔 Drawer 键盘避让收敛 + 类型 Tabs 优化

**Branch**: `031-drawer-keyboard-and-tabs` | **Date**: 2026-07-18
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

本文件是**端到端验证指南**:如何在真机/DevTools 上证明本 feature 的修复有效。
不含实现代码(实现见 tasks.md)。

## 前置

| 项 | 值 |
|---|---|
| Node | 22.x LTS |
| pnpm | v10+ |
| 测试真机(NEEDS-MANUAL) | iPhone(Safari + 添加到主屏幕的 PWA standalone)+ 中端 Android(Chrome) |
| DevTools 模拟 | Chrome DevTools iPhone 12 Pro / Mid-Tier Mobile |
| baseline 对照 | `specs/029-mobile-keyboard-layout/baseline.md`(修复前测量) |

## 1. 启动

```bash
pnpm install
pnpm dev          # 本地起 Next.js dev server
# 手机访问:同局域网 https://<dev-machine-ip>:3000(或用 ngrok / iPhone Safari 远程调试)
```

桌面端回归用普通浏览器直接访问 `http://localhost:3000`。

## 2. 单元/组件测试(自动化)

```bash
pnpm test:unit src/lib/hooks/__tests__/        # useVisualViewport + scroll hook 改造后单测
pnpm test:unit src/components/transaction/     # TransactionDrawer / TransactionForm embedded 交互测
```

**预期**:全绿。重点断言:
- scroll hook 在 focusin 后调整的是传入的 `bodyRef.scrollTop`,**未**调用 `target.scrollIntoView`;
- `useVisualViewport` 桌面端 identity 不变(回归 029 R5)。

## 3. 真机/DevTools 走查(NEEDS-MANUAL)

对照 spec US1 acceptance scenarios 1–6 与 US2 acceptance scenarios 1–4。每步对照**修复前
baseline 截图**(029 baseline.md)与**修复后截图**,二值判定通过/不通过。

### 3.1 US1 — Drawer 键盘不透出背景(P1,核心)

1. 手机访问首页,点底部"记一笔"凸起按钮 → Drawer 从底部滑出。
2. 点金额输入框唤起键盘。
   - **✅ 通过**:Drawer 底边紧贴键盘顶,**无可见空隙**;Drawer 下方背景页(设置等)**完全不透出**。
   - **❌ 失败**(修复前症状):Drawer 被上推,底部与键盘间有空隙,设置页透出。
3. 切换到备注输入框。
   - **✅ 通过**:备注字段滚入 Drawer.Body 可视区,**只有 Body 内部滚动**,Drawer 本体与背景不动。
4. 点"保存"。
   - **✅ 通过**:按钮在 `Drawer.Footer`,键盘弹出状态下直接可点,保存成功后 Drawer 关闭。
5. 收起键盘。
   - **✅ 通过**:Drawer 平滑回弹,无闪烁、无跳变。
6. 切深色/浅色模式,重走 1–5,结论一致。

### 3.2 US2 — 类型 Tabs 收紧 + 键盘可见(P2)

1. 打开 Drawer,依次点支出/收入/转账。
   - **✅ 通过**:选中态平滑切换,颜色支出红/收入绿/转账蓝,字段联动正确(转账显转入账户、隐藏分类)。
2. 唤起键盘,焦点在金额/备注。
   - **✅ 通过**:顶部 Tabs 行始终留在 Drawer 可视区,不被推出/不滚走。
3. 对照修复前后首屏(键盘未弹起)。
   - **✅ 通过**:修复后首屏至少多露一个表单字段(SC-003)。

### 3.3 平台矩阵(每项都跑 3.1)

| 平台 | 必跑 |
|---|---|
| iPhone Safari(标签页) | 是 |
| iPhone PWA standalone(添加到主屏幕) | 是(visualViewport 行为与 Safari 不同) |
| 中端 Android Chrome | 是(resize vs visualViewport 差异) |

### 3.4 桌面端回归(SC-004)

桌面浏览器打开"记一笔"Drawer,完整走一遍输入/保存。
- **✅ 通过**:与修复前体验无差异,无新增缺陷。`useVisualViewport` 在桌面 `keyboardHeight=0`,
  钳制/scroll 均等价 identity。

## 4. HeroUI v3 对齐核对(SC-005)

逐项核对 research.md R6 的差异清单,确认每项已对齐或已在 research.md 记录理由:

- [ ] submit 在 `Drawer.Footer`(不在 Body 内)
- [ ] `Drawer.Content` 高度受 `vv.height` 钳制
- [ ] Tabs 密度经 `Tabs.List`/`Tabs.Tab` className 控制
- [ ] 无全局 `scrollIntoView`(只滚 `Drawer.Body.scrollTop`)
- [ ] 无 shadcn legacy token、无 v2 flat API、无 `HeroUIProvider`/`framer-motion` 残留

## 5. 性能 / 体感验收

- **CLS**:DevTools Lighthouse 跑 `/dashboard`(Drawer 入口)与 `/transaction/new`,
  after CLS ≤ 0.05(沿用 029 SC-003)。记录于 baseline.md 的 after 区块。
- **10 秒体感**(宪章五):真机从点 FAB 到完成一笔录入(含键盘交互),目测无因键盘抖动
  造成的停顿。沿用 029 既有体感目标,不退步。

## 6. 边界场景(对照 spec Edge Cases)

- 快速反复聚焦金额/备注:无抖动累加(C2 去抖生效)。
- 长表单滚到极顶/极底聚焦:不把内容推出 Body 可滚动边界,不带动 Drawer 本体。
- 键盘弹出时切换 Tabs:Drawer 不位移、背景不透出。
- 横屏:键盘占屏比更高,US1 可见性仍成立(或作为已知限制记入 research.md)。
