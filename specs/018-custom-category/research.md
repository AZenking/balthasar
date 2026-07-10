# Research: 自定义分类 (018-custom-category)

**Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

> Phase 0 产物:对 plan.md Technical Context 中的所有技术决策给出**选择 + 理由 + 备选**。所有 5 个 clarify 锁定的决策在此追溯落地方式。

## 决策清单

### D1: Schema 扩展策略 —— ALTER 既有 `categories` 表 vs 新建 `custom_categories` 表

**Decision**: **ALTER 既有 `categories` 表**(新增 4 字段:`family_id` / `parent_id` / `archived_at` / `updated_at`)。

**Rationale**:
- 003 现有 `categories` 表已有 `is_built_in` 字段(默认 true),证明 003 设计时已为 V2 留了扩展位
- 内置 + 自定义共享 `id`/`name`/`type`/`icon`/`sort_order`/`created_at` 字段;新建表会重复 schema
- 下游 feature (004 transaction 引用 categoryId) 不区分 isBuiltIn,**单表查询 + JOIN** 最简
- 查询语义:"内置 + 当前家庭自定义" 一次 SELECT 完成 (WHERE family_id IS NULL OR family_id = $1)

**Alternatives Rejected**:
- ❌ 新建 `custom_categories` 表:UNION ALL 查询复杂,004 transaction 需双 JOIN,违反 YAGNI
- ❌ JSONB 列存自定义分类:失去 schema 约束 + 索引能力,违反宪章原则四 (Drizzle 类型化查询)

### D2: 审计表模式 —— 沿用 `transaction_events` 模板

**Decision**: 新建 `category_events` 表,字段沿用 `transaction_events`(id UUID v7 / event_type enum / category_id UUID FK / actor_member_id FK / before jsonb / after jsonb / occurred_at)。

**Rationale**:
- 宪章原则六 YAGNI:002/004/005(api-keys)已建 3 张同类审计表,模式稳定可复用
- `category_id` FK 用 `ON DELETE SET NULL`(分类不硬删,所以实际不会触发,但与 transaction_events 一致)
- before/after jsonb 只放**可变字段**(name/icon/sortOrder/parentId/type/archivedAt),不放 id/familyId/isBuiltIn/createdAt

**Alternatives Rejected**:
- ❌ 单一 `audit_log` 表(用 entity_type 区分):宪章原则二 feature-sliced,每 feature 独立审计表更清晰
- ❌ 不写审计:违反 FR-026 + 宪章原则三"聚合不变量必须可追溯"

### D3: emoji 库 —— 单一共享常量文件 `src/lib/constants/category-emojis.ts`

**Decision**: 新建单一常量文件,~150 个 emoji,**同时覆盖** 003 内置 22 + 018 扩充 ~128。003 seed 数据迁移到从此文件派生 (可选 refactor,V1.5 不强制)。前后端 `import` 共享。

**Rationale** (from Clarify Q3):
- 单一真相源,避免两份列表漂移
- 前端表单校验 + 后端 zod refine 共享同一常量,运行时一致
- 003 现有 seed 数据可逐步迁移 (V1.5 不强制,但 plan 建议为后续一致性)

**Alternatives Rejected**:
- ❌ 018 独立常量文件:两份列表会漂移 (e.g. 内置加了新 emoji,自定义未同步)
- ❌ 数据库表 `emoji_library`:过度工程,emoji 集是构建时常量,不应进 runtime 查询

**Implementation Hint**: 文件结构建议:
```ts
export const CATEGORY_EMOJIS = [
  // 食物 (覆盖 003 内置餐饮/零食等)
  "🍔", "🍜", "☕", "🛒", "🍺", ...
  // 交通 (覆盖 003 内置交通/打车等)
  "🚗", "🚇", "🛵", "✈️", ...
  // ... 收入、购物、医疗、教育、宠物、人情 等 ~10 类
] as const;
export type CategoryEmoji = (typeof CATEGORY_EMOJIS)[number];
export const CATEGORY_EMOJI_SET: Set<string> = new Set(CATEGORY_EMOJIS);
```

