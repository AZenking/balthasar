# Phase 0 Research: 手机端首页及相关页面重做

**Feature**: 027-mobile-home-revamp | **Date**: 2026-07-14

本文档解决 plan.md Technical Context 中遗留的 plan 级未知项(specify/clarify 已定的是范围/数据形态/交互形态,这里是实现策略)。每项给出 Decision / Rationale / Alternatives。

> ⚠️ 宪章原则二禁止引入额外依赖解决本可由现有栈覆盖的问题;原则六 YAGNI 反对为假想未来构建。下述所有 Decision 均验证过现有依赖(Next.js 16 / HeroUI v3 / tRPC v11 / Drizzle / recharts / `@internationalized/date`)可覆盖。

---

## R1. 转账字段建模:`toAccountId` 单列 vs 双记录

**Decision**: 单记录 + 新增 `transactions.to_account_id` 列(uuid NULLABLE,仅 transfer 类型非空)。

**数据形态**:
```ts
// schema/transaction.ts
toAccountId: uuid("to_account_id").references(() => account.id, { onDelete: "restrict" })
// type='transfer' 时 NOT NULL(在 procedure 层强不变量);type='income'/'expense' 时 NULL
// amount 在 transfer 时存储原始正数(不应用符号),因转账不参与收支聚合
```

**聚合影响**:
- `getMonthSummary` 的 income/expense SUM 天然排除 transfer(因 `amount > 0` / `amount < 0` 的 CASE 不匹配 transfer 的正数 amount)—— 但需在 WHERE 显式 `type IN ('income','expense')` 防御,避免 refund(正向 expense)误入 income。
- `getCategoryBreakdown` 已 `WHERE type='expense'`,transfer 天然不进。
- 账户余额:`account.balance = initialBalance + SUM(amount WHERE accountId=该账户)`;transfer 时转出账户的 `amount` 取负、转入账户不在此行(余额由 `toAccountId` 的另一方向推导)。**关键**:余额计算需把 transfer 视为"转出账户 -amount / 转入账户 +amount"。

**Rationale**:
- 单记录符合用户心智("一笔转账"而非"两笔关联交易"),查询/删除/审计都是一行。
- `toAccountId` nullable 比 `transfer_pairs` 关联表简单;type guard 在 procedure 层强不变量(宪章三:聚合不变量在 server 端强制)。
- Drizzle migration 只加一列,down 路径 = DROP COLUMN,可回滚。

**Alternatives rejected**:
- **双记录**(插入 income + expense 两行 + `linkedTransactionId` 互相引用):被否。优点是余额计算复用现有 SUM,但缺点更多:① 两行需在同一事务保证原子,失败回滚复杂;② 删除/编辑需级联处理配对;③ 审计事件翻倍;④ `monthIncome`/`monthExpense` 聚合需额外 `WHERE linkedTransactionId IS NULL` 过滤,易漏。复杂度违反 YAGNI(原则六)。
- **独立 `transfers` 表**:被否。转账仍是"交易",独立表割裂聚合边界,且明细页/最近账单需 UNION 两表,查询复杂。

---

## R2. `dashboard.summary` 扩展后的查询并发策略

**Decision**: 保持 `Promise.all` 并发,新增 `getBudget`(单行)与 `getAssets`(accounts 聚合)作为第 5、6 个并行 task。预算/资产失败时降级为 null,不阻塞主汇总(SC-008 单模块失败不阻塞)。

**现状**(026):
```ts
const [summary, recent, breakdown, trend] = await Promise.all([
  getMonthSummary(...), getRecentTransactions(...), getCategoryBreakdown(...), trendFn(...)
]);
```

**扩展后**:
```ts
const [summary, recent, breakdown, trend, budget, assets] = await Promise.all([
  getMonthSummary(...),
  getRecentTransactions(...),
  getCategoryBreakdown(...),
  isCurrentMonth ? getDailyTrend(...) : getWeeklyTrend(...),
  getBudget({ familyId, year, month }).catch(() => null),  // 降级
  getAssets({ familyId }).catch(() => null),                // 降级
]);
```

