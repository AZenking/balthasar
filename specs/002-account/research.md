# Phase 0 Research: 002-account

**Date**: 2026-07-06
**Status**: Complete
**Source spec**: [spec.md](./spec.md)
**Source plan**: [plan.md](./plan.md)

本 feature 复用 001 的技术栈 (T3 + Drizzle + Better-Auth + PostgreSQL),Phase 0 决策聚焦于 002-account 特有的设计点。宪章 v2.0.0 是权威约束。

---

## Q1: 币种 (currency) 字段存储 — text vs pgEnum

### Decision
**`text` 字段 + 应用层 zod enum 校验** (ISO 4217 三字母代码大写)。

### Rationale
- **pgEnum 修改成本高**: 添加新币种需要 `ALTER TYPE ADD VALUE` 迁移,且部分 PG 版本不允许在事务中删除 enum value。家庭记账 MVP 币种可能调整 (用户反馈加 KRW 等),enum 修改路径麻烦。
- **应用层校验已足够**: zod `z.enum(['CNY', 'USD', ...])` 在 procedure input 处强制校验,DB 层存原始 text 即可。
- **跨表 join 不依赖 enum**: currency 字段不会被 join,只是元数据。
- **YAGNI**: V2 接入完整 ISO 4217 时,只需扩展 zod enum,不动 DB schema。

### Alternatives Considered
- **pgEnum**: 拒绝。修改成本高,优势 (DB 层约束) 在本场景无收益。
- **bigint currency code (ISO 4217 numeric)**: 拒绝。可读性差 (`156` vs `CNY`),需 lookup。

---

## Q2: `archivedAt` 字段 — timestamp vs boolean

### Decision
**`archivedAt timestamp NULL`**,NULL = 未归档。

### Rationale
- **单字段双语义**: 既表达"是否归档"(NULL 检查),又表达"何时归档"(审计需要)。
- **查询友好**: `WHERE archived_at IS NULL` = 未归档;`WHERE archived_at IS NOT NULL` = 已归档。
- **避免 boolean + timestamp 两字段冗余**: 每次归档/取消归档只改一个字段。
- **索引友好**: PG partial index `WHERE archived_at IS NULL` 让"默认列表"查询极快。

### Alternatives Considered
- **boolean isArchived + timestamp archivedAt**: 拒绝。冗余,两个状态可能不一致。
- **soft-delete 通用模式 (deletedAt)**: 拒绝。语义不同 —— "归档" ≠ "删除",V2 可能要恢复+展示归档列表。

---

## Q3: familyId 解析 — procedure 内联 vs middleware

### Decision
**`protectedProcedure` 已提供 user,** 在 procedure 内显式调 `loadFamilyIdByUserId(ctx.session.user.id)` 拿 familyId。**不**做独立 middleware。

### Rationale
- **每个 account procedure 都需要 familyId**,看起来适合 middleware。但:
- **查询次数最少**: 一个 procedure 内多次需要 familyId (如 create: 验证 family 存在 + 插入 account + 写 audit)。middleware 拿一次注入 ctx 即可,但若 middleware 每次都查 DB,只在需要时调函数 (lazy) 更好。
- **001 已有 loadFamilyAndMemberByUserId 函数**: 在 `src/server/db/queries/family-member.ts`,可直接复用,提取 `family.id` 字段。
- **YAGNI**: middleware 抽象层在只有 1 个 router 时是过度设计。V2 引入 transaction/category 等 router 后,若 familyId 解析成为热点,再抽 middleware。

### Implementation
```typescript
const fam = await loadFamilyAndMemberByUserId(ctx.session.user.id);
if (!fam.family) {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "用户未关联家庭" });
}
const familyId = fam.family.id;
```

### Alternatives Considered
- **protectedProcedure.use 中间件注入 ctx.familyId**: 拒绝。每个请求多一次 DB 查询 (即使 procedure 不需要);YAGNI。
- **JWT 内嵌 familyId**: 拒绝。Better-Auth session 不支持自定义 claims;改 session 形状成本高。

---

## Q4: 跨家庭访问的 404 策略实现

### Decision
**所有查询在 WHERE 子句加 `family_id = $currentFamilyId`**,即使账户 ID 在 URL 中。

### Rationale
- **SC-003 (信息泄漏防御)**: 不能先查 ID 再 check familyId (那会暴露"账户存在但无权限")。
- **正确做法**: `SELECT ... WHERE id = $accountId AND family_id = $currentFamilyId`。账户不在本家庭 → 0 行 → 抛 NOT_FOUND。
- **不需要独立 check**: 单一查询模式自然实现 404 而非 403。

