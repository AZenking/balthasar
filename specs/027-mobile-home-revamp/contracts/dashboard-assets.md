# Contract: dashboard.assets (新增)

**Feature**: 027-mobile-home-revamp | **Procedure**: `dashboard.assets` | **Type**: tRPC v11 query

**Spec ref**: [spec.md FR-020..FR-021](../spec.md) | **Data model**: [data-model.md §1.2, §2.5](../data-model.md) | **Research**: [research.md R5](../research.md)

> [027 新增] 资产三项聚合。`dashboard.summary` 内联调用首屏一次性返回;本独立 procedure 供单独刷新。按 `accounts.type`(asset/debt)分组(clarify Q1)。

## Procedure Signature

```ts
dashboardRouter.assets: protectedProcedure
  .input(z.void().optional())  // 无输入,familyId 从 session 解析
  .query(...)
```

**Auth**: `protectedProcedure`。

## Output Schema

```ts
{
  totalAssets: number;       // asset 账户余额和(分)
  totalLiabilities: number;  // debt 账户 ABS(余额)和(分,正数)
  netAssets: number;         // totalAssets - totalLiabilities
  accountCount: number;      // 未归档账户数(用于"4 个账户"展示)
}
```

## Business Rules

1. **余额计算**(research R5):
   ```
   account.balance = initialBalance
     + SUM(income/expense amount WHERE accountId = 该账户)
     - SUM(transfer amount WHERE accountId = 该账户)      -- 转出减
     + SUM(transfer amount WHERE toAccountId = 该账户)    -- 转入加
   ```
2. **分组聚合**:
   - `totalAssets = SUM(balance WHERE account.type = 'asset')`
   - `totalLiabilities = SUM(ABS(balance) WHERE account.type = 'debt')`(负债展示为正数)
   - `netAssets = totalAssets - totalLiabilities`
3. **排除归档**:`WHERE archived_at IS NULL`。
4. **familyId 隔离**:含 `WHERE family_id = ?`。
5. **空账户**:无账户 → `totalAssets=0, totalLiabilities=0, netAssets=0, accountCount=0`(前端显示"添加第一个账户"引导,FR-021)。

## Error Scenarios

| 场景 | 行为 |
|---|---|
| 未登录 | tRPC `UNAUTHORIZED` |
| DB 失败 | tRPC `INTERNAL_SERVER_ERROR`(在 summary 内联调用时降级为 null,research R2) |

## Test Scenarios

1. **全 asset 账户**:2 个 asset(initialBalance 1000/2000)+ 各有交易,断言 totalAssets = 余额和,totalLiabilities=0,netAssets=totalAssets。
2. **含 debt 账户**:1 asset(余额 5000) + 1 debt(余额 -2000),断言 totalAssets=5000,totalLiabilities=2000(ABS),netAssets=3000。
3. **transfer 影响余额**:A(asset)转 500 给 B(asset),断言 A 余额 -500、B 余额 +500,totalAssets 不变(转账不改变净资产)。
4. **排除归档**:归档账户不计入。
5. **无账户**:totalAssets=0, accountCount=0 → 前端引导态。
6. **跨家庭隔离**:Family A 的账户不在 Family B 的聚合。

## Performance Budget

- **p95 < 300ms**(单次聚合查询;账户数通常 < 20,CTE + GROUP BY)
- 在 summary 内联时与其它 task 并行,不改变 summary p95 决定项(research R2)