**Rationale**:
- 预算 = 单行 SELECT by (familyId, year, month),命中 UNIQUE 索引,p95 < 5ms,对总 p95 无感。
- 资产 = `SELECT type, SUM(...) FROM accounts LEFT JOIN transactions GROUP BY type`,单次往返,p95 < 100ms(账户数通常 < 20)。
- `.catch(() => null)` 实现 SC-008 单模块失败不阻塞:预算/资产失败时前端显示对应引导态(预算未设置/资产加载失败重试),主收支/趋势/分类正常。

**Alternatives rejected**:
- **拆独立 procedure**(`dashboard.budget` / `dashboard.assets` 单独 query):被否。前端需 3 次往返(主 summary + budget + assets),首屏延迟增加;且首页区块需协调 3 个 loading 态,组件复杂度上升。但**保留独立 procedure 作为下拉刷新/单独重试入口**(见 contracts/dashboard-budget.md / dashboard-assets.md),summary 内联调用是为了首屏一次性返回。
- **串行**:被否。违反宪章五 p95 预算。

**p95 验证**:6 个并行 task,最慢的决定项仍是 `getCategoryBreakdown`(GROUP BY + JOIN)。026 已验证该 query 在 warm 状态 < 200ms,新增 2 个轻量 task 不改变决定项。research 判断 p95 < 500ms 可保持,集成测试需断言。

---

## R3. 隐私模式遮蔽 recharts YAxis 刻度(补 026 已知缺口)

**Decision**: 双层遮蔽 —— ① recharts `<YAxis tickFormatter>` 输出的文本节点用 CSS 选择器 `text.recharts-cartesian-axis-tick-value` 在 `.privacy-on` 下隐藏并替换;② 趋势区整体在隐私态用 `<img>` 或 CSS 遮罩不可行(需保留形状),改用 `tickFormatter` 返回占位 + 隐藏 YAxis 的 `<YAxis tick={false}>`。

**最终方案**(经评估,选 B):
- **YAxis**:`<YAxis tickFormatter={isPrivacy ? () => '••' : formatYuanTick} />`,隐私态返回占位符而非真实金额。无需 CSS hack(recharts 渲染的是 SVG `<text>`,`tickFormatter` 直接控制内容)。
- **Tooltip**:已挂 `data-amount`(026 实现),`.privacy-on [data-amount]` 自动遮蔽,无需改。
- **点击数据点金额**:Tooltip 即点击反馈,同上。
- **isPrivacy 来源**:前端组件读 `isPrivacyOn()`(`@/lib/privacy`),作为 prop 传入图表。无需后端感知。

**Rationale**:
- `tickFormatter` 是 recharts 官方 API,控制 tick 文本内容,比 CSS 选择器稳健(不依赖 recharts 内部 class 名,升级不破)。
- 隐私态是纯展示问题,不改原始数据(设计 §4.2),前端 prop 注入即可。
- 趋势图形状保留(YAxis 占位不影响曲线),符合"保留形状但隐藏金额刻度"。

**Alternatives rejected**:
- **CSS 选择器 `.privacy-on text.recharts-cartesian-axis-tick-value { visibility: hidden }`**:被否。依赖 recharts 内部 class,版本升级风险;且隐藏后留空,不如 `tickFormatter` 返回 `••` 直观。
- **隐私态隐藏整个 YAxis(`<YAxis hide={isPrivacy} />`)**:被否。隐藏后图表左边距坍缩,曲线位置漂移,违反"保留形状"。

---

## R4. 预算四态纯函数设计

**Decision**: 新增 `src/server/domain/dashboard/budget-status.ts` 纯函数,输入 `(usedAmount, budgetAmount)` 输出 `{ status, usagePercent, remaining, overspendAmount }`。

