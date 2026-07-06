# Phase 0 Research: 003-category

**Date**: 2026-07-06
**Status**: Complete
**Source spec**: [spec.md](./spec.md)
**Source plan**: [plan.md](./plan.md)

本 feature 复用 001/002 的技术栈 (T3 + Drizzle + Better-Auth + PostgreSQL),Phase 0 决策聚焦于 003-category 特有的设计点。宪章 v2.0.0 是权威约束。

---

## Q1: 内置分类数据注入方式 — 迁移 SQL seed vs JS 脚本 vs 运行时 lazy init

### Decision
**迁移 SQL seed** —— `0003_categories.sql` 包含 `CREATE TABLE` + `INSERT ... ON CONFLICT DO NOTHING` 22 条内置分类。

### Rationale
- **幂等性**: `ON CONFLICT (id) DO NOTHING` 保证多次 `pnpm db:migrate` 不重复插入。即使开发期反复重建数据库,数据集始终一致。
- **跨环境一致**: 同一份 SQL 在开发/测试/生产都注入相同数据,前端缓存的 ID 不会因环境不同而失效 (FR-011)。
- **审计可见**: 数据集在 git 中以 SQL 形式存在,review 时一目了然。JS 脚本则分散在代码里,数据集演变难追踪。
- **无需运行时引导**: 服务器启动后立即有数据,不存在"启动时种子未跑完"的中间态。
- **与 001/002 一致**: 001/002 都用 Drizzle migration SQL,本 feature 沿用相同模式。

### Alternatives Considered
- **JS seed 脚本** (启动时跑 `seed.ts`): 拒绝。多一个启动步骤,容器编排复杂度增加;幂等性需要应用层保证。
- **运行时 lazy init** (首次访问时检查并插入): 拒绝。首次请求慢;并发首次访问可能重复插入。
- **手动 SQL 文件不进迁移** (`scripts/seed.sql`): 拒绝。脱离 Drizzle 迁移历史,生产部署时易遗漏。

---

## Q2: 内置分类的 ID 生成 — UUID v5 vs UUID v7 vs 短码

### Decision
**UUID v5 (name + type 在固定命名空间)**,使用 npm `uuid` 包。

```typescript
import { v5 as uuidv5 } from "uuid";
const NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"; // DNS namespace (RFC 4122)
const id = uuidv5(`${type}:${name}`, NAMESPACE); // e.g. "expense:餐饮" → 确定性 UUID
```

### Rationale
- **确定性 (FR-011, SC-005)**: 相同 name+type 在任何环境生成相同 UUID。开发期前端缓存 `expense:餐饮 → 019f...` 在生产环境同样有效。
- **幂等 seed (FR-009)**: 多次跑 seed SQL,`ON CONFLICT (id) DO NOTHING` 自然去重,因为 ID 是确定性的。
- **无需持久化 ID 列表**: 通过 name+type 即可反推 ID,跨工具 (前端/后端/迁移脚本) 共享一份 name+type → ID 映射逻辑。
- **抗碰撞**: UUID v5 SHA-1 哈希,22 个分类无碰撞风险。
- **复用 RFC 4122 标准 namespace**: 用 DNS namespace (`6ba7b810-...`),无需自定义 namespace UUID。

### Alternatives Considered
- **UUID v7** (时间有序,与 001/002 业务表一致): 拒绝。v7 是随机的,无法保证跨环境一致,违反 FR-011。
- **slug 短码** (如 `"food"`, `"transport"`): 拒绝。需要保证全局唯一,且国际化时 slug 可能不稳定 (英文 slug vs 中文名)。
- **自增 int**: 拒绝。暴露数据集大小、不利分库、不利跨实例合并 (与 001 决策一致)。

---

## Q3: 内置分类数据集 — 具体分类列表

### Decision

**22 个内置分类** (12 expense + 8 income + 2 其他):

#### 支出 expense (12 个,sortOrder 100-1200)

| sortOrder | name | icon |
|---|---|---|
| 100 | 餐饮 | 🍔 |
| 200 | 交通 | 🚗 |
| 300 | 购物 | 🛍️ |
| 400 | 住房 | 🏠 |
| 500 | 水电煤 | 💡 |
| 600 | 通讯 | 📱 |
| 700 | 医疗 | 💊 |
| 800 | 娱乐 | 🎮 |
| 900 | 教育 | 📚 |
| 1000 | 服饰 | 👕 |
| 1100 | 人情 | 🎁 |
| 1200 | 其他支出 | 💸 |

#### 收入 income (8 个,sortOrder 100-800)

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

#### 其他 (2 个)

> 注:V2 引入"转账" (transfer) 类型时,再加 "账户转账" 分类。MVP 严格 income|expense,无 transfer。

总数: 12 + 8 = 20,符合 FR-007 ≥ 20 与 SC-002 (≥12 expense) + SC-003 (≥5 income) 要求。

### Rationale
- **覆盖 PRD 10 秒记账常见场景**: 中国家庭主流记账分类 (与随手记/鲨鱼记账等成熟 App 对齐)。
- **icon 用 emoji**: 跨平台显示稳定,无需 SVG 资源管理 (spec Assumptions 已定)。
- **sortOrder 100 间隔**: 留出余地,V2 用户自定义分类可插入 105/110 等中间值,不必重排。
- **"其他"分类兜底**: 用户遇到不在内置列表的场景,可选"其他支出/收入",避免强制选错。

