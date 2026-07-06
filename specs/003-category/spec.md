# Feature 规约: 分类管理

**Feature 分支**: `003-category`

**创建日期**: 2026-07-06

**状态**: Draft

**输入**: 基于 `docs/MVP.md` 列出的"内置分类 (Category)"功能,本 feature 是 MVP 第三个核心模块

## 概述

家庭记账系统中,分类 (Category) 是用户记录一笔收支时必须选择的"用途"标签 —— 餐饮、交通、工资、住房等。本 feature 提供分类的内置数据集 + 查询能力,让用户在交易时选一个合理的分类标签。

**MVP 范围 (重要)**: 本 feature 仅提供**系统内置分类的查询能力**,**不**实现用户自定义分类 (增删改)。内置分类在系统启动时通过迁移种子 (seed) 注入,所有家庭共享同一份分类列表。用户自定义分类延后 V2。

分类是交易 (`004-transaction`,后续 feature) 的必要前置 —— 创建交易时必须从分类列表选一个。本 feature 不实现交易本身,但为后续 feature 提供数据模型基础。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 查询分类列表 (Priority: P1)

已登录用户在"创建交易"流程中需要选择分类,系统返回所有可见分类 (含内置 + 该家庭自定义,V2)。MVP 仅返回内置分类。

**为何此优先级**: 唯一的 US —— 没有 CRUD,MVP 范围内分类是只读字典。

**独立测试**: 注册成功后调 `category.list`,返回内置分类数组,包含至少 10 个常见分类 (餐饮/交通/工资等)。

**Acceptance Scenarios**:

1. **Given** 用户已登录, **When** 调 `category.list` 无参数, **Then** 返回内置分类数组,每项含 id/name/type/icon?/sortOrder。
2. **Given** 用户已登录, **When** 调 `category.list({ type: "expense" })`, **Then** 仅返回 type=expense 的分类 (如"餐饮"、"交通")。
3. **Given** 用户已登录, **When** 调 `category.list({ type: "income" })`, **Then** 仅返回 type=income 的分类 (如"工资"、"理财收益")。
4. **Given** 用户未登录, **When** 调 `category.list`, **Then** 401 未授权。
5. **Given** 用户 A 与用户 B 调 `category.list`, **When** 两者返回结果相同 (内置分类对所有家庭共享)。

---

### User Story 2 - 查询单个分类 (Priority: P2)

已登录用户在编辑交易时,可能需要查询某个分类 ID 的详情 (名称、类型)。

**为何此优先级**: P2 —— `category.list` 已能查到所有分类,单查是性能优化。前端缓存 list 后,单查基本不需要;但 API 完整性要求提供。

**独立测试**: 用 list 拿到的某个 ID 调 `category.get`,返回相同数据。

**Acceptance Scenarios**:

1. **Given** 已知某分类 ID, **When** 调 `category.get({ id })`, **Then** 返回该分类完整字段。
2. **Given** 不存在的 ID, **When** 调 `category.get`, **Then** 404 NOT_FOUND。
3. **Given** 未登录, **When** 调 `category.get`, **Then** 401。

---

### Edge Cases

