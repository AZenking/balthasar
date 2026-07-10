# Quickstart: 自定义分类 (018-custom-category)

**Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md) | **Contracts**: [contracts/category-procedures.md](./contracts/category-procedures.md)

> Phase 1 产物: runnable validation scenarios,证明 feature 端到端可用。**不含**实现代码、迁移 SQL、完整测试套件 —— 这些归 `tasks.md` 与实现阶段。

## 前置依赖

- 001-auth-family (用户/家庭/成员) ✅ 已交付
- 002-account (account_events 审计模式参考) ✅ 已交付
- 003-category (22 内置分类 + 只读 list/get) ✅ 已交付
- 004-transaction (transaction 引用 categoryId,type 一致性约束) ✅ 已交付
- 集成测试环境: testcontainers + 真实 PostgreSQL 16 (宪章原则四禁止 mock DB)

## Setup

```bash
# 1. 切到 feature 分支
git checkout feat/018-custom-category

# 2. 装依赖 (零新增 npm 依赖,沿用 003/004 既有: drizzle-orm / uuidv7 / zod)
pnpm install

# 3. 跑迁移 (含 0006_category_v15_extensions.sql)
pnpm db:migrate

# 4. 跑 type-check + 测试
pnpm tsc --noEmit
pnpm test -- category
```

## 验证场景

### 场景 1: 内置分类向后兼容 (003 零破坏)

**目的**: 验证 schema 扩展后,003 已有的 22 个内置分类行为不变。

**步骤**:
1. 调 `trpc.category.list.useQuery()` (无参,沿用 003 旧调用方式)
2. 调 `trpc.category.get.useQuery({ id: <003 内置分类 ID> })`

**预期**:
- list 返回 ≥ 22 个内置分类,字段含 003 既有 (id/name/type/icon/sortOrder/isBuiltIn/createdAt) + 018 新增 (familyId=null, parentId=null, archivedAt=null, updatedAt=createdAt)
- get 单条返回同上
- 004 已有交易 (引用内置 categoryId) 在 dashboard 聚合时,金额分类聚合结果**迁移前后一致** (无人为偏差)

**通过条件**: 003 的所有 procedure 测试 (`src/tests/procedure/category.test.ts` 既有用例) 全绿。

---

### 场景 2: 新增自定义分类 (golden path)

**目的**: 验证 P1 核心流程 —— 创建一个自定义支出分类。

**步骤**:
```ts
// 1. 创建顶级自定义分类
const created = await trpc.category.create.mutateAsync({
  type: "expense",
  name: "宠物用品",
  icon: "🐾",
});
// 2. 列表查询验证
const list = await trpc.category.list.query({ type: "expense" });
// 3. 创建一笔交易使用该分类
const tx = await trpc.transaction.create.mutateAsync({
  type: "expense",
  accountId: "...",
  categoryId: created.id,  // 自定义分类 ID
  amount: 8800,  // 88.00 元
  remark: "狗粮 5kg",
});
```

**预期**:
- create 返回 id (UUID v7), familyId = 当前家庭 ID, isBuiltIn = false, archivedAt = null
- list 含内置 expense + 新创建的自定义,按 sortOrder ASC + createdAt ASC 排序
- transaction.create 成功 (categoryId 校验通过,与内置分类行为一致)
- `category_events` 表新增一条 `category_created` 事件,actor_member_id = 当前成员,after jsonb 含新分类可变字段快照

**通过条件**: 全部断言通过 + `pnpm test -- category/create` 全绿。

---

### 场景 3: 二级分类 + type 一致性 (FR-005(d))

**目的**: 验证子分类 type MUST 等于父分类,违反被拒。

**步骤**:
```ts
// 1. 创建顶级 expense 分类
const parent = await trpc.category.create.mutateAsync({
  type: "expense", name: "人情", icon: "🎁",
});
// 2. 创建二级 expense 子分类 (应成功)
const childOk = await trpc.category.create.mutateAsync({
  type: "expense", name: "婚礼红包", icon: "💍", parentId: parent.id,
});
// 3. 尝试创建 income 二级子分类 (应失败)
try {
  await trpc.category.create.mutateAsync({
    type: "income", name: "收礼", icon: "💰", parentId: parent.id,
  });
} catch (e) {
  // 期望: TRPCError BAD_REQUEST, message: "子分类 type 必须与父一致"
}
```

**预期**:
- 步骤 2 返回 201,childOk.parentId === parent.id,childOk.type === "expense"
- 步骤 3 抛 BAD_REQUEST,zod issue path = ["type"]

**通过条件**: `pnpm test -- category/create --grep "type-match"` 全绿。

---

### 场景 4: 归档父级联 + 强制级联复活 (FR-017 + Clarify Q2)