### D4: sortOrder 整数间隔 + 耗尽重排算法 (Clarify Q1)

**Decision**: 实现细节固定为:
- 新建分类默认 `sortOrder = 100`
- 拖拽到 prev ( sortOrder=A ) 与 next ( sortOrder=B ) 之间,新值 = `Math.floor((A + B) / 2)`
- 若 `Math.floor((A + B) / 2) === A` (即 B - A ≤ 1,无法再取中位),触发**同级全重排**:按当前显示顺序批量 UPDATE 为 10/20/30/.../`(N*10)`
- 全重排在单一 DB 事务内 (BEGIN ... UPDATE × N ... COMMIT)
- 允许 sortOrder 冲突 (多分类同值),次级排序 `createdAt ASC`

**Rationale**:
- 90% 拖拽是 O(1) 单行 UPDATE;10% 触发 O(N) 重排 (N < 50 性能无感)
- 浮点 (double precision) 方案理论无重排,但精度极限 (~25 次插值后耗尽) 反而更易出错
- Lexico / Fraction 方案 (Jira/Notion 用的"1a1a")实现复杂度高于本场景价值

**Alternatives Rejected**:
- ❌ 浮点中位:schema 变更 (integer → double precision) + 浮点比较精度问题
- ❌ 每次拖拽全重排:每次 O(N) UPDATE,DB 写放大
- ❌ 字符串 lexicographic (1/1a/2):实现复杂,与 003 现有 integer sortOrder 不兼容

**Algorithm Pure Function** (放 `src/server/domain/category/rules.ts`):
```ts
export function computeSortOrder(prev: number, next: number): number {
  const mid = Math.floor((prev + next) / 2);
  return mid > prev ? mid : Number.NaN; // NaN = 触发全重排
}

export function renumberSortOrders(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * 10);
}
```

### D5: 反归档父级联语义 —— 强制级联复活 (Clarify Q2)

**Decision**: 反归档父分类时,所有子分类(含此前独立归档的)统一设 `archived_at = null`。无 `archived_reason` 字段,无时间戳比较逻辑。

**Rationale**:
- 简单一致,"所见即所得",用户可预期
- 子分类失去父后无意义 (FR-017),所以归档/反归档与父绑定符合语义
- 用户若希望保持某子归档,反归档父后手动归档该子(2 步操作 vs 新增字段 + 复杂度)

**Alternatives Rejected**:
- ❌ 保留独立归档意图:需新增 `archived_reason` (independent|cascade) 或比较 archivedAt 时间戳与父归档时间;复杂度 +1 字段 + 1 套规则
- ❌ 时间戳比较:语义隐晦,边界 (毫秒级 race) 难处理

**Implementation Hint** (Drizzle transactional cascade):
```ts
await db.transaction(async (tx) => {
  await tx.update(category).set({ archivedAt: null })
    .where(eq(category.id, parentId));
  await tx.update(category).set({ archivedAt: null })
    .where(eq(category.parentId, parentId));
  // audit: write 1 event per row updated (parent + each child)
});
```

### D6: 二级分类 type 一致性 —— 应用层校验,无 DB 约束 (Clarify Q4)

**Decision**: 子分类 `type` MUST 等于父分类 `type`,由 procedure 层 zod refine + 服务端运行时校验保证。无 DB-level CHECK 约束 (因 postgres CHECK 无法跨行引用父子)。

**Rationale**:
- PostgreSQL CHECK 约束是行级的,无法跨行 ("子 type == 父 type" 是跨行约束)
- 触发器 (TRIGGER) 可实现但增加 schema 复杂度 + 调试难度
- procedure 层校验在 003/004 已是标配,zod refine 干净简洁

**Alternatives Rejected**:
- ❌ 触发器:跨行校验需 SELECT 父行,触发器内查询性能差且易死锁
- ❌ 子分类不存 type (继承):schema 简化但每次查询需 JOIN 父,004 transaction 引用分类时也要 JOIN