### Alternatives Considered
- **完整 OWASP-style 字典**: 拒绝。家庭场景 < 30 个分类足够,过多选项反而降低记账速度 (违反 PRD "10 秒")。
- **图标用 SVG path**: 拒绝。增加 22 个 SVG 资源管理负担,emoji 足够 MVP。
- **不提供"其他"**: 拒绝。用户遇到没列出的场景会强行选错,统计失真。

---

## Q4: type 字段存储 — pgEnum vs text + zod enum

### Decision
**pgEnum `category_type`** (与 002 accountEventType 模式一致),值: `income`, `expense`。

### Rationale
- **DB 层强制枚举**: pgEnum 不允许插入非法值,即使应用层 zod 漏校验,DB 兜底。
- **与 002 accountEventType 一致**: 项目已有 pgEnum 模式 (account_event_type),复用约定。
- **V2 加 transfer 时迁移成本低**: `ALTER TYPE category_type ADD VALUE 'transfer'` 是 PG 14+ 支持的不可逆但简单操作。
- **查询友好**: `WHERE type = 'expense'` 比 `WHERE type::text = 'expense'` 更直接。

### Alternatives Considered
- **text + zod enum (002 account.currency 模式)**: 拒绝。currency 是因为扩展灵活 (用户加新币种),category type 是固定枚举 (income|expense 永远只有这两个),pgEnum 更合适。
- **boolean isIncome**: 拒绝。语义模糊,V2 加 transfer 时无法表达。
- **预留 transfer 在 pgEnum**: 拒绝。YAGNI,V2 真需要时 `ALTER TYPE ADD VALUE` 即可。

---

## Q5: `category.list` 排序 — DB 层 vs 应用层

### Decision
**DB 层 ORDER BY** `sort_order ASC, name ASC`,Drizzle `.orderBy()`。

### Rationale
- **数据集固定**: 内置分类 < 30 条,DB 排序几乎零成本。
- **索引利用**: 索引 `(type, sort_order, name)` 让带 type 过滤的查询直接走索引扫描有序输出,无需 sort。
- **应用层无需重排**: tRPC procedure 直接返回 DB 结果,代码简洁。
- **与 002 list 一致**: 002 account.list 也是 DB 层 ORDER BY。

### Alternatives Considered
- **应用层 sort**: 拒绝。多一步代码,DB 已有索引。
- **前端 sort**: 拒绝。前端按 sortOrder 排序与后端不一致风险,且每次渲染都排序。

---

## Q6: 跨家庭一致性 — 是否需要 familyId 字段

### Decision
**不**加 `family_id` 字段。categories 表是全局共享字典。

### Rationale
- **MVP 范围 (FR-007 + Assumptions)**: 内置分类所有家庭共享,无家庭级数据。
- **V2 自定义分类时再迁移**: 加 `family_id NULL` 字段,NULL = 内置,非 NULL = 自定义。向后兼容。
- **简化查询**: 无需 WHERE family_id 过滤,所有家庭看到同一份。
- **YAGNI**: 现在不加,避免无谓的索引和 join 成本。

### Alternatives Considered
- **加 family_id NULL,内置=NULL**: 拒绝。MVP 没有自定义分类,NULL 字段是 dead column。
- **加 family_id NOT NULL with sentinel**: 拒绝。hack 模式,可读性差。

---

## Q7: `category.get` 是否需要 — list 已能查到

### Decision
**保留** `category.get({ id })` 单查 procedure (US2)。

### Rationale
- **API 完整性**: RESTful 风格的字典 API 通常提供 list + get 两个端点,前端可能在不同场景调不同接口。
- **性能优化路径**: list 返回完整列表 (~22 条),前端可能只需要一个 ID 的详情,get 单查避免拉全表 (虽然 MVP 内置 < 30 条,list 性能也够,但保留 get 是 API 设计卫生)。
- **未来扩展**: V2 自定义分类可能达到几百条,list 不再适合"查一个"场景,get 必备。
- **实施成本低**: 单查约 5 行代码 + 1 个测试,几乎免费。

### Alternatives Considered
- **只提供 list,前端 list 后本地过滤**: 拒绝。违反 API 完整性,前端代码多写。
- **get 用 batch 接口 `category.getByIds({ ids: [] })`**: 拒绝。YAGNI,V2 评估。

---

## Q8: 内置分类的 `created_at` 时间戳

### Decision
**迁移时统一设为迁移执行时刻** (`now()`),不刻意设为某个固定时间。

### Rationale
- **created_at 仅作记录**: 不参与业务逻辑,前端不展示。
- **避免硬编码时间**: 设固定时间 (如 epoch) 会让人误以为是某种特殊语义。
- **`default now()` 在 INSERT 时自动填充**: 与 001/002 模式一致。

### Alternatives Considered
- **固定 epoch 0**: 拒绝。语义不清。
- **NULL**: 拒绝。NOT NULL 约束更强,与 schema 风格一致。

---

## 总结

8 项决策,均对齐宪章 v2.0.0。无 NEEDS CLARIFICATION 残留,可进入 Phase 1 设计。

**核心模式**: read-only 字典,迁移 SQL seed + UUID v5 确定性 ID + pgEnum type + 共享全局表。实施成本约 002-account 的 1/3。