**目的**: 验证归档父 → 子同步归档;反归档父 → 所有子强制复活(含此前独立归档的)。

**步骤**:
```ts
// 1. 建父 + 2 子
const parent = await create({ type: "expense", name: "人情", icon: "🎁" });
const childA = await create({ type: "expense", name: "婚礼", icon: "💍", parentId: parent.id });
const childB = await create({ type: "expense", name: "生日", icon: "🎂", parentId: parent.id });

// 2. 独立归档 childA
await archive({ id: childA.id });  // childA.archivedAt = T1

// 3. 归档父 → 级联归档 childB (childA 已归档不变,仍 T1)
const { archivedChildren } = await archive({ id: parent.id });
// archivedChildren = [childB.id]  (childA 不在,因已归档)

// 4. 反归档父 → 强制级联复活所有子 (含 childA 此前独立归档的)
const { unarchivedChildren } = await unarchive({ id: parent.id });
// unarchivedChildren = [childA.id, childB.id]  (强制复活,无视为 prior state)

// 5. 若用户希望保持 childA 归档,反归档父后手动归档:
await archive({ id: childA.id });
```

**预期**:
- 步骤 3 后:list 不含 parent / childA / childB;list({ includeArchived: true }) 含三者
- 步骤 4 后:list 重新含三者;childA.archivedAt = null (强制复活)
- category_events 写入 6 条事件 (1 archive parent + 1 archive childB + 1 unarchive parent + 1 unarchive childA + 1 unarchive childB + 1 final archive childA)
- 全部在 4 个独立事务内,无部分失败

**通过条件**: `pnpm test -- category/archive --grep "cascade"` 全绿。

---

### 场景 5: 跨家庭隔离 (FR-023)

**目的**: 验证家庭 A 看不到家庭 B 的自定义分类。

**步骤**:
```ts
// 用户 1 (家庭 A) 创建自定义分类
loginAs(userA);
const catA = await create({ type: "expense", name: "A 的私分类", icon: "🔒" });

// 用户 2 (家庭 B) 尝试访问
loginAs(userB);
const listB = await list({});  // 不含 catA
try {
  await get({ id: catA.id });    // 404
} catch (e) {
  // 期望: TRPCError NOT_FOUND (不暴露存在性)
}
try {
  await update({ id: catA.id, name: "篡改" });  // 404
} catch (e) { /* NOT_FOUND */ }
try {
  await archive({ id: catA.id });  // 404
} catch (e) { /* NOT_FOUND */ }
```

**预期**:
- 家庭 B 的 list 仅含 22 内置分类 (家庭 A 的自定义不可见)
- 所有 CRUD 跨家庭访问返回 404 (非 403,不暴露存在性)

**通过条件**: `pnpm test -- category/cross-family` 全绿。

---

### 场景 6: 内置分类不可写 (FR-008/018/012)

**目的**: 验证 22 内置分类 (isBuiltIn=true) 拒绝任何写操作。

**步骤**:
```ts
const builtin = (await list({})).find(c => c.isBuiltIn);

try { await update({ id: builtin.id, name: "篡改" }); } catch (e) { /* 403 */ }
try { await archive({ id: builtin.id }); } catch (e) { /* 403 */ }
try { await unarchive({ id: builtin.id }); } catch (e) { /* 403 */ }
// create 不传 isBuiltIn (服务端派生 = false),无相关测试
```

**预期**: 所有写操作对内置分类返回 `FORBIDDEN` (403),message: "内置分类不可 [编辑/归档/反归档]"

**通过条件**: `pnpm test -- category --grep "built-in"` 全绿。

---

### 场景 7: sortOrder 拖拽策略 (FR-031 + Clarify Q1)

**目的**: 验证整数间隔 + 耗尽重排算法。

**步骤**:
```ts
// 1. 建 3 个同级分类,默认 sortOrder=100,按 createdAt ASC 排
const a = await create({ type: "expense", name: "A", icon: "📍" });  // sortOrder=100
const b = await create({ type: "expense", name: "B", icon: "📍" });  // sortOrder=100, 排在 A 后
const c = await create({ type: "expense", name: "C", icon: "📍" });  // sortOrder=100, 排在 B 后

// 2. 把 c 拖到 a 和 b 之间:中位 = floor((100+100)/2) = 100,与 prev 相同 → 触发全重排
//    或:用不同 sortOrder 避免冲突
await update({ id: a.id, sortOrder: 10 });
await update({ id: b.id, sortOrder: 20 });
await update({ id: c.id, sortOrder: 15 });  // 中位 = floor((10+20)/2) = 15 ✓ 无重排

// 3. 多次插入耗尽间隔:在 10 和 15 之间反复插
//    e.g. d → floor((10+15)/2) = 12 ✓
//    e → floor((10+12)/2) = 11 ✓
//    f → floor((10+11)/2) = 10 = prev ❌ 触发同级全重排 (10/20/30/40/50/60)
```

