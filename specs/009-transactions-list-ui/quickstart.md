# Quickstart: 009-transactions-list-ui 验证指南

**Date**: 2026-07-07

## 前置条件

- 001-008 全部就绪,`pnpm dev` 运行
- 已注册用户 + 账户 + 多笔交易

## 验证 US1: 流水列表

1. 登录后点底部导航"流水" tab → `/transactions`
2. 检查列表: 按时间倒序,每笔含 icon+金额+分类+账户+备注+日期
3. 若 > 50 笔,底部有"加载更多"按钮
4. 无交易时显示"暂无交易"

## 验证 US2: 筛选

1. 点击"筛选"按钮展开筛选区
2. 选"仅支出" → 列表刷新,小计仅含支出
3. 选某账户 → 列表刷新
4. 组合筛选 → AND 逻辑
5. 清空筛选 → 回到全部

## 验证 US3: 编辑

1. 点击某笔交易的编辑按钮
2. 跳转 /transaction/new?id=xxx
3. 表单预填数据
4. 修改金额 + 提交
5. 返回流水列表,数据已更新

## 验证 US4: 删除

1. 点击某笔交易删除按钮
2. `window.confirm` 弹出 "确认删除?"
3. 点"确认" → 交易消失,列表刷新
4. 点"取消" → 不删除

## 通过判据

| SC | 验证 | 状态 |
|---|---|---|
| SC-001 (首次 ≤ 2s) | 页面 0.074s + API 0.026s = 0.1s | ✅ PASS |
| SC-002 (筛选 ≤ 1s) | 筛选 API 0.013-0.018s | ✅ PASS |
| SC-003 (375px) | 代码审查: 全宽/flex 布局,无可导致横向滚动的固定宽度 | ✅ PASS |
| SC-004 (小计准确) | type=expense → income=0/expense=5800/net=-5800; type=income → income=15000/expense=0/net=15000 | ✅ PASS |
| SC-005 (删除刷新) | 创建测试交易 → 删除 → 列表 4→3, 小计恢复 | ✅ PASS |
| SC-006 (分页连续) | API cursor 逻辑正确 (nextCursor=null 当 <50 条); useEffect 追加 items | ✅ PASS |

---

## shadcn 迁移回归验证 (025-legacy-shadcn-migration)

> 本节由 [025-legacy-shadcn-migration](../025-legacy-shadcn-migration/spec.md) 追加(2026-07-13),用于验证 shadcn 原语迁移后行为零回归。
> 既有验收场景保持不变;本节仅追加迁移相关检查项。

### 迁移点

| 控件 | 迁移前 | 迁移后 | 验证点 |
|---|---|---|---|
| 账户筛选 | 裸 `<select>` + `<option value="">全部账户</option>` | shadcn `<Select>` + `<SelectItem value="__all__">全部账户</SelectItem>`(R4 sentinel) | 浮层渲染 / sentinel 切换 / 跨页 reset |
| 分类筛选 | 裸 `<select>` + `<option value="">全部分类</option>` | shadcn `<Select>` + sentinel `__all__` | 同上 |
| 删除确认 | `window.confirm("确认删除?")` 同步阻塞 | shadcn `<AlertDialog>` + state-driven + destructive 红色 variant | 默认焦点在"取消" / Esc / 遮罩关闭 / 确认 + toast / 失败 toast |

### 验证 Checklist

- [ ] 打开 `/transactions` 展开"筛选" → 点账户字段 → 弹 shadcn Select,首项为"全部账户"(sentinel)
- [ ] 选某账户 → 列表过滤;重新打开 Select,该账户有选中标记
- [ ] 显式选回"全部账户" → 列表恢复全量(accountId 转回 undefined)
- [ ] 分类筛选同上(仅在选了类型后出现)
- [ ] 点交易行"删除"按钮 → 弹 shadcn AlertDialog(非浏览器 confirm),标题"确认删除?"
- [ ] AlertDialog 默认 Tab 焦点在"取消"按钮(防误触 Enter 删除)
- [ ] "确认删除"按钮视觉为 destructive 红色(`AlertDialogAction asChild` + `Button variant="destructive"`)
- [ ] 按 Esc / 点遮罩 → 关闭 dialog,无 mutation 触发
- [ ] 点"确认删除" → 按钮文案"删除中..." + disabled,"取消"同时 disabled;mutation 成功后 dialog 自动关闭 + toast"已删除" + 列表减少一条
- [ ] 失败路径(mock 后端 500):mutation 失败 → dialog 保持打开 + "确认删除"恢复可点击 + toast.error 显示错误
- [ ] macOS VoiceOver 抽查:AlertDialog 打开后焦点移入 dialog,Tab 在 dialog 内循环,读出"对话框 / 确认删除?"
- [ ] 既有 quickstart 全部场景(除 window.confirm 相关步骤按本节更新)100% 通过(FR-010)