```ts
type BudgetStatus =
  | { status: "normal"; usagePercent: number; remaining: number }
  | { status: "warning"; usagePercent: number; remaining: number }   // ≥80% <100%
  | { status: "overspent"; usagePercent: number; overspendAmount: number } // ≥100%
  | { status: "unset" };  // budgetAmount null/0 + 未设置

export function computeBudgetStatus(
  usedAmount: number,      // 该月已支出(分,正数,从 getMonthSummary.expense)
  budgetAmount: number | null,  // null = 未设置
): BudgetStatus {
  if (budgetAmount == null || budgetAmount <= 0) return { status: "unset" };
  const usagePercent = Math.round((usedAmount / budgetAmount) * 1000) / 10;
  if (usagePercent >= 100) {
    return { status: "overspent", usagePercent, overspendAmount: usedAmount - budgetAmount };
  }
  if (usagePercent >= 80) {
    return { status: "warning", usagePercent, remaining: budgetAmount - usedAmount };
  }
  return { status: "normal", usagePercent, remaining: budgetAmount - usedAmount };
}
```

**阈值**:80% 硬编码(设计 §4.3 + Assumptions),不参数化(YAGNI;V2 再加可配置)。

**Rationale**:
- 纯函数,无 IO,易单测(四态边界 79.9/80/99.9/100/120 + unset)。
- `unset` 与 `budgetAmount=0` 区分:0 元预算语义可疑,按 unset 处理(避免"设了 0 元预算"显示超支 100% 的荒谬态)。
- 阈值边界用 `>=` 严格包含(80.0 算 warning,100.0 算 overspent)。

**Alternatives rejected**:
- **在 procedure 内联计算**:被否。四态逻辑是领域规则(宪章三:领域函数),内联会散落,单测困难。
- **前端计算**:被否。状态判定是业务规则,应在 server 端统一,避免前端多组件(首页/统计)各自实现产生不一致(设计 §7 模块边界:共享数据层)。

---

## R5. 资产聚合 SQL(`getAssets`)

**Decision**: 单次查询 JOIN accounts + transactions,按 `accounts.type` 分组。

```ts
export async function getAssets(opts: { familyId: string }): Promise<{
  totalAssets: number;   // asset 账户余额和(分)
  totalLiabilities: number; // debt 账户余额和(分,正数展示)
  netAssets: number;     // totalAssets - totalLiabilities
}> {
  // accounts.balance = initialBalance + SUM(该账户 transactions.amount)
  // transfer 影响:转出账户 amount 为负,转入账户通过 toAccountId 反向加
  //   → 需 UNION 两方向
  const rows = await db.execute(sql`
    WITH account_balances AS (
      SELECT a.id, a.type, a.initial_balance + COALESCE(
        (SELECT SUM(amount) FROM transactions t
         WHERE t.family_id = ${opts.familyId}
           AND t.type = 'transfer' = false  -- 非转账按 accountId
           AND t.account_id = a.id), 0
      ) + COALESCE(
        (SELECT SUM(amount) FROM transactions t
         WHERE t.family_id = ${opts.familyId}
           AND t.type = 'transfer'
           AND t.to_account_id = a.id), 0   -- 转账:转入方向加正 amount
      ) AS balance
      FROM accounts a
      WHERE a.family_id = ${opts.familyId} AND a.archived_at IS NULL
    )
    SELECT
      COALESCE(SUM(CASE WHEN type = 'asset' THEN balance ELSE 0 END), 0) AS total_assets,
      COALESCE(SUM(CASE WHEN type = 'debt' THEN ABS(balance) ELSE 0 END), 0) AS total_liabilities
    FROM account_balances
  `);
  const r = rows[0];
  const totalAssets = Number(r.total_assets);
  const totalLiabilities = Number(r.total_liabilities);
  return { totalAssets, totalLiabilities, netAssets: totalAssets - totalLiabilities };
}
```

