# Contract: dashboard.budget (新增)

**Feature**: 027-mobile-home-revamp | **Procedure**: `dashboard.budget` | **Type**: tRPC v11 (query + mutation)

**Spec ref**: [spec.md FR-016..FR-019](../spec.md) | **Data model**: [data-model.md §1.3, §2.4, §3.1](../data-model.md) | **Research**: [research.md R4](../research.md)

> [027 新增] 预算查询与设置。仅月周期(clarify Q3)。`dashboard.summary` 内联调用本查询首屏一次性返回;本独立 procedure 供下拉刷新/单独重试。

## Procedures

### dashboard.budget.get (query)

```ts
dashboardRouter.budget.get: protectedProcedure
  .input(z.object({
    year: z.number().int().min(2020).max(currentYear),
    month: z.number().int().min(1).max(12),
  }))
  .query(...)
```

**Output**:
```ts
{
  queriedYearMonth: { year: number; month: number };
  budget: { amount: number } | null;   // null = 未设置
}
```

### dashboard.budget.set (mutation, upsert)

```ts
dashboardRouter.budget.set: protectedProcedure
  .input(z.object({
    year: z.number().int().min(2020).max(currentYear),
    month: z.number().int().min(1).max(12),
    amount: z.number().int().positive("预算必须 > 0"),
  }))
  .mutation(...)
```

**Output**: `{ success: true; amount: number }`(返回设置的金额)

**行为**:upsert —— `(familyId, year, month)` 命中则 UPDATE amount,未命中则 INSERT。依赖 UNIQUE 索引 `budgets_family_year_month_uniq`。

### dashboard.budget.delete (mutation)

```ts
dashboardRouter.budget.delete: protectedProcedure
  .input(z.object({
    year: z.number().int().min(2020).max(currentYear),
    month: z.number().int().min(1).max(12),
  }))
  .mutation(...)
```

**Output**: `{ success: true }`(不存在时幂等,不报错)

## Business Rules

1. **familyId 隔离**:所有操作含 `WHERE family_id = ?`。
2. **仅月周期**:无 year-only 预算(clarify Q3);统计页"年"周期不消费此表。
3. **amount 单位**:分(与交易一致),正数;`set` 校验 `> 0`。
4. **四态计算**:不在本 procedure,而在 `dashboard.summary` 内用 `computeBudgetStatus(monthExpense, budget.amount)` 计算(research R4)。本 procedure 只返回原始 amount,四态是 summary 的派生。

## Error Scenarios

| 场景 | 行为 |
|---|---|
| 未登录 | tRPC `UNAUTHORIZED` |
| `year`/`month` 超范围 | tRPC `BAD_REQUEST` |
| `set` amount ≤ 0 | tRPC `BAD_REQUEST` "预算必须 > 0" |
| `set` 命中 UNIQUE 冲突(并发同月) | upsert 用 `ON CONFLICT (family_id, year, month) DO UPDATE`,不抛错 |

## Test Scenarios

1. **set 新预算**:首次 set,断言 INSERT。
2. **set 更新**:同 (familyId, year, month) 二次 set,断言 UPDATE(amount 变化,行数仍 1)。
3. **get 未设置**:无记录 → `budget: null`。
4. **get 已设置**:返回 amount。
5. **delete 存在**:删除后 get → null。
6. **delete 不存在(幂等)**:不报错。
7. **跨家庭隔离**:Family A 的预算 Family B 查不到。
8. **并发 set 同月**:两个并发 set 同 (familyId, year, month),最终 amount = 后者(ON CONFLICT UPDATE)。

## Performance Budget

- **get p95 < 50ms**(单行 UNIQUE 查询)
- **set/delete p95 < 100ms**(单行写)
