# Quickstart: 010-settings-ui 验证指南

**Date**: 2026-07-07

## 前置条件

- 001-009 全部就绪,`pnpm dev` 运行
- 已注册用户 + 至少 1 个账户 (可选,用于编辑/归档验证)
- Better-Auth 会话 cookie 已获取 (登录)

## 验证 US1: 创建账户

1. 登录后点底部导航"设置" tab → `/settings`
2. 点"新建账户"按钮 → 展开内联表单
3. 填写名称 (如"招商银行卡") + 选择币种 (默认人民币) + 输入初始余额 (如 5000)
4. 点"提交" → 表单收起,列表新增一行
5. 验证列表显示: 名称 + 币种 + 初始余额 (如"招商银行卡 CNY 5000.00")
6. 空名称提交 → 显示字段错误"请输入账户名称",不创建
7. 名称超过 50 字提交 → 显示字段错误
8. 初始余额输入非数字 (如"abc") → 显示字段错误

## 验证 US2: 查看账户列表

1. 打开 `/settings` → 显示所有账户,活跃在前,归档在后 (灰色)
2. 每行含名称 + 币种 + 初始余额
3. 无账户时显示"暂无账户,请先创建"
4. 首次加载显示骨架屏 (可用 Network throttle 验证)

## 验证 US3: 编辑账户

1. 点某活跃账户行的"编辑"按钮 → 该行展开编辑表单
2. 验证表单预填: 名称 + 币种 (不含初始余额字段)
3. 修改名称 → 提交 → 列表刷新,显示新名称
4. 清空名称 → 提交 → 显示字段错误,不保存
5. 点"取消" → 表单收起,不修改
6. 已归档账户行 → 不显示"编辑"按钮 (仅显示"取消归档")

## 验证 US4: 归档/取消归档

1. 点某活跃账户行的"归档"按钮 → 弹出 `window.confirm`("确认归档?此操作不影响已有交易")
2. 点"确认" → 账户移到列表下方归档区域,显示"已归档"标记
3. 点"取消" → 不归档
4. 点已归档账户行的"取消归档"按钮 → 账户恢复为活跃,移到列表上方
5. 验证归档账户的交易不受影响 (在 /transactions 查看流水)

## 验证 US5: 登出

1. 点页面底部"登出"按钮 → 清除会话,跳转 /login
2. 登出后访问 /settings → 重定向 /login

## 通过判据

| SC | 验证 | 状态 |
|---|---|---|
| SC-001 (首次 ≤ 2s) | 页面加载 + account.list API 响应 < 2s | ⏳ 待验证 |
| SC-002 (创建 ≤ 30s) | 从点"新建账户"到列表更新 < 30s | ⏳ 待验证 |
| SC-003 (375px 无横滚) | iPhone SE 视口下页面无横向滚动 | ⏳ 待验证 |
| SC-004 (归档立即更新) | 归档后列表立即刷新,账户移到归档区域 | ⏳ 待验证 |
| SC-005 (登出 ≤ 1s) | 点登出到跳转 /login < 1s | ⏳ 待验证 |

## API 验证 (curl)

如需 API 级别验证 (与 009 模式一致):

```bash
# 登录获取 cookie
curl -c cookies.txt -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"correct-horse-battery-staple"}'

# 获取全部账户 (含归档)
curl -b cookies.txt "http://localhost:3000/api/trpc/account.list?input=%7B%22json%22%3A%7B%22includeArchived%22%3Atrue%7D%7D"

# 创建账户
curl -b cookies.txt -X POST http://localhost:3000/api/trpc/account.create \
  -H "Content-Type: application/json" \
  -d '{"json":{"name":"测试账户","currency":"CNY","initialBalance":500000}}'

# 编辑账户 (仅 name + currency)
curl -b cookies.txt -X POST http://localhost:3000/api/trpc/account.update \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":"<account-uuid>","name":"新名称","currency":"USD"}}'

# 归档账户
curl -b cookies.txt -X POST http://localhost:3000/api/trpc/account.archive \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":"<account-uuid>"}}'

# 取消归档
curl -b cookies.txt -X POST http://localhost:3000/api/trpc/account.unarchive \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":"<account-uuid>"}}'
```