**Transfer 余额处理关键**:
- 转出账户:transfer 行的 `accountId` 指向转出账户,`amount` 存正数,余额计算时取负(`-amount`)。**修正**:为简化,transfer 的 `amount` 在 DB 存**正数**,余额计算时转出账户减、转入账户(`toAccountId`)加。即 `account.balance = initialBalance - SUM(transfer amount WHERE accountId=该账户) + SUM(transfer amount WHERE toAccountId=该账户) + SUM(income/expense amount WHERE accountId=该账户)`。
- 上文 SQL 是示意,实现时需精确处理符号(research 阶段定方向,SQL 细节在 data-model/实现)。

**Rationale**:
- 单次 SQL 往返,CTE 避免应用层 N+1(宪章五禁止 N+1)。
- `archived_at IS NULL` 排除归档账户(与 account.list 默认一致)。
- 负债展示取 ABS(debt 账户余额可能为负,展示为正数负债额)。

**Alternatives rejected**:
- **应用层循环每个账户查 SUM**:被否。N+1 查询,违反宪章五。
- **持久化账户余额列**:被否。宪章 v3.1.0 FR-018 明确"account balance is NOT persisted; dashboard aggregates at query time via SUM(amount)",且增余额列需在每笔交易 mutation 维护一致性,复杂度高。

---

## R6. 收支趋势:本月每日 + 上月同期对比

**Decision**: 扩展 `getDailyTrend` 为月维度(非 026 的周维度);上月同期作为第二条参考线/灰线,数据来自上月同日。

**数据形态**:
```ts
// dashboard.summary.expenseTrend 扩展
type ExpenseTrend = {
  granularity: "daily";
  current: Array<{ date: "YYYY-MM-DD"; amount: number }>;   // 本月每日(补零至今天)
  previous: Array<{ date: "YYYY-MM-DD"; amount: number }>;  // 上月同长度(对齐日序)
  comparisonPercent: number | null;  // 本月合计 vs 上月合计,-8 表示降 8%
};
```

**对比徽标**:"较上月 -8%" = `comparisonPercent`,前端 `TrendBadge`(026 已有组件可复用)。

**Rationale**:
- 设计 §3.2-6"默认展示本月每日支出趋势 + 与上月同期的简短对比"。
- 当前月 daily 补零到今天(非整月,因未来日无数据);上月取相同日数对齐(上月 1 日..上月今天-月偏移)。
- 历史月保持 weekly(026 逻辑)—— 因历史月已完整,weekly 更可读。

**Alternatives rejected**:
- **本月整月补零(含未来日)**:被否。未来日永远是 0,显示无意义且拉低曲线。
- **上月整月对比**:被否。长度不对齐,曲线难叠加。

---

## R7. 左滑删除 + 撤销的交互实现

**Decision**: HeroUI 无原生 swipe-to-delete(需 `/heroui-react` skill 确认);降级方案 = `TransactionListItem` 加 disclosure 按钮删除(026 已有)+ sonner toast 撤销。

**实现路径**(实现期由 `/heroui-react` skill 确认具体组件):
1. 查 `/heroui-react` 是否有 Swipeable / Drawer-as-row 组件;有则用,无则用轻量自定义(translateX + 阈值)。
2. 删除 = `transaction.delete` mutation(乐观更新 + 回滚)。
3. 撤销 = sonner `toast("已删除", { action: { label: "撤销", onClick: restore } })`,撤销 = 重新创建(因 delete 是硬删除)。撤销窗口 = toast 可见时长(sonner 默认 4s,可配)。

**Rationale**:
- 硬删除 + 撤销重建,比"软删除 + 定时清理"简单(YAGNI);撤销窗口由 toast 生命周期决定,无需额外计时器。
- 乐观更新 + 回滚保证 UX 流畅;mutation 失败时 toast 报错并恢复列表。

**Alternatives rejected**:
- **软删除(deletedAt 列)+ 定时清理**:被否。新增列 + 清理任务,违反 YAGNI;且设计 §6.3 "失败保留现有内容"用乐观回滚即可达成。
- **纯 disclosure 按钮(无左滑)**:被否作为唯一方案,但**保留为 a11y fallback**(屏幕阅读器/键盘用户用按钮删除,左滑是增强)。