### Implementation
```typescript
const rows = await db.select().from(account)
  .where(and(
    eq(account.id, input.id),
    eq(account.familyId, familyId),
  ))
  .limit(1);
if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "账户不存在" });
```

### Alternatives Considered
- **先 select by id,再 check familyId,不等则 404**: 拒绝。多一次查询 + 信息泄漏风险 (理论)。实际两者结果一致,但单一查询更简洁。
- **抛 403 FORBIDDEN**: 拒绝。违反 spec FR-012 (要求 404)。

---

## Q5: `initial_balance` bigint 在 JS 端的类型

### Decision
**Drizzle `bigint('initial_balance', { mode: 'number' })`**,JS 端用 `number`。

### Rationale
- **`mode: 'number'`**: Drizzle 自动 bigint ↔ JS number 转换。无需引入 `bigint` JS 类型。
- **安全边界**: JS number 安全整数范围 ≤ 2^53 - 1 ≈ 9 千万亿。家庭账户余额上限 9 千万亿分 ≈ 90 万亿元,远超任何家庭场景。
- **客户端 JS 直接用 number**: 无需 `bigint` polyfill;JSON 序列化无精度问题 (JSON 不区分 bigint/number)。
- **适配 currency minor units**: 余额单位"分",即使 JPY (0 位小数) 也能整数表达 (2000 JPY = 2000 分,展示时不除 100)。

### Alternatives Considered
- **`mode: 'bigint'`**: 拒绝。JS bigint 不能直接 JSON.stringify,需 `superjson` transformer 配置。复杂度增加,无实际收益 (家庭场景余额永远在 number 范围内)。
- **`numeric(12,2)` decimal**: 拒绝。Q2 (Clarification) 已选 bigint。

---

## Q6: 账户操作的审计写入时机 — procedure 内 vs Drizzle 后置 hook

### Decision
**procedure 内显式调用 `writeAccountEvent(...)`**,**不**用 Drizzle 触发器或 ORM hook。

### Rationale
- **明确性**: procedure 是业务流程的唯一入口,所有 side effect 在 procedure 内可读。Drizzle 没有原生 "after insert hook" (有 `$onUpdate` 但只对 update)。
- **事务一致性**: 审计写入与业务写入在同一 `db.transaction` 内,要么全成功要么全失败 (FR 一致性)。
- **可测试**: procedure 测试时 mock 审计函数即可,无需 mock DB 触发器。

### Implementation
```typescript
await db.transaction(async (tx) => {
  const [created] = await tx.insert(account).values({...}).returning();
  await tx.insert(accountEvent).values({
    eventType: 'account_created',
    accountId: created.id,
    actorMemberId: memberId,
    before: null,
    after: { name, currency, initialBalance },
  });
});
```

### Alternatives Considered
- **PG trigger**: 拒绝。宪章 v2.0.0 research.md Q11 已决策 (应用层钩子)。
- **Drizzle `$returning` + 后置异步写**: 拒绝。审计必须与业务同事务 (否则审计漏写但业务成功 = 安全盲点)。

---

## Q7: 币种白名单的位置 — domain 层 vs config 文件

### Decision
**`src/server/domain/account/currency.ts`** 暴露 `SUPPORTED_CURRENCIES` 常量与 `isSupportedCurrency(code)` 函数。zod schema 在 procedure input 处 import 并校验。

### Rationale
- **domain 层是纯函数 + 常量** (宪章二 Feature-Sliced),无 IO,可单元测试。
- **zod 引用 domain 常量**: `z.enum(SUPPORTED_CURRENCIES)`,单一真相源。
- **未来扩展**: V2 接入完整 ISO 4217 时,只改一处 (currency.ts),所有 procedure 自动跟随。

### Implementation
```typescript
// src/server/domain/account/currency.ts
export const SUPPORTED_CURRENCIES = ['CNY', 'USD', 'EUR', 'JPY', 'HKD', 'GBP', 'AUD', 'CAD', 'SGD'] as const;
export type Currency = typeof SUPPORTED_CURRENCIES[number];

export const CURRENCY_MINOR_UNITS: Record<Currency, number> = {
  CNY: 2, USD: 2, EUR: 2, JPY: 0, HKD: 2, GBP: 2, AUD: 2, CAD: 2, SGD: 2,
};

export function isSupportedCurrency(code: string): code is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}
```

### Alternatives Considered
- **环境变量配置**: 拒绝。币种是业务规则不是部署参数。
- **DB 表 `currencies`**: 拒绝。过度设计,V2 才需要 (那时再迁)。

---

## 总结

7 项决策,均对齐宪章 v2.0.0。无 NEEDS CLARIFICATION 残留,可进入 Phase 1 设计。