- 内置分类数据集的字段完整性: 每个分类必须有 id / name / type / sortOrder,缺失任何一个视为数据完整性问题。
- `type` 字段必须 ∈ {`income`, `expense`} —— 不允许其他值。
- 内置分类不可被用户修改或删除 (即使 V2 引入自定义分类,内置分类仍只读)。
- 内置分类 ID 在迁移间保持稳定 (使用确定性 UUID,而非随机生成),保证 seed 幂等。
- 排序按 `sortOrder ASC, name ASC` —— 排序键稳定的可预测列表。
- `category.list` 性能: 内置分类约 20-30 条,P95 < 100ms。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 提供查询分类列表的能力 (`category.list`),返回所有可见分类。
- **FR-002**: `category.list` MUST 支持可选 `type` 参数 (income | expense) 过滤。
- **FR-003**: `category.list` MUST 按 `sortOrder ASC, name ASC` 排序。
- **FR-004**: 系统 MUST 提供查询单个分类的能力 (`category.get`),input `{ id }`。
- **FR-005**: 不存在的分类 ID 调 `category.get` MUST 返回 404 NOT_FOUND。
- **FR-006**: 所有分类操作 MUST 要求登录 (401 未授权)。
- **FR-007**: 系统 MUST 通过迁移种子 (seed) 注入至少 20 个内置分类,覆盖常见收入 (工资/奖金/理财收益/报销/兼职 等) 与支出 (餐饮/交通/购物/住房/医疗/娱乐/教育/通讯/人情 等)。
- **FR-008**: 内置分类 MUST 含字段: id (UUID 确定性生成)、name (中文名)、type (`income` | `expense`)、icon (emoji 或 short code,MVP 用 emoji)、sortOrder (整数,用于 UI 排序)。
- **FR-009**: 内置分类数据 MUST 在多次 `db:migrate` 后保持一致 (幂等 seed,不重复插入)。
- **FR-010**: 系统 MUST NOT 提供分类的创建/编辑/删除接口 (MVP;V2 评估用户自定义)。
- **FR-011**: 内置分类的 ID MUST 在不同部署环境 (开发/测试/生产) 间保持稳定,保证前端缓存的分类 ID 在任何环境都能查到。
- **FR-012**: `category.list` 性能 MUST 在 P95 < 100ms (内置分类 < 30 条,常驻索引)。

### Key Entities *(include if feature involves data)*

- **Category**: 分类实体。属性: id (UUID v5 确定性,基于 name+type 命名空间)、name (中文名 1-30 字)、type (`income` | `expense`)、icon (emoji 1-2 字符)、sortOrder (整数,默认 100)、isBuiltIn (boolean,内置=true,自定义=false V2)、createdAt。
- **CategoryType**: 值对象 (enum),仅 `income` 或 `expense`。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `category.list` 无参数返回 ≥ 20 条内置分类。
- **SC-002**: `category.list({ type: "expense" })` 至少返回 12 条支出分类 (餐饮/交通/购物/住房/医疗/娱乐/教育/通讯/人情/水电煤/服饰/其他)。
- **SC-003**: `category.list({ type: "income" })` 至少返回 5 条收入分类 (工资/奖金/理财收益/报销/兼职)。
- **SC-004**: `category.list` P95 < 100ms (内置分类 < 30 条)。
- **SC-005**: 内置分类的 ID 在多次重启 / 重新迁移后保持一致 (幂等 seed)。
- **SC-006**: 所有内置分类的 `name` 字段 MUST 非空且 ≤ 30 字符。
- **SC-007**: 所有内置分类的 `type` MUST ∈ {`income`, `expense`},无其他值。
- **SC-008**: 内置分类的 `icon` 字段为合法 emoji (1-2 字符,UTF-16 code unit ≤ 4)。

## Assumptions

- 内置分类数据集在迁移时种子注入,所有家庭共享 (无家庭级隔离)。
- MVP 不实现"按家庭过滤" —— 所有家庭看到同一份内置分类。V2 引入自定义分类时再加 `familyId` 字段。
- 分类 icon 用 emoji (如 🍔、🚗、💰),MVP 内置固定。V2 允许用户上传或选择。
- 分类 sortOrder 由内置数据集决定,常见分类 (餐饮/工资) sortOrder 较小,排在列表前面。
- 不实现"父子分类" (如"餐饮" 下有"早餐/午餐/晚餐") —— V2 评估。
- 不实现"分类合并" (用户重复创建后合并) —— V2 评估。
- 内置分类数据集来源: `docs/MVP.md` 未明确,本 feature 按 PRD "10 秒记账" 上下文推断 20-30 个常见分类,见 FR-007。
- 内置分类的 ID 生成策略: UUID v5 (确定性,基于 `name + type` 在固定命名空间),保证幂等 seed 与跨环境一致 (SC-005 / FR-011)。
- 审计日志: 分类是只读字典,无写入操作,本 feature **不**写 `category_events` 审计表 (与 `002-account` 不同,后者有 CRUD)。