**预期**:
- 步骤 2 后:a.sortOrder=10, c.sortOrder=15, b.sortOrder=20,list 顺序 [a, c, b]
- 步骤 3 触发全重排后:6 个分类的 sortOrder 为 10/20/30/40/50/60 (按当时显示顺序)
- 全重排在单一事务内 (BEGIN ... UPDATE × N ... COMMIT),部分失败回滚

**通过条件**:
- `pnpm test -- unit/domain/category-rules` (纯函数 `computeSortOrder` / `renumberSortOrders`) 全绿
- `pnpm test -- category/update --grep "sortOrder"` (procedure 集成) 全绿

---

### 场景 8: 200 上限 (FR assumption + Clarify Q7)

**目的**: 验证单家庭 200 自定义分类硬上限 + 并发安全。

**步骤**:
```ts
// 1. 批量创建 200 个 (循环)
for (let i = 0; i < 200; i++) {
  await create({ type: "expense", name: `分类${i}`, icon: "📍" });
}

// 2. 第 201 个应失败
try {
  await create({ type: "expense", name: "超限", icon: "📍" });
} catch (e) {
  // 期望: TRPCError BAD_REQUEST, message: "自定义分类数已达上限 200"
}

// 3. 并发安全 (race condition 验证)
// 在 199 个分类状态下,10 个并发 create,只有 1 个成功,其余 400/409
```

**预期**:
- 单线程:第 201 个返回 400
- 并发:advisory lock 保证最多 1 个越过 200,其余拒绝 (400 上限 或 409 重名 race)

**通过条件**: `pnpm test -- category/create --grep "cap"` 全绿,含并发场景。

---

### 场景 9: 审计日志完整性 (FR-026 + Clarify Q5)

**目的**: 验证每个写操作产生 1 条 category_events,且永久保留。

**步骤**:
```ts
// 跑场景 2-7 的所有写操作,然后查询 category_events
const events = await db.select().from(categoryEvent).orderBy(occurredAt);
```

**预期**:
- 每个 create/update/archive/unarchive 对应 1 条事件
- 级联归档/反归档:父 + 每个子各 1 条 (e.g. 父带 3 子归档 = 4 条)
- 事件含 before/after jsonb,仅可变字段 (无 id/familyId/isBuiltIn/createdAt/updatedAt)
- 内置分类的查询/被 JOIN 不产生事件 (与 003-assumptions 一致)
- 90 天 / 1 年后事件仍在 (永久保留,无 cleanup job)

**通过条件**: `pnpm test -- category/audit` 全绿。

---

## 性能验证 (FR-027 SLA)

```bash
# 用 p95 基准测试工具 (vitest + 自定义 benchmark)
pnpm test -- category/perf
```

**预期 P95** (单家庭 22 内置 + 50 自定义 + 200 事件):
- `category.create` < 200ms (含 advisory lock + count + INSERT + audit)
- `category.update` < 200ms (含 type-match 校验 + transactions 引用检查 + UPDATE + audit)
- `category.list` (合并 + 层级) < 150ms (单次 SELECT + 内存组树 ~72 行)
- `category.archive` (父 + 5 子级联) < 200ms (单事务 6 UPDATE + 6 audit INSERT)

## 端到端 (UI) 验证

> 本 feature 含分类管理页 UI (`/settings/categories`),drag-and-drop 排序,emoji picker。

**手动验证** (浏览器):
1. 登录 → 进入 `/settings/categories`
2. 看到内置分类 (灰锁图标,只读) + 自定义分类 (可编辑)
3. 点"新增分类" → 表单: type radio / name input / emoji picker / parent select / sortOrder
4. 提交 → 列表更新,新分类出现在末尾 (sortOrder=100,createdAt 最新)
5. 拖拽排序 → 顺序更新,刷新后保持
6. 点"归档" → 分类从列表消失 (默认 hide archived),勾选"显示已归档"可见
7. 创建使用已归档分类的历史交易 → 在 `transaction.get` 仍能 JOIN 出 categoryName (归档 ≠ 删除引用)

**通过条件**: golden path 无 console error,Network 面板无 5xx,刷新后状态一致。

## 不验证的内容 (Out of Scope)

- ❌ purge / 硬删 (V2)
- ❌ 分类合并 (V2)
- ❌ 图标上传 (不实现)
- ❌ 三级分类 (深度限制 ≤ 2)
- ❌ 分类建议 / AI 推荐 (V2)
- ❌ 隐藏内置分类 (内置永远可见)
- ❌ family 角色权限 (MVP 所有家庭成员均可管理)
