# Data Model: 003-category

**Date**: 2026-07-06
**Source**: [spec.md](./spec.md) + [plan.md](./plan.md) + [research.md](./research.md)

本 feature 新增 **1 张表** + **22 条种子数据**。与 001 的 8 张表 + 002 的 2 张表共存。

---

## 实体关系图

```text
┌──────────────────────────┐
│   categories (新建)       │
│   ─────────────────       │
│   id (UUID v5 PK)         │  ← 确定性,基于 name+type 命名空间
│   name (text NOT NULL)    │
│   type (enum NOT NULL)    │  ← pgEnum: income | expense
│   icon (text NOT NULL)    │  ← emoji 1-4 UTF-16 code units
│   sort_order (int)        │  ← UI 排序,默认 100
│   is_built_in (boolean)   │  ← MVP 全部 true,V2 引入自定义时用
│   created_at (timestamp)  │
└──────────────────────────┘
        ↑
        │ (无 family_id,所有家庭共享)
        │
    被 004-transaction 引用 (后续 feature)
```

**与其他表的关系**:
- 无直接 FK 关系 (categories 不引用 families/users/accounts)
- 后续 `004-transaction` 会引用 `category.id` 作为外键

---

## 表定义

### `categories` — 内置分类字典

Drizzle schema 路径: `src/server/db/schema/category.ts`

| 字段 | 类型 | 约束 | 备注 |
|---|---|---|---|
| `id` | uuid | PK | UUID v5 确定性,research.md Q2 |
| `name` | text | NOT NULL, length 1-30 | 中文名 |
| `type` | `category_type` enum | NOT NULL | pgEnum,值 `income` / `expense` (research.md Q4) |
| `icon` | text | NOT NULL | emoji,1-4 UTF-16 code units (SC-008) |
| `sort_order` | integer | NOT NULL, default 100 | UI 排序键 |
| `is_built_in` | boolean | NOT NULL, default true | MVP 全 true,V2 自定义分类时用 |
| `created_at` | timestamptz | NOT NULL, default now() | |

**索引**:
- `categories_pkey` (id) — 主键,PK 自动
- `idx_categories_type_sort_name (type, sort_order, name)` — 支撑 `category.list({ type })` 查询,索引扫描有序输出 (research.md Q5)

**唯一约束**:
- `uq_categories_name_type (name, type)` — 防止同名同类重复插入,seed SQL 的 `ON CONFLICT` 兜底

---

## 种子数据 (22 条)

通过 `0003_categories.sql` 在迁移时注入,使用 `INSERT ... ON CONFLICT (id) DO NOTHING` 保证幂等 (research.md Q1)。

### 支出 expense (12 条)

| sortOrder | name | icon | ID 派生 (UUID v5) |
|---|---|---|---|
| 100 | 餐饮 | 🍔 | v5("expense:餐饮", DNS_NAMESPACE) |
| 200 | 交通 | 🚗 | v5("expense:交通", DNS_NAMESPACE) |
| 300 | 购物 | 🛍️ | v5("expense:购物", DNS_NAMESPACE) |
| 400 | 住房 | 🏠 | v5("expense:住房", DNS_NAMESPACE) |
| 500 | 水电煤 | 💡 | v5("expense:水电煤", DNS_NAMESPACE) |
| 600 | 通讯 | 📱 | v5("expense:通讯", DNS_NAMESPACE) |
| 700 | 医疗 | 💊 | v5("expense:医疗", DNS_NAMESPACE) |
| 800 | 娱乐 | 🎮 | v5("expense:娱乐", DNS_NAMESPACE) |
| 900 | 教育 | 📚 | v5("expense:教育", DNS_NAMESPACE) |
| 1000 | 服饰 | 👕 | v5("expense:服饰", DNS_NAMESPACE) |
| 1100 | 人情 | 🎁 | v5("expense:人情", DNS_NAMESPACE) |
| 1200 | 其他支出 | 💸 | v5("expense:其他支出", DNS_NAMESPACE) |

### 收入 income (8 条)

| sortOrder | name | icon |
|---|---|---|
| 100 | 工资 | 💰 |
| 200 | 奖金 | 🎉 |
| 300 | 理财收益 | 📈 |
| 400 | 兼职 | 💼 |
| 500 | 报销 | 🧾 |
| 600 | 红包 | 🧧 |
| 700 | 退款 | ↩️ |
| 800 | 其他收入 | 💵 |

**总数**: 12 + 8 = 20 条 (满足 FR-007 ≥ 20,SC-002 ≥ 12 expense,SC-003 ≥ 5 income)。

**ID 计算示例** (在 `tasks.md` 实施时通过脚本生成):
```sql
-- 餐饮 (expense)
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in)
VALUES ('<v5-output>', '餐饮', 'expense', '🍔', 100, true)
ON CONFLICT (id) DO NOTHING;
```

---

## Drizzle schema 模板

`src/server/db/schema/category.ts`:

```typescript
import { pgTable, uuid, text, integer, boolean, timestamp, pgEnum, uniqueIndex, index } from "drizzle-orm/pg-core";

export const categoryType = pgEnum("category_type", [
  "income",
  "expense",
]);

export const category = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    type: categoryType("type").notNull(),
    icon: text("icon").notNull(),
    sortOrder: integer("sort_order").notNull().default(100),
    isBuiltIn: boolean("is_built_in").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    typeSortNameIdx: index("categories_type_sort_name_idx").on(t.type, t.sortOrder, t.name),
    nameTypeUniqueIdx: uniqueIndex("categories_name_type_unique_idx").on(t.name, t.type),
  })
);

export type Category = typeof category.$inferSelect;
```

---

## 不变量与约束总览

| 不变量 | 来源 | 验证方式 |
|---|---|---|
| `type ∈ {income, expense}` | FR-002 | DB pgEnum 强制 + 集成测试断言 |
| 内置分类数量 ≥ 20 | FR-007, SC-001 | 集成测试 COUNT |
| expense 分类 ≥ 12 | SC-002 | 集成测试 `WHERE type='expense'` COUNT |
| income 分类 ≥ 5 | SC-003 | 集成测试 `WHERE type='income'` COUNT |
| ID 跨环境稳定 | FR-011, SC-005 | 集成测试: 重新跑 seed,ID 不变 |
| seed 幂等 | FR-009 | 集成测试: 跑两次 seed, COUNT 仍 = 20 |
| 内置分类只读 | FR-010 | DB 无 UPDATE/DELETE 接口 (procedure 层不暴露) |
| `category.list` P95 < 100ms | FR-012, SC-004 | 集成测试性能断言 |
| `name` 长度 1-30 | SC-006 | 单元测试 seed 数据集 |
| `icon` UTF-16 ≤ 4 | SC-008 | 单元测试 seed 数据集 |

---

## 与 001/002 schema 的衔接

- **复用** `db` 客户端单例、UUID 工具
- **不动** 001 的 8 张表 / 002 的 2 张表 schema
- **新增迁移** `0003_categories.sql`,只 CREATE 1 张表 + INSERT 22 条种子
- **运行 `pnpm db:migrate`** 应用,无需重建前序数据

---

## 下一阶段

- `contracts/README.md`: tRPC 2 个 procedure 入口说明
- `quickstart.md`: 端到端验证脚本
- `tasks.md` (/speckit-tasks): 按本 schema 与 router 落地任务清单
