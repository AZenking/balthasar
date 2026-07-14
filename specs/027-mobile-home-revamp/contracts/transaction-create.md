# Contract: transaction.create (扩展 — transfer 模式)

**Feature**: 027-mobile-home-revamp | **Procedure**: `transaction.create` | **Type**: tRPC v11 mutation

**Spec ref**: [spec.md FR-012..FR-015](../spec.md) | **Data model**: [data-model.md §1.1, §2.6, §3.2-3.3](../data-model.md) | **Research**: [research.md R1/R9](../research.md)

> [027 变更] 新增 `transfer` 模式;income/expense 模式保持 026 行为。用 **[027 新增]** 标注。

## Procedure Signature

```ts
transactionRouter.create: protectedProcedure
  .input(discriminatedUnionInput)  // [027 变更] 改 discriminated union 区分 transfer
  .mutation(...)
```

## Input Schema

```ts
// [027 变更] discriminated union
const createInput = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("income"),
    accountId: z.string().uuid(),
    categoryId: z.string().uuid(),
    amount: z.number().int().positive(),
    remark: z.string().max(200).optional(),
    occurredAt: z.string().datetime().optional(),
  }),
  z.object({
    type: z.literal("expense"),
    accountId: z.string().uuid(),
    categoryId: z.string().uuid(),
    amount: z.number().int().positive(),
    isRefund: z.boolean().default(false),   // [027 新增] 退款标志:true 时 amount 存 +正数(procedure 跳过 applySign),冲减该分类
    remark: z.string().max(200).optional(),
    occurredAt: z.string().datetime().optional(),
  }),
  z.object({
    type: z.literal("transfer"),         // [027 新增]
    accountId: z.string().uuid(),        // 转出账户
    toAccountId: z.string().uuid(),      // 转入账户
    amount: z.number().int().positive(),
    remark: z.string().max(200).optional(),
    occurredAt: z.string().datetime().optional(),
    // transfer 无需 categoryId —— procedure 强制用系统内置"转账"分类 id(M3 决策,见 data-model §1.1)
  }),
]);
```

## Output Schema

```ts
// 同 026(serializeTransaction),新增 toAccountId/toAccountName 字段
{
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;          // signed: income + / expense ± / transfer +(正)
  remark: string;
  occurredAt: string;      // ISO UTC
  accountId: string;
  accountName: string | null;
  toAccountId: string | null;     // [027 新增] transfer 时非空
  toAccountName: string | null;   // [027 新增] transfer 时非空
  categoryId: string;
  categoryName: string | null;
  categoryIcon: string | null;
}
```

## Business Rules

1. **familyId 解析**:同 026,从 `ctx.session.user.id` → `loadFamilyAndMemberIdsByUserId`。
2. **符号 [027 变更]**(research R1):
   - `income` → `applySign('income', amount)` = +amount(026 不变)
   - `expense`(普通)→ `applySign('expense', amount)` = -abs(amount)(026 不变)
   - `expense`(退款,`isRefund: true`)→ amount 存 **+abs(amount)**,procedure 跳过 applySign(见规则 3)
   - `transfer` → `applySign('transfer', amount)` = +abs(amount)(research R1:存正数,余额计算时转出减/转入加)
3. **退款** [027 新增,已收敛决策](research R9 / clarify Q1):退款 = `type='expense'` + `isRefund: true` + amount 正数,DB 存 **+abs(amount)**(procedure 对 isRefund 分支跳过 applySign)。`applySign` 函数本身**不改**(仍对 expense 返回 -abs);退款是 procedure 层的另一条存储路径。聚合规则:`getMonthSummary.expense` 用 `SUM(CASE WHEN type='expense' THEN ABS(amount) END)` —— 普通支出 ABS(-x)=x、退款 ABS(+x)=x,同分类相加后净额正确下降(research R9)。不新增实体,不强制关联原交易。
4. **transfer 校验 [027 新增]**(research R1):
   - `validateTransfer(accountId, toAccountId)`:`accountId === toAccountId` → 拒绝(FR-014 自转)
   - 两账户必须同 family、均未归档(validateAccountAndCategory 扩展)
5. **toAccountId [027 新增]**:transfer 时写入 `to_account_id` 列;income/expense 时该列为 NULL。
6. **transfer 的 categoryId [027 新增,M3 决策]**:transfer 创建时 procedure **强制** `categoryId = 系统内置"转账"分类 id`(忽略客户端传入)。`transactions.categoryId` 保持 NOT NULL(026 不变),不改为 NULLABLE,向后兼容。内置分类由 migration/seed 写入(name="转账",不可用于 income/expense)。
7. **审计**:同 026,`transaction_created` 事件;transfer 的 `after` 含 `toAccountId`。

## Error Scenarios

| 场景 | 行为 |
|---|---|
| 未登录 | tRPC `UNAUTHORIZED` |
| `transfer` + `accountId === toAccountId` | tRPC `BAD_REQUEST` "转出账户与转入账户不能相同"(FR-014) |
| `transfer` + 缺 `toAccountId` | zod 校验失败(discriminated union) |
| `transfer` + 账户跨家庭 | tRPC `BAD_REQUEST`(validateAccountAndCategory) |
| 账户/分类不存在 | 同 026 |
| 金额 ≤ 0 | zod `positive()` 失败 |
| 未来日期(超 1 天) | tRPC `BAD_REQUEST`(026 不变) |

## Test Scenarios

1-3. 同 026(income / expense / 校验失败)。
4. **[027 新增] transfer 创建**:转出 A、转入 B,断言 transactions 行 type='transfer'、toAccountId=B、amount 正数。
5. **[027 新增] transfer 自转拒绝**:accountId === toAccountId → BAD_REQUEST。
6. **[027 新增] transfer 跨账户余额**:创建后查 assets,断言 A 余额减、B 余额加(见 dashboard-assets 契约)。
7. **[027 新增] transfer 不计入收支**:创建后查 summary.monthIncome/monthExpense,断言不含该 transfer。
8. **[027 新增] 退款冲减**:创建 -¥100 expense(餐饮) + ¥30 退款(餐饮,amount 正),断言 getCategoryBreakdown 餐饮 = ¥70。

## Performance Budget

- **p95 < 300ms**(宪章五 mutation 预算)
- transfer 含 1 次 INSERT(单行),与 income/expense 成本相同;余额不持久化,无额外 UPDATE(宪章 FR-018)