**Implementation** (procedure 层):
```ts
const createInput = z.object({
  type: categoryTypeEnum,
  // ...other fields
  parentId: z.string().uuid().optional(),
}).superRefine(async (val, ctx) => {
  if (val.parentId) {
    const parent = await findCategoryById(val.parentId);
    if (parent && parent.type !== val.type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "子分类 type 必须与父一致",
        path: ["type"],
      });
    }
  }
});
```

> **注**: zod refine 内部做 DB 查询不是 004 的风格(004 在 procedure body 内做校验)。但 plan 决策可走任一路径,tasks 阶段决定。

### D7: 200 上限的并发安全 —— 事务内 SELECT COUNT FOR UPDATE

**Decision**: `category.create` procedure 在事务内 `SELECT COUNT(*) FROM categories WHERE family_id = $1 FOR UPDATE`,然后判断 < 200 再 INSERT。FOR UPDATE 锁定 family 行(需 families 表行锁,或 advisory lock)。

**Rationale**:
- 002/004 没有类似 cap,本 feature 是首个需 race-safe count check 的场景
- 应用层 SELECT 然后 INSERT 在并发下有 TOCTOU race (两个并发 create 同时读到 199,都通过,都插入,最终 201)
- Postgres advisory lock (`pg_advisory_xact_lock(hashtext(family_id))`)是最简洁方案:family 级互斥,事务结束自动释放

**Alternatives Rejected**:
- ❌ 信任 + 软上限:UI 警告 + 服务端记 log,允许临时超 200 —— 违反 FR "超出返回 400" 硬约束
- ❌ DB trigger 检查 count:递归查询慢 + 触发器调试难
- ❌ 物化视图 (family_category_count):同步成本不值

