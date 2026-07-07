# Quickstart: 007-onboarding-ui 验证指南

**Date**: 2026-07-07

## 前置条件

- 001-006 后端全部就绪,`pnpm dev` 运行在 `http://localhost:3000`
- 浏览器 (Chrome/Safari)

## 验证 US1: 注册

1. 打开 `http://localhost:3000` → 应重定向到 `/login`
2. 点"去注册"链接 → 跳转 `/register`
3. 输入邮箱 `newuser@example.com` + 密码 `correct-horse-battery-staple` + 确认密码
4. 点"注册" → 自动登录,跳转 `/dashboard`
5. 刷新页面 → 仍在 `/dashboard` (cookie 持久)

**错误场景**:
- 密码 < 8 位 → 表单显示"密码至少 8 位"
- 两次密码不一致 → 表单显示"密码不一致"
- 已注册邮箱 → toast 显示"该邮箱已注册"

## 验证 US2: 登录

1. 登出 (US4) 回到 `/login`
2. 输入 `newuser@example.com` + `correct-horse-battery-staple`
3. 点"登录" → 跳转 `/dashboard`

**错误场景**:
- 密码错 → "邮箱或密码错误"
- 连续 5 次失败 → "账户已锁定,请 5 分钟后重试"
- 已登录访问 /login → 自动跳 /dashboard

## 验证 US3: Dashboard

1. 在 `/dashboard` 页面检查:
   - 3 个数字卡片: 本月收入 / 本月支出 / 本月结余
   - 最近交易列表 (≤ 5 笔,含 icon + 金额 + 分类 + 账户 + 备注)
   - 支出分类占比 (icon + 名称 + 金额 + 百分比)
2. 无交易时 → 显示"暂无交易"空状态
3. 加载中 → 骨架屏 (不闪白)
4. iPhone SE (375px) 上无横向滚动

## 验证 US4: 登出 + App Shell

1. 底部导航栏 4 个 tab: 首页 / 流水 / 记账 / 设置
2. 当前页 tab 高亮
3. 点"流水" → `/transactions` 显示"即将上线"
4. 点"记账" → `/transaction/new` 显示"即将上线"
5. 点"设置" → `/settings` 显示登出按钮
6. 点"登出" → 清 cookie,跳转 `/login`
7. 刷新 → 不回到 /dashboard (cookie 已清)

## 通过判据

| SC | 验证 | 状态 |
|---|---|---|
| SC-001 (注册 ≤ 60s) | 手动计时 | ⏳ |
| SC-002 (登录 ≤ 5s) | 手动计时 | ⏳ |
| SC-003 (dashboard ≤ 2s) | 手动计时 | ⏳ |
| SC-004 (375px 无横向滚动) | DevTools 移动模拟 | ⏳ |
| SC-005 (表单提交前校验) | 输入无效值观察 | ⏳ |
| SC-006 (登出后刷新不回) | 登出+刷新 | ⏳ |
