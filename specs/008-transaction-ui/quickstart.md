# Quickstart: 008-transaction-ui 验证指南

**Date**: 2026-07-07

## 前置条件

- 001-007 全部就绪,`pnpm dev` 运行
- 已注册用户 + 至少 1 个未归档账户

## 验证 US1: 快速记账

1. 打开 `http://localhost:3000`,登录
2. 点底部导航"记账" tab → `/transaction/new`
3. 检查默认值:
   - 类型默认"支出" ✓
   - 账户默认选第一个 ✓
   - 日期默认今天 ✓
   - 金额框自动聚焦 ✓
4. 选分类 (如"餐饮 🍔")
5. 输金额 `35.50`
6. 输备注 `午餐`
7. 点"确认记账" → toast "记账成功" + 跳转 /dashboard
8. Dashboard 的当月支出应增加 ¥35.50

## 验证类型联动

1. 回到 /transaction/new
2. 切换类型为"收入"
3. 分类列表应刷新为收入分类 (工资/奖金/理财收益等)
4. 切回"支出" → 分类列表回到支出分类

## 验证错误场景

- 金额 0 → 按钮禁用或显示"请输入金额"
- 金额 35.999 → 显示"金额格式无效" (超过 2 位小数)
- 不选分类 → "请选择分类"
- 网络断开 → "网络错误,请重试",表单数据保留

## 通过判据

| SC | 验证 | 状态 |
|---|---|---|
| SC-001 (10s 记账) | 手动计时 | ⏳ |
| SC-002 (提交 ≤ 2s) | 手动计时 | ⏳ |
| SC-003 (375px 无滚动) | DevTools | ⏳ |
| SC-004 (数字键盘) | 移动端测试 | ⏳ |
| SC-005 (Dashboard 刷新) | 记账后检查首页 | ⏳ |
| SC-006 (分类联动 ≤ 200ms) | 切类型观察 | ⏳ |

---

## shadcn 迁移回归验证 (025-legacy-shadcn-migration)

> 本节由 [025-legacy-shadcn-migration](../025-legacy-shadcn-migration/spec.md) 追加(2026-07-13),用于验证 shadcn 原语迁移后行为零回归。
> 既有验收场景保持不变;本节仅追加迁移相关检查项。

### 迁移点

| 控件 | 迁移前 | 迁移后 | 验证点 |
|---|---|---|---|
| 账户选择(accountId) | 裸 `<select>` + `register("accountId")` | shadcn `<Select>` + RHF `<Controller>` | 浮层渲染 / 键盘导航 / 预填 / 校验失败保留值 |
| 分类选择(categoryId) | 已由 023 `CategorySelect` 接管(024 US6) | 不变(FR-018 锁定) | 不在 025 scope |

### 验证 Checklist

- [ ] 打开 `/transaction/new`,点账户字段 → 弹出 shadcn Select 浮层(非原生 picker)
- [ ] 按 ↓↑ 高亮在账户列表间移动;Enter 选中并关闭;Esc 关闭不修改
- [ ] 新建模式默认选中第一个未归档账户(由 useEffect 注入,等价迁移前 `defaultValue`)
- [ ] 编辑模式(`/transaction/new?id=xxx`)进入后账户 Select 预填正确
- [ ] 选择账户 + 分类,不填金额,点"确认记账" → 金额红字错误,账户 Select 保留已选值
- [ ] macOS Safari / Chrome / iPhone 13 DevTools 模拟三平台视觉一致(浮层无 OS 原生 picker)
- [ ] macOS VoiceOver 抽查账户 Select 角色(listbox / option)正确读出
- [ ] 既有 quickstart 全部场景(除原生 select picker 相关步骤)100% 通过(FR-006)