**Implementation Hint**:
```ts
await db.transaction(async (tx) => {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${familyId}))`);
  const [{ count }] = await tx
    .select({ count: count() })
    .from(category)
    .where(and(
      eq(category.familyId, familyId),
      isNull(category.archivedAt),  // 或包含归档,见 spec assumption
    ));
  if (Number(count) >= 200) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "自定义分类数已达上限 200" });
  }
  // ... INSERT
});
```

> **澄清**: spec assumption 写"200 (含归档)",所以 WHERE 条件去掉 `isNull(archivedAt)`,统计所有 family_id 匹配的非内置分类。

### D8: 层级 list 查询 —— 单次 SELECT + 应用层组树

**Decision**: `category.list` 一次 SELECT 取出所有可见分类(内置 family_id IS NULL + 当前家庭 family_id = $1,active),按 (parent_id NULL FIRST, sort_order, created_at) 排序;应用层 O(N) 组树 (顶级数组 + children 嵌套)。

**Rationale**:
- 单家庭 < 100 分类 + 22 内置 < 122 行,单次 SELECT + 内存组树 P95 < 50ms 远低于 150ms SLA
- 递归 CTE (WITH RECURSIVE) 在 2 层深度下是过度工程;3 层以上才显优势
- 应用层组树逻辑简单,易测试 (纯函数 `buildCategoryTree(flatList): TreeNode[]`)

**Alternatives Rejected**:
- ❌ 递归 CTE:语法复杂,Drizzle 支持但易错,深度 2 不必要
- ❌ 双查询 (一次取顶级,一次取二级):多 1 个 RTT,P95 上升
- ❌ JSONB 列存 children:更新成本高,失去扁平索引

**Algorithm Pure Function** (放 `src/server/domain/category/rules.ts`):
```ts
export function buildCategoryTree<C extends { id: string; parentId: string | null }>(
  flat: C[],
): Array<C & { children: C[] }> {
  const byId = new Map(flat.map((c) => [c.id, { ...c, children: [] as C[] }]));
  const roots: Array<C & { children: C[] }> = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
```

### D9: 迁移策略 —— 增量 ALTER + 索引重建

**Decision**: 迁移文件 `0006_category_v15_extensions.sql` 做 4 件事:
1. `ALTER TABLE categories ADD COLUMN family_id uuid REFERENCES families(id), parent_id uuid REFERENCES categories(id), archived_at timestamptz, updated_at timestamptz DEFAULT now()`
2. `CREATE INDEX categories_family_type_parent_sort_idx ON categories (family_id, type, parent_id, sort_order, created_at)`
3. `CREATE UNIQUE INDEX categories_family_type_parent_name_idx ON categories (COALESCE(family_id, '00000000-0000-0000-0000-000000000000'::uuid), type, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), LOWER(name))` — 处理 NULL familyId/parentId 的唯一性
4. `CREATE TABLE category_events ...` (参照 transaction_events)
5. `CREATE TYPE category_event_type AS ENUM ('category_created', 'category_edited', 'category_archived', 'category_unarchived')`

**Rationale**:
- 003 现有 `categories_name_type_unique_idx` 是 (name, type) 唯一,只适用于"全局唯一"(内置场景);自定义分类需 family-scoped 唯一,新加一个 expression index
- `COALESCE` 把 NULL 转为 sentinel UUID,因为 PostgreSQL UNIQUE 索引对 NULL 不去重 (多 NULL 视为不同)
- `LOWER(name)` 实现 case-insensitive (Clarify implied trim 在应用层做,DB 只做 lower)

**Alternatives Rejected**:
- ❌ Drop + recreate 表:破坏 003 现有数据 + 004 transaction 外键
- ❌ 新表 + 视图:增加查询复杂度,违反 D1 决策

### D10: 大小写不敏感 + trim 的唯一性 —— 应用层 trim + DB LOWER 索引

**Decision**: 应用层在 zod schema 内 `z.string().trim()` 处理前后空格;DB 索引用 `LOWER(name)` 表达式实现大小写不敏感。

**Rationale**:
- DB 层 trim 会增加索引复杂度 + 性能成本
- LOWER 索引是 PostgreSQL 标准模式,Drizzle 原生支持
- 应用层 trim 在 zod 内统一,前端入参前已 trim

### D11: 自定义分类 ID 生成 —— UUID v7 (随机)

**Decision**: 自定义分类 `id` 用 UUID v7 (与 004 transaction 一致,`uuidv7()` 包),保留 003 内置分类的 v5 确定性 ID。

**Rationale**:
- 自定义分类无需跨环境一致(用户运行时创建,v5 反而需要额外协调)
- v7 时间排序,利于后续按时间分页/审计
- 004 已用 v7,模式一致

### D12: parentId 循环引用防护 —— 应用层校验

**Decision**: 编辑 parentId 时,procedure 层校验 `parentId !== self.id`(自引用)。深度 ≤ 2 的限制由"父必须是顶级"校验保证 (FR-005(b)),不需 walk-up 链。

**Rationale**:
- 二级深度上限保证循环不可能 (A→B→A 需要 3 层)
- 唯一边界:自引用 A→A,简单 if 校验即可
- 不需 DB 约束 (CHECK 无法表达) 或图算法

### D13: 003 向后兼容策略 —— 内置分类冻结

**Decision**: 003 现有 22 个内置分类:
- 保留 v5 ID (不变)
- 保留现有 name/type/icon/sortOrder/createdAt (不变)
- 通过迁移回填: `family_id = NULL, parent_id = NULL, archived_at = NULL, updated_at = created_at`
- `is_built_in = true` (已是默认值,不需回填)

**Rationale**:
- 004 transaction 通过 categoryId 引用内置分类,改变 ID 会破坏引用
- 新字段全部可空,迁移零风险
- 内置分类查询行为 (003 的 list/get) 在 schema 扩展后**完全保持** (新字段对老查询透明)

## 总结:无 NEEDS CLARIFICATION 残留

所有 13 个技术决策已锁定,可在 Phase 1 (data-model + contracts) 直接落地。无阻塞性研究项。
