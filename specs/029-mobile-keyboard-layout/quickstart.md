# Quickstart: 029 移动端键盘弹起布局稳定性

**Branch**: `029-mobile-keyboard-layout` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

本文件是 **验证 runbook**,描述如何在本地跑通"键盘弹起 → 表单可用"的端到端验收。**不含实现代码**(实现在 `tasks.md` 阶段)。

---

## §1. 前置依赖

- Node 22.x(LTS)、pnpm v10+
- 现代移动浏览器 1 台(iOS Safari 16+ 或 Android Chrome 最新两版本)
- 桌面 Chrome(用于 DevTools 模拟)
- 仓库已 install:`pnpm install`
- 测试数据库可用(Docker compose 启动 PostgreSQL)

---

## §2. 启动开发环境

```bash
pnpm dev
# 等待 "Ready in Xms"
```

打开 `http://localhost:3000`,登录已有账号(或注册 → onboarding 完成)。

---

## §3. P1 验收 — 记一笔 Drawer

### §3.1 Chrome DevTools 模拟流程(每 PR 必跑)

1. 打开 DevTools → Toggle Device Toolbar(`Cmd/Ctrl + Shift + M`)
2. 选 iPhone 12 Pro(或 Pixel 7)+ **CPU 4× slowdown** + **Slow 3G**(mid-tier mobile preset)
3. 进入 `/dashboard`,点击底部 FAB(中央凸起 "+"按钮)
4. **预期**:Drawer 从底部滑出,显示"记一笔"标题 + 金额输入框 autoFocus

#### §3.1.1 验证 SC-001(聚焦字段 300ms 内可见)
- [ ] 点击金额输入框 → 键盘弹起 → 金额输入框**完整可见**(¥ 前缀 + 输入数字)
- [ ] 切换到备注(TextArea)→ 备注 **300ms 内滚动到 Drawer.Body 视觉中心**
- [ ] 切换到日期(DatePicker)→ 日历 Popover **在键盘上方展开**

#### §3.1.2 验证 SC-002(保存按钮始终可达)
- [ ] 任一字段聚焦时,**保存按钮始终可见,在键盘上方 16px**
- [ ] 不需要先收起键盘即可点击保存

#### §3.1.3 验证 SC-003(CLS ≤ 0.05)
- [ ] DevTools Performance Monitor 开启 CLS 监控
- [ ] 完整流程:打开 Drawer → 聚焦金额 → 切换备注 → 切换日期 → 收起键盘
- [ ] 累计 CLS ≤ 0.05

#### §3.1.4 验证 FR-004(顶部元素可见)
- [ ] Drawer.Header "记一笔" 标题 + 关闭按钮 在键盘弹起时**保持可见**

### §3.2 真机流程(initiative 收尾必跑)

| 设备 | 步骤 |
|---|---|
| iPhone 12 / 13 Safari | 同 §3.1.1 – §3.1.4 |
| Redmi Note 12 / Samsung A Chrome | 同 §3.1.1 – §3.1.4 |

---

## §4. P2 验收 — 全屏交易页

### §4.1 `/transaction/new` 新建页

1. 桌面 Chrome DevTools 模拟(iPhone 12 Pro)
2. 直接访问 `http://localhost:3000/transaction/new`
3. 走 §3.1.1 – §3.1.4 同样的检查
4. **额外检查**:Card.Header 内的返回按钮(ChevronLeft)在键盘弹起时保持可见

### §4.2 `/transaction/[id]/edit` 编辑页

1. 先在 `/transactions` 找一笔交易,点编辑进入
2. 走 §3.1.1 – §3.1.4 同样的检查

---

## §5. P3 验收 — 次要表单入口(等价达标)

> 2026-07-17 clarification Q1:P3 与 P1/P2 等价达标。

### §5.1 账户表单
- [ ] `/settings` 内账户新增 / 编辑表单聚焦字段时,FR-001/002/003 全部适用

### §5.2 分类管理
- [ ] `/settings` 内分类管理(分类名输入)键盘弹起时保存按钮可达

