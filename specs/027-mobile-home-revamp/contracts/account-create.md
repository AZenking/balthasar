# Contract: account.create (扩展 — type 字段)

**Feature**: 027-mobile-home-revamp | **Procedure**: `account.create` | **Type**: tRPC v11 mutation

**Spec ref**: [spec.md FR-020..FR-021](../spec.md) | **Data model**: [data-model.md §1.2, §2.7](../data-model.md) | **Research**: [research.md R5](../research.md)

> [027 变更] 新增可选 `type` 字段(asset/debt,默认 asset)。其余保持 002-account 行为。

## Procedure Signature

```ts
accountRouter.create: protectedProcedure
  .input(z.object({
    name: z.string().min(1).max(50),
    currency: z.enum([...]),  // 002 现有枚举
    initialBalance: z.number().int().default(0),
    type: z.enum(["asset", "debt"]).default("asset"),  // [027 新增]
  }))
  .mutation(...)
```

## Input Schema

| 字段 | 类型 | 必填 | 校验 | 变化 |
|---|---|---|---|---|
| `name` | `string` | 是 | 1-50 字符 | 002 不变 |
| `currency` | `enum` | 是 | 002 现有 | 不变 |
| `initialBalance` | `number` | 否 | 整数,默认 0,允许负 | 不变 |
| `type` | `"asset" \| "debt"` | 否 | 默认 `"asset"` | **[027 新增]** |

## Output Schema

```ts
{
  id: string;
  familyId: string;
  name: string;
  currency: string;
  initialBalance: number;
  type: "asset" | "debt";   // [027 新增]
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

## Business Rules

1. **familyId 解析**:同 002,从 session。
2. **type 默认 asset**:向后兼容(存量账户全为 asset,migration DEFAULT 'asset')。
3. **debt 账户 initialBalance**:可负(信用卡欠款)或正(预存),type 只是分类标签,不强制符号约束(余额计算对两 type 通用)。
4. **审计**:同 002,`account_created` 事件,`after` 含 `type`。

## Error Scenarios

| 场景 | 行为 |
|---|---|
| 未登录 | tRPC `UNAUTHORIZED` |
| `name` 空/超长 | tRPC `BAD_REQUEST`(002 不变) |
| `currency` 非法 | tRPC `BAD_REQUEST`(002 不变) |
| `type` 非法 | zod 校验失败 |

## Test Scenarios

1-3. 同 002(创建 asset 账户 / 校验 / family 隔离)。
4. **[027 新增] 创建 debt 账户**:type='debt',断言返回 type='debt'。
5. **[027 新增] type 默认 asset**:不传 type,断言 type='asset'。
6. **[027 新增] debt 进入 totalLiabilities**:创建 debt 账户后查 assets,断言计入 totalLiabilities。
7. **[027 新增] migration 向后兼容**:存量账户(无 type 列数据)migration 后 type='asset'。

## Performance Budget

- **p95 < 300ms**(宪章五 mutation,单行 INSERT,同 002)