---

## R8. 底部导航 4 入口 + FAB 的 HeroUI 实现

**Decision**: 实现期 `/heroui-react` skill 查 HeroUI v3 的 BottomNavigation / FAB / Toolbar 组件;若无原生,用 `Card`/`Button` 组合(026 的 `bottom-navigation.tsx` 已是自实现,本次改结构)。

**结构变更**(026 → 027):
```
026: 5 入口 [首页 账单 [记一笔Drawer] 报表 我的]   ← TransactionDrawer 嵌在 nav 第 3 位
027: 4 入口 [首页 明细 (FAB) 统计 我的]            ← FAB 独立悬浮在 nav 中央上方,nav 只有 4 项
```

**FAB 形态**:线稿 `.add-button { width:46px; height:46px; margin-top:-28px; border-radius:50%; background:var(--primary) }`。HeroUI 用 `<Button>` + 绝对定位 `absolute -top-7`(对应 margin-top:-28px)。点击打开 `TransactionDrawer`(026 已有组件,改默认 type='expense',不弹二级选项层 —— clarify Q2)。

**Rationale**:
- FAB 独立于 nav(设计 §3.3"不作为第五个普通导航项"),语义更清晰,且中央上凸是主流记账 App 模式。
- 复用 026 的 `TransactionDrawer`(底部弹出表单),不重写。

**Alternatives rejected**:
- **保留 5 入口 Drawer 嵌入(026 方式)**:被否。设计 §3.3 明确"记账按钮独立悬浮,不作为第五个普通导航项"。
- **FAB 弹二级选项层(支出/收入/转账)**:被否(clarify Q2 已定 Option A:直进表单默认支出)。

---

## R9. 退款(反向支出)在聚合中的处理

**Decision**(specify/clarify Q1 已定):退款 = `type='expense'`、`amount` 为正(抵消原负支出)。无需新字段、无需关联原交易。

**聚合影响**:
- `getMonthSummary.expense` 现为 `SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END)` —— 退款 amount > 0 不会进这个 CASE,**导致退款被漏统计**(净支出 = 原支出 - 退款,但现 SQL 只算负数)。
- **修正 SQL**:`expense = SUM(CASE WHEN type='expense' THEN ABS(amount) ELSE 0 END)`(改用 type 判断 + ABS,而非 amount 符号判断)。这样退款(正 amount)的 ABS 也被计入支出,与原负支出相加后净额正确下降。
- 同理 `income` 改 `SUM(CASE WHEN type='income' THEN amount ELSE 0 END)`(type 判断,防 transfer 正 amount 误入)。

**Rationale**:
- type-driven 聚合比 sign-driven 更稳健(转账的正 amount 不再误判为收入)。
- 退款天然冲减分类(同 categoryId 的正负 ABS 相加后净额下降),无需额外逻辑。
- `getCategoryBreakdown` 已是 `WHERE type='expense'` + `SUM(ABS(amount))`,退款自动正确。

**验证**:集成测试需覆盖"某分类有 -¥100 支出 + ¥30 退款 → 净支出 ¥70,分类排名按 ¥70"。

---

## 待 plan 后续阶段 / 实现阶段细化的项(不阻塞)

以下为 plan 阶段已定方向、细节留 tasks/实现的项:
- 转账 `amount` 符号存储(正数 + 余额计算时转出取负):R1/R5 已定方向,SQL 细节在实现。
- 月/年统计的"较上期"基期:月=上月,年=去年同月(Assumptions 已定)。
- 趋势点点击交互形态:Tooltip 即可,无需独立弹层(YAGNI)。
- 左滑撤销时长:跟随 sonner toast 默认(4s),不单独配置。
- 预算设置入口的具体形态(轻量引导 vs Modal):UI 细节,`/heroui-react` skill + 实现期定。