### §5.3 设置搜索 / API Key 输入
- [ ] `/settings` 内 API Key Manager 输入框键盘行为一致

### §5.4 Onboarding
- [ ] `/onboarding` 任一步骤输入字段聚焦时,FR-001/002/003 全部适用

---

## §6. 桌面端回归(SC-005,0 缺陷)

| 测试项 | 操作 | 预期 |
|---|---|---|
| 物理键盘输入 | 桌面 Chrome 打开 Drawer,键盘输入金额 | 无任何键盘弹起逻辑被误触发 |
| Tab 导航 | Tab 键依次聚焦字段 | React Aria focus trap 正常,focus 顺序符合预期 |
| 表单 autocomplete | 浏览器 autofill 备注 | 不破坏 HeroUI TextArea 行为 |
| 浏览器 zoom | Ctrl + +/- 缩放 | 不破坏表单布局 |
| Window resize | 拖拽窗口尺寸变化 | 不触发键盘相关 transition |

---

## §7. 自动化测试

### §7.1 单元测试(`pnpm test:unit`)
- `useVisualViewport` hook 在不同 `visualViewport.height` 输入下返回正确的 `keyboardHeight` / `isKeyboardOpen`
- `useScrollIntoViewOnFocus` mock `focusin` 事件,断言 `scrollIntoView` 被调用

### §7.2 组件测试(`pnpm test:unit` 内 Testing Library)
- TransactionDrawer 渲染 embedded 表单,模拟 `visualViewport` resize 事件,断言 Drawer.Footer paddingBottom 变化

### §7.3 类型与 Lint
```bash
pnpm type-check    # 0 error
pnpm lint          # 0 error(允许 pre-existing warnings)
```

### §7.4 构建
```bash
pnpm build         # success
```

---

## §8. 性能验证(SC-006,体感预算不退化)

### §8.1 中端设备端到端耗时
- iPhone 12 Safari 中端预设下,从 `/dashboard` FAB 点击到 Drawer 打开 + 金额字段聚焦可输入 → 完成金额输入 → 切换备注 → 提交保存
- **中位耗时较修复前 baseline 不增加**(允许等价或减少)

### §8.2 Lighthouse Mobile(选做)
- `pnpm build && pnpm start` → Chrome DevTools Lighthouse Mobile preset
- `/dashboard` 跑 3 次,取中位数:CLS、LCP、INP 与 025 baseline 对比

---

## §9. PR 提交门(每个 PR 必须满足)

- [ ] §3.1(DevTools 模拟)全绿
- [ ] §6 桌面回归 0 退化
- [ ] §7.3 type-check + lint 全绿
- [ ] `contracts/visual-equivalence.md` §1 + §2 invariant 100% 保持
- [ ] commit message 引用本 PR 解决的 FR/SC 编号

---

## §10. Initiative 收尾门(全部 PR 合并后)

- [ ] §3.2 真机 iPhone + Android 各 1 台全绿
- [ ] §4 全屏交易页真机验证
- [ ] §5 P3 入口真机抽测(每入口至少 1 个核心场景)
- [ ] §7 全部自动化测试全绿
- [ ] §8.1 端到端耗时测量记录在 `baseline.md` 类似的 after 区块
- [ ] spec 所有 SC-001 – SC-007 验证通过
- [ ] `docs/AGENTS.md` React/Next.js 范式段落若需更新,在本 initiative 收尾 PR 一并跟进

---

## §11. NEEDS-MANUAL 说明

部分测量只能通过 Chrome DevTools GUI / 真机完成,无法 CI 自动化(对齐 025-perf-code-optimization 既定方法):
- CLS 实时监控(§3.1.3)
- 真机键盘交互体感(§3.2、§4)
- 桌面端 Tab 顺序手测(§6)

PR 描述必须列出"已自动化 vs NEEDS-MANUAL"清单,reviewer 按 runbook 执行(参考 `specs/025-perf-code-optimization/REVIEWER-RUNBOOK.md` 模式)。
