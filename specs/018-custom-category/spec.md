# Feature 规约: 自定义分类

**Feature 分支**: `018-custom-category`

**创建日期**: 2026-07-09

**状态**: Draft (V1.5 enhancement over 003-category)

**输入**: 用户描述 "自定义分类: 新增、编辑、归档分类;支持收入/支出分类;支持二级分类、图标、排序;分类可用于预算和报表"

## 概述

003-category 已交付一套系统内置分类 (22 个,覆盖常见收入/支出场景,通过迁移种子注入,所有家庭共享),并提供了只读查询接口 `category.list` / `category.get`。本 feature 是 003 的增量增强 (V1.5),让用户在 MVP 之后能自行**新增、编辑、归档**家庭范围内的自定义分类,以满足个性化记账需求 (如"宠物用品"、"孩子补习班"、"红包"等内置未覆盖的项目)。

核心能力:

- **新增自定义分类** —— 用户在家庭范围内创建收入或支出分类,可选父分类形成**二级分类**
- **编辑自定义分类** —— 修改名称、图标、排序、父分类 (内置分类不可编辑)
- **归档自定义分类** —— 归档后不出现在新建交易的下拉,但历史交易保留该分类标签 (软停用,非删除)
- **二级分类** —— 至多 2 层深度 (父分类 + 子分类),禁止第 3 层
- **图标** —— 仅允许从内置 emoji 库选择 (与 003 内置分类的 emoji 字段一致),不支持上传
- **排序** —— 同级分类按 `sortOrder ASC` 排序,默认按创建时间
- **跨 feature 一致性** —— 自定义分类一旦创建,在交易选择、预算绑定 (019)、报表聚合 (006/020) 中行为与内置分类完全一致

本 feature 是 003-category 的增量增强,**不**重写 003 的内置分类初始化逻辑。003 的 22 个内置分类继续保留为只读,本 feature 在其基础上**叠加**自定义分类能力 (新增 schema 字段 + 新增 CRUD 接口)。

## Clarifications

### Session 2026-07-09

- Q: 内置分类 (003 的 22 个) 与自定义分类如何区分? → A: 通过 `isBuiltIn` 布尔字段区分。`isBuiltIn=true` 的分类 MUST 不可被编辑/归档/删除,只能查询;`isBuiltIn=false` 的分类可被其所属家庭编辑/归档。
- Q: 自定义分类是按家庭隔离还是全局共享? → A: 按**家庭隔离**。每个自定义分类 MUST 携带 `familyId` (符合宪章原则三: Family 是唯一聚合根,Category 在其内部,必须通过 `familyId` 引用)。家庭 A 的自定义分类对家庭 B 不可见。
- Q: 归档与删除的边界? → A: 自定义分类**只允许归档,不允许硬删除**。归档后分类不出现在新建交易/预算的下拉,但历史交易仍保留该分类 ID 引用 (避免外键悬空)。归档可被取消 (反归档)。
- Q: 二级分类的深度上限? → A: 至多 2 层 (父分类 + 子分类)。父分类本身不能再有父分类 (即 `parentId IS NULL` 或指向无父的分类)。禁止第 3 层。
- Q: 自定义分类名是否允许与内置分类同名? → A: 允许跨"是否内置"同名 (如内置有"餐饮",家庭可创建自定义"餐饮"用于二级细分);但**同一家庭、同一 `type`、同一 `parentId` 下**自定义分类名 MUST 唯一。
- Q: sortOrder 拖拽更新策略(整数 vs 浮点 vs 全重排)? → A: **整数间隔 + 耗尽重排**。初始/默认 `sortOrder = 100`;拖拽插入两值之间时取中位 `floor((prev + next) / 2)`;当相邻间隔 < 1 (无法再取中位) 时,触发同级全重排(按当前显示顺序批量更新为 10/20/30/...);重排 MUST 在单一数据库事务内完成,保证原子性。详见 FR-031。
- Q: 反归档父分类时,之前被独立归档过的子分类怎么处理? → A: **强制级联复活** —— 反归档父 → 所有子(无论之前是因父级联归档还是独立归档)统一设为 `archivedAt = null`。简单、一致、"所见即所得";若用户希望某子保持归档,反归档父后手动归档该子即可。详见 FR-017 与 Edge Cases "级联与独立归档的交互"。
- Q: emoji 库常量文件放哪里? → A: **单一共享常量文件** (例如 `src/lib/constants/category-emojis.ts`),含 ~100-200 个 emoji,**同时覆盖** 003 内置分类已用的 22 个 + 018 扩充的 ~80-180 个。003 的 seed 数据与 018 的 icon 校验**共享同一份**列表,避免两份漂移;前后端(import)共享。详见 FR-004 与 Key Entities `EmojiLibrary`。
- Q: 二级分类的 type 是否必须与父分类一致? → A: **子分类 type MUST 与父分类 type 一致** —— 创建/编辑子分类时校验 type 与父 type 相同,否则 400。UI 选父后自动锁定 type。语义:"二级是父的细分",避免跨 type 混乱的分类树。同时:已被引用或有子分类的父分类,切换 type MUST 被拒。详见 FR-005(d) 与 FR-013。
- Q: `category_events` 审计日志的保留期? → A: **永久保留** —— 一家家庭全生命周期 category_events 行数估计 < 1000(分类变更频次远低于交易),存储成本可忽略,审计完整性优先。与 002/004 既有隐含模式一致(三者均未定义 cleanup,实际等于永久)。plan 无需设计 cleanup job / TTL。详见 Assumptions "审计保留"。

(本次 spec 写入 0 个 [NEEDS CLARIFICATION],所有歧义点均落入"合理默认 + 写入 Assumptions"。可在 `/speckit-clarify` 阶段进一步 challenge。)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 新增自定义分类 (Priority: P1) 🎯 V1.5 核心

已登录用户在"分类管理"页 (设置入口) 新增一个自定义分类,选择 type (收入/支出)、输入名称、选图标 (从 emoji 库)、可选填父分类 (形成二级分类)、可选填 sortOrder。提交后分类立即可用于新建交易。

**为何此优先级**: 这是用户扩展分类体系的入口 —— 没有新增能力,自定义分类无从谈起。

**独立测试**: 新增一个 `{type: "expense", name: "宠物用品", icon: "🐾"}` 分类后,调 `category.list({ type: "expense" })` 返回值包含该项;随后创建一笔交易使用该 categoryId,成功。

**Acceptance Scenarios**:

1. **Given** 用户已登录且属于某家庭, **When** 提交 `{type: "expense", name: "宠物用品", icon: "🐾"}` (无 parentId), **Then** 201 创建成功,响应含 id / familyId / isBuiltIn=false / archivedAt=null。
2. **Given** 用户已登录, **When** 提交 `{type: "income", name: "副业收入", icon: "💻"}`, **Then** 201 收入分类创建成功。
3. **Given** 同一家庭已有 `{type: "expense", name: "宠物用品"}` 自定义分类, **When** 再次提交同名同 type 的顶级分类, **Then** 409 CONFLICT "同级下分类名已存在"。
4. **Given** 提交 `{name: ""}` 或 `{name: "   "}` (空白), **When** 提交, **Then** 400 字段错误。
5. **Given** 提交 `{name: "a".repeat(31)}` (超 30 字), **When** 提交, **Then** 400。
6. **Given** 提交 `{type: "invalid"}`, **When** 提交, **Then** 400 (type MUST ∈ {income, expense})。
7. **Given** 提交 `{icon: "upload.png"}` (非 emoji), **When** 提交, **Then** 400 (icon MUST 来自内置 emoji 库白名单)。
8. **Given** 提交 `{parentId: <某家庭的顶级分类id>}`, **When** 该 parentId 属于当前家庭且无自己的 parent, **Then** 201 二级分类创建成功。
9. **Given** 提交 `{parentId: <已是二级分类的id>}` (尝试创建第 3 层), **When** 提交, **Then** 400 "二级分类下不可再建子分类"。
10. **Given** 提交 `{parentId: <其他家庭的分类id>}`, **When** 提交, **Then** 400 (跨家庭拒绝)。
11. **Given** 未登录, **When** 提交, **Then** 401。

---

### User Story 2 - 编辑自定义分类 (Priority: P1)

已登录用户修改自家自定义分类的名称、图标、排序、父分类。内置分类 (isBuiltIn=true) 不可编辑。

**为何此优先级**: 用户输错名称或想换图标常见,需要纠正能力。与 004 编辑交易对齐。

**独立测试**: 创建分类后改名为 "宠物食品",DB 中 name 更新 + updatedAt 更新;尝试编辑内置分类 → 403。

**Acceptance Scenarios**:

1. **Given** 自定义分类属于当前家庭, **When** 提交 `{name: "宠物食品"}` 编辑, **Then** 字段更新,`updatedAt` 更新。
2. **Given** 分类 isBuiltIn=true, **When** 任意编辑, **Then** 403 FORBIDDEN "内置分类不可编辑"。
3. **Given** 编辑后名称与同级 (同家庭 + 同 type + 同 parentId) 另一自定义分类重名, **When** 提交, **Then** 409。
4. **Given** 编辑 parentId 从 null 改为某顶级分类, **When** 该分类已有子分类 (即它本身是父), **Then** 400 "已有子分类的分类不可变为二级" (防止层级混乱)。
5. **Given** 编辑 parentId 改为自己 (循环引用), **When** 提交, **Then** 400。
6. **Given** 编辑 type 字段 (income ↔ expense), **When** 该分类已被交易引用, **Then** 400 "已被引用的分类不可切换 type" (避免历史交易分类语义错乱);若未被引用,允许。
7. **Given** 分类属于其他家庭, **When** 提交编辑, **Then** 404 (不暴露存在性)。
8. **Given** 已归档的分类被编辑, **When** 仅修改 name/icon/sortOrder, **Then** 允许 (归档 ≠ 锁定;但不可改 parentId 或 type,因这些影响层级/历史语义)。
9. **Given** 未登录, **When** 提交编辑, **Then** 401。

---

### User Story 3 - 归档与反归档自定义分类 (Priority: P1)

已登录用户归档不再使用的自定义分类,归档后该分类不出现在新建交易/预算/报表筛选的下拉中,但**历史交易仍保留**该 categoryId 引用,查询/统计照常工作。归档可被反归档恢复。

**为何此优先级**: 归档是"软停用" —— 既清理下拉列表,又不破坏历史数据完整性。这是替代硬删除的核心机制 (004 交易删除是硬删,但分类因被引用所以必须软停用)。

**独立测试**: 创建分类 + 创建一笔使用它的交易 → 归档该分类 → `category.list` 不再返回它 (默认 hide archived) → 但 `transaction.get` 仍能 JOIN 出 categoryName → 反归档后 `category.list` 重新返回。

**Acceptance Scenarios**:

1. **Given** 自定义分类属于当前家庭, **When** 调 `category.archive({ id })`, **Then** 200 `{ success: true }`,分类 archivedAt 字段写入时间戳。
2. **Given** 已归档的自定义分类, **When** 调 `category.list` (默认 hide archived), **Then** 不返回该分类。
3. **Given** 已归档的自定义分类, **When** 调 `category.list({ includeArchived: true })`, **Then** 返回该分类,带 `archivedAt` 字段。
4. **Given** 已归档的分类有历史交易引用, **When** 调 `transaction.get` / `dashboard.summary` 聚合, **Then** 仍能正确 JOIN 出 categoryName + categoryIcon (归档 ≠ 删除引用)。
5. **Given** 已归档的自定义分类, **When** 调 `category.unarchive({ id })`, **Then** 200,archivedAt 重置为 null,重新出现在 `category.list`。
6. **Given** 分类 isBuiltIn=true, **When** 调 archive, **Then** 403 "内置分类不可归档"。
7. **Given** 父分类 (有子分类) 被归档, **When** 归档, **Then** 系统级联归档所有其子分类 (子分类因失去父而失去意义);反归档父时同步反归档子。
8. **Given** 子分类被归档但父分类未归档, **When** 仅归档子, **Then** 父分类仍可见,子分类隐藏 (允许局部归档)。
9. **Given** 分类属于其他家庭, **When** 调 archive, **Then** 404。
10. **Given** 未登录, **When** 调 archive, **Then** 401。

---

### User Story 4 - 查询分类列表 (含自定义,层级展开) (Priority: P2)

已登录用户在"创建交易"流程中调 `category.list`,系统返回**内置 + 当前家庭自定义**的所有可见分类,按层级 (顶级 + 二级) 与 sortOrder 组织。003 的 `category.list` 接口行为扩展 (向后兼容: 不传参即返回所有顶级可见分类,二级作为 children 字段嵌套)。

**为何此优先级**: P2 —— P1 是写操作 (新增/编辑/归档),查询接口已在 003 提供,本 feature 扩展其返回内容 (合并内置 + 自定义 + 层级)。前端缓存 list 后基本不需单查。

**独立测试**: 新增若干自定义分类 (含二级) 后调 `category.list({ type: "expense" })`,返回值含内置 + 自定义,二级分类作为父分类的 `children` 数组项出现。

**Acceptance Scenarios**:

1. **Given** 当前家庭有自定义分类, **When** 调 `category.list` 无参, **Then** 返回内置 + 自定义所有可见分类 (archivedAt IS NULL),按 sortOrder ASC 排序。
2. **Given** 有二级分类, **When** 调 list, **Then** 返回结构含 `children` 数组 (二级分类挂在对应父分类下),顶级分类 `parentId IS NULL`。
3. **Given** 调 `category.list({ type: "expense" })`, **When** 已有自定义支出分类, **Then** 返回内置 expense + 自定义 expense,收入分类不返回。
4. **Given** 调 `category.list({ includeArchived: true })`, **When** 有已归档分类, **Then** 已归档分类也返回 (带 archivedAt 字段)。
5. **Given** 用户 A 与用户 B 属不同家庭, **When** 各自调 list, **Then** 内置部分相同,自定义部分各自隔离 (家庭 A 看不到家庭 B 的自定义分类)。
6. **Given** 调 `category.list({ parentId: <某顶级分类id> })`, **When** 该父有子分类, **Then** 仅返回该父的直接子分类 (用于"选父后加载子"的级联场景)。
7. **Given** 未登录, **When** 调 list, **Then** 401。

---

### User Story 5 - 查询单个分类 (Priority: P3)

已登录用户用分类 ID 查询单条详情 (含 familyId / isBuiltIn / parentId / archivedAt 等扩展字段)。003 的 `category.get` 接口行为扩展。

**为何此优先级**: P3 —— `category.list` 已能查到所有分类,单查是性能优化 + 详情展示。

**独立测试**: 用 list 拿到的某个自定义分类 ID 调 `category.get`,返回含 familyId / parentId / archivedAt 等扩展字段。

**Acceptance Scenarios**:

1. **Given** 已知某分类 ID 且属于当前家庭 (或为内置), **When** 调 `category.get({ id })`, **Then** 返回完整字段 (id/name/type/icon/sortOrder/familyId/isBuiltIn/parentId/archivedAt/createdAt/updatedAt)。
2. **Given** 自定义分类属于其他家庭, **When** 调 get, **Then** 404 (不暴露存在性)。
3. **Given** 不存在的 ID, **When** 调 get, **Then** 404。
4. **Given** 内置分类 ID, **When** 调 get, **Then** 返回 isBuiltIn=true, familyId=null。
5. **Given** 未登录, **When** 调 get, **Then** 401。

---

### Edge Cases

- **归档有交易的分类**: 归档不删除引用,历史交易仍可通过 JOIN 取得 categoryName/icon。聚合统计 (006-dashboard / 020-reports) 仍计入归档分类的金额。新建交易下拉隐藏归档分类。
- **二级分类的最大深度**: 创建/编辑时若 parentId 指向的分类本身已有 parentId,拒绝 (400 "禁止第 3 层");若被编辑的分类已有子分类,则不允许为其设置 parentId (400 "已有子分类的分类不可变为二级")。
- **删除父分类时子分类处理**: 本 feature **不实现硬删除**,故无此问题。但**归档父分类时级联归档子分类** (子分类失去父后无意义);反归档父时同步反归档子。
- **级联归档/反归档与独立归档的交互**: 反归档父分类时,所有子分类(含此前被独立归档过的)统一复活 (`archivedAt = null`);若用户希望保持某子归档,反归档父后手动归档该子即可。该决策避免新增 `archivedReason` 字段 + 比较时间戳的复杂度,详见 FR-017。
- **图标资源缺失**: icon MUST 来自内置 emoji 库白名单 (前端硬编码列表,如 100+ 常用 emoji),提交非白名单值返回 400。不实现图片上传,无资源 URL 失效问题。
- **排序冲突**: 多个分类 sortOrder 相同时,次级排序按 `createdAt ASC` (创建时间早的在前)。拖拽更新采用**整数间隔策略** (FR-031): 插入两值之间取中位 `floor((prev + next) / 2)`;间隔耗尽 (< 1) 时触发同级全重排 (10/20/30/...,单一事务内)。允许 sortOrder 冲突(多分类同值),按 createdAt ASC 兜底。
- **自定义分类名重复**: 同一家庭 + 同一 type + 同一 parentId 下 name 唯一 (case-sensitive? MVP 用 case-insensitive,即"餐饮"和"餐飲"视为不同,但"餐饮"和"餐饮 " (带空格) 视为相同 —— 服务端 trim 后比较)。
- **跨家庭分类隔离**: 任何 CRUD 操作 MUST 校验 `category.familyId = currentFamilyId` (内置分类 familyId=null,所有家庭共享只读)。跨家庭访问 `category.get` / `update` / `archive` 返回 404 (不暴露存在性)。
- **内置分类的不可变性**: isBuiltIn=true 的分类 MUST 拒绝 update / archive / delete (返回 403)。仅 get / list 可访问。
- **归档后再编辑的限制**: 已归档分类允许编辑 name/icon/sortOrder (方便用户在反归档前调整),但**不允许编辑 type / parentId** (避免层级与历史语义混乱)。
- **type 切换的限制**: 已被交易引用的自定义分类不可切换 type (income ↔ expense),因会破坏 004 的"categoryId type 与交易 type 匹配"约束;未被引用时允许切换。
- **子分类 type 与父分类一致性**: 二级分类的 type MUST 与父分类一致 (FR-005(d))。创建/编辑子分类时,服务端 MUST 校验 `child.type === parent.type`,违反返回 400。UI 选父后自动锁定 type 字段。同时:父分类切换 type MUST 被拒若它已有子分类(避免父子 type 不一致,FR-013(b))。
- **并发**: 同一家庭多成员同时创建分类 → 都成功 (除非同名冲突,后到的 409)。Last-Write-Wins 编辑 (与 004 一致)。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 允许已认证用户在自己的家庭范围内创建自定义分类 (`category.create`),input: `{ type, name, icon, parentId?, sortOrder? }`,`familyId` 服务端派生 (拒绝客户端传入,与 002-FR-006 / 004-FR-007 一致)。
- **FR-002**: `type` MUST ∈ {`income`, `expense`};不允许其他值 (与 003-FR 类型枚举一致)。
- **FR-003**: `name` MUST 经 trim 后非空,长度 1-30 字符 (与 003 内置分类约束一致)。
- **FR-004**: `icon` MUST ∈ 内置 emoji 库白名单 —— **单一共享常量文件** (例如 `src/lib/constants/category-emojis.ts`),前后端 (import) 共享同一份列表,含 ~100-200 个常用 emoji,**同时覆盖** 003 内置分类已用的 22 个 + 018 扩充的 ~80-180 个。003 的 seed 数据与 018 的 icon 校验都从此文件取,避免两份漂移。非白名单值返回 400。
- **FR-005**: `parentId` 可选,若提供则 MUST 满足: (a) 存在且属于当前家庭或为内置;(b) `parentId` 指向的分类本身 `parentId IS NULL` (即必须是顶级);(c) 不允许循环引用 (parentId ≠ self);(d) **子分类 `type` MUST 与父分类 `type` 一致**(e.g., 父 type=expense → 子 MUST type=expense;违反返回 400 "子分类 type 必须与父一致")。违反任一返回 400。
- **FR-006**: 系统 MUST 保证同一家庭 + 同一 type + 同一 parentId (含 null) 下自定义分类名**唯一** (trim 后 case-insensitive 比较);违反返回 409 CONFLICT。
- **FR-007**: 内置分类 (isBuiltIn=true) 与自定义分类 (isBuiltIn=false) 共存于同一表,通过 `isBuiltIn` 布尔字段区分。内置分类 `familyId IS NULL`,自定义分类 `familyId` MUST 非空。
- **FR-008**: 系统 MUST 允许用户编辑自定义分类的可变字段 (name, icon, sortOrder, parentId, type 受限 —— 见 FR-013/014);内置分类 MUST 拒绝编辑 (403)。
- **FR-009**: 编辑后名称若与同级 (同家庭 + 同 type + 同 parentId) 另一分类重名 MUST 返回 409。
- **FR-010**: 系统 MUST NOT 允许给已有子分类的分类设置 parentId (会变成第 3 层);违反返回 400。
- **FR-011**: 编辑 parentId 形成循环引用 (parentId 指向自己) MUST 返回 400。
- **FR-012**: 系统 MUST NOT 允许编辑 `isBuiltIn` 字段 (该字段由系统在 seed 时设定,客户端不可变)。
- **FR-013**: 自定义分类的 `type` 字段在以下任一条件满足时 MUST 拒绝切换 (400 "type 不可切换"): (a) **已被交易引用** (transactions 表存在 `categoryId = this.id`,会破坏 004 的"categoryId type 与交易 type 匹配"约束);(b) **该分类有子分类** (切换会导致子分类 type 与父不一致,违反 FR-005(d));(c) **已归档** (FR-014)。三者均不满足时允许切换。
- **FR-014**: 已归档 (`archivedAt IS NOT NULL`) 的自定义分类 MUST 允许编辑 name/icon/sortOrder,但 MUST NOT 允许编辑 type/parentId (400)。
- **FR-015**: 系统 MUST 提供 `category.archive` 操作 (软停用),将 `archivedAt` 设为当前时间戳;归档后分类不出现在默认 `category.list` (即 `includeArchived` 未传或 false 时)。
- **FR-016**: 系统 MUST 提供 `category.unarchive` 操作,将 `archivedAt` 重置为 null。
- **FR-017**: 归档父分类时 MUST 级联归档其所有子分类 (子分类因失去父失去意义);反归档父时 MUST 同步反归档**所有**子分类(无论子分类是因父级联归档还是被独立归档,统一将 `archivedAt` 设为 null —— "强制级联复活")。该级联在单一事务内完成。
- **FR-018**: 内置分类 (isBuiltIn=true) MUST 拒绝 archive/unarchive (403)。
- **FR-019**: 系统 MUST NOT 提供分类的硬删除接口 (避免历史交易外键悬空)。归档是唯一的"停用"机制。
- **FR-020**: 系统 MUST 扩展 003 的 `category.list` 接口,使其返回**内置 + 当前家庭自定义**的所有可见分类 (archivedAt IS NULL),按 `sortOrder ASC, createdAt ASC` 排序;支持可选 `{ type?, parentId?, includeArchived? }` 参数。
- **FR-021**: `category.list` 默认 MUST 仅返回顶级分类 (parentId IS NULL),二级分类作为父分类的 `children` 数组嵌套;传入 `parentId` 时仅返回该父的直接子分类 (平铺,不嵌套)。
- **FR-022**: `category.list` 的返回项 MUST 含字段: id / name / type / icon / sortOrder / familyId (自定义非空,内置 null) / isBuiltIn / parentId / archivedAt / createdAt / updatedAt;`children` (嵌套时)。
- **FR-023**: 跨家庭访问 (`category.get` / `update` / `archive` / `unarchive` 自定义分类) MUST 返回 404 (不暴露存在性);内置分类对所有家庭可见 (只读)。
- **FR-024**: 所有分类操作 MUST 要求登录 (401 未授权,与 003-FR-006 一致)。
- **FR-025**: 系统 MUST 保证自定义分类一旦创建,在被交易 (`004-transaction`) 引用、预算 (`019-budget`) 绑定、报表 (`006-dashboard` / `020-reports`) 聚合时,**行为与内置分类完全一致** —— 即下游 feature 不需要区分 isBuiltIn,仅按 categoryId 索引。
- **FR-026**: 系统 MUST 对所有自定义分类的写操作 (create / update / archive / unarchive) 写入审计日志到 `category_events` 表 (event_type: category_created / category_edited / category_archived / category_unarchived),与 002-account_events / 004-transaction_events 同模式;**内置分类的查询不写审计** (与 003-assumptions 一致,字典只读无审计)。
- **FR-027**: `category.create` / `update` 性能 MUST P95 < 200ms (含校验 + 审计);`category.list` (含自定义) MUST P95 < 150ms (家庭内分类总数预期 < 100,含内置 22 + 自定义)。
- **FR-028**: 系统 MUST 保证内置分类 (003 seed 的 22 个) 在本 feature 上线后**保持向后兼容** —— 即 003 的 `category.list` / `category.get` 接口语义不变 (新增字段是可选,旧调用方零破坏)。
- **FR-029**: 系统 MUST NOT 实现"分类合并" (将一个分类的交易全部迁移到另一分类) —— 超出 V1.5 范围,延后 V2。
- **FR-030**: 系统 MUST NOT 实现"分类图标上传" —— 仅允许从内置 emoji 库选择 (与 003 内置分类的 icon 字段一致)。
- **FR-031**: 系统 MUST 实现 sortOrder **整数间隔 + 耗尽重排**策略: (a) 新建分类默认 `sortOrder = 100`;(b) 拖拽插入两个相邻同级分类之间时,新 `sortOrder = floor((prev.sortOrder + next.sortOrder) / 2)`;(c) 当相邻间隔 < 1 (即 floor 计算无法再分,如 `floor((10 + 11) / 2) = 10` 与 prev 相同) 时,系统 MUST 触发**同级全重排** —— 按当前显示顺序批量更新所有同级 (同 familyId + 同 type + 同 parentId) 分类的 sortOrder 为 10/20/30/...;(d) 重排 MUST 在单一数据库事务内完成,保证原子性;(e) 多个分类 sortOrder 相同时,次级排序按 `createdAt ASC` (允许冲突,按创建时间兜底)。API 形态 (单次 `category.update` 批调 vs 新增 `category.reorder` 批量端点) 由 plan 决定。

### Key Entities *(include if feature involves data)*

- **Category** (扩展 003): 分类实体。属性: id (UUID v7,自定义分类用 v7 随机;内置分类保留 003 的 v5 确定性 ID)、familyId (UUID,内置=null,自定义=所属家庭)、name (1-30 字)、type (`income` | `expense`)、icon (emoji,白名单内 1-2 字符)、sortOrder (整数,默认 100)、parentId (UUID 可空,顶级=null,二级=父分类 id)、isBuiltIn (boolean,内置=true,自定义=false)、archivedAt (timestamp 可空,null=活跃)、createdAt、updatedAt。
- **CategoryEvent** (新增): 审计日志。属性: id、eventType (`category_created` | `category_edited` | `category_archived` | `category_unarchived`)、categoryId、actorUserId、actorFamilyId、before (jsonb,编辑前可变字段快照)、after (jsonb,编辑后)、occurredAt。
- **Family** (引用 001): 自定义分类的聚合根,通过 familyId 引用。
- **Transaction** (引用 004): 通过 categoryId 引用 Category,内置与自定义无差别对待。
- **EmojiLibrary** (常量,非持久化): 内置 emoji 白名单,**单一共享常量文件** (例如 `src/lib/constants/category-emojis.ts`),前后端 import 共享。含 ~100-200 个常用 emoji (🍔🚗💰💻🐾...),**同时覆盖** 003 内置分类已用的 22 个。003 的 seed 数据与 018 的 icon 校验都从此文件取。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户能在 30 秒内完成"打开分类管理 → 点新增 → 选 type/输入名/选图标 → 提交"端到端流程。
- **SC-002**: `category.create` 服务端处理 P95 < 200ms (FR-027)。
- **SC-003**: `category.list` (合并内置 + 自定义 + 层级) P95 < 150ms (FR-027)。
- **SC-004**: 100% 跨家庭访问尝试被拒绝 (自定义分类对其他家庭不可见,FR-023)。
- **SC-005**: 100% 对内置分类的写操作 (update/archive/unarchive) 被拒绝 (403,FR-008/018)。
- **SC-006**: 归档后 `category.list` (默认) 100% 不含归档分类,但 `transaction.get` / 聚合统计 100% 仍能 JOIN 出 categoryName (FR-015 + FR-025)。
- **SC-007**: 同一家庭 + 同一 type + 同一 parentId 下,自定义分类名 100% 唯一 (FR-006)。
- **SC-008**: 二级分类深度上限 2 层被 100% 强制 (FR-005 + FR-010),无第 3 层数据。
- **SC-009**: 003 已有的内置分类 (22 个) ID 与字段在本 feature 上线后保持不变 (向后兼容,FR-028)。
- **SC-010**: 自定义分类在交易选择、预算绑定、报表聚合中行为与内置分类一致 (FR-025) —— 即下游 feature 的测试用例不区分 isBuiltIn 全部通过。
- **SC-011**: `category_events` 审计写入齐全 (category_created/edited/archived/unarchived),`before` / `after` jsonb 严禁含敏感字段 (FR-026)。
- **SC-012**: 已被交易引用的分类切换 type 时 100% 被拒 (FR-013)。

## Assumptions

- 本 feature 是 003-category 的增量增强,**不重写** 003 的内置分类初始化逻辑。003 的 22 个内置分类继续通过迁移种子注入,保持只读。
- schema 扩展: 003 现有的 `categories` 表新增字段 `familyId` (UUID 可空,引用 families.id)、`parentId` (UUID 可空,自引用)、`isBuiltIn` (boolean,seed 时内置设 true)、`archivedAt` (timestamp 可空)、`updatedAt` (timestamp)。003 的现有字段 (id/name/type/icon/sortOrder/createdAt) 不变。
- 内置分类 (003 seed 的 22 个) 在本 feature 上线时通过**新增迁移**将 `isBuiltIn` 设为 true、`familyId` 设为 null (003 原表无此字段,迁移时回填)。
- 自定义分类的 id 生成: UUID v7 (随机,与 004 transaction 一致),而非 003 内置的 v5 确定性 (自定义分类无需跨环境一致)。
- 自定义分类按家庭隔离 —— 每个自定义分类 MUST 携带 `familyId` (宪章原则三)。003 内置分类 familyId=null,所有家庭共享只读。
- 分类名唯一性粒度: (familyId, type, parentId, name) 四元组唯一 (内置分类 familyId=null,可跨家庭重名;自定义分类按家庭隔离)。case-insensitive + trim 比较。
- 二级分类深度上限: 2 层。第 3 层禁止 (parentId 链长度 ≤ 1)。
- 图标: 仅允许内置 emoji 库白名单 —— **单一共享常量文件** (例如 `src/lib/constants/category-emojis.ts`),前后端 import 共享,含 ~100-200 个常用 emoji,**同时覆盖** 003 内置分类已用的 22 个。003 的 seed 数据与 018 的 icon 校验都从此文件取,避免两份漂移。不实现图片上传。
- 排序: 同级分类按 `sortOrder ASC, createdAt ASC` (003 已有 sortOrder,本 feature 沿用)。默认 sortOrder=100,拖拽策略采用**整数间隔 + 耗尽重排** (FR-031): 插入取中位,间隔耗尽时同级重排,单一事务保证原子性。
- 归档 vs 删除: 自定义分类**只允许归档,不允许硬删除**。归档是软停用 (archivedAt 字段),反归档可恢复。原因: 分类被交易引用,硬删会导致 transactions.categoryId 外键悬空。
- 级联归档: 归档父分类时同步归档所有子分类 (子失去父无意义);反归档父时同步反归档子。该级联在单一事务内完成。
- type 切换: 已被交易引用的自定义分类不可切换 type (会破坏 004 的"categoryId type 与交易 type 匹配"约束);未被引用时允许。
- 审计: 新增 `category_events` 表 (与 002-account_events / 004-transaction_events 同模式)。仅自定义分类的写操作写审计;内置分类的查询不写 (与 003-assumptions 一致)。
- 审计保留: **永久保留**(不实现 cleanup job / TTL)。理由: 一家家庭全生命周期 category_events 行数估计 < 1000,存储成本可忽略,审计完整性优先;与 002/004 既有隐含模式一致(三者均未定义 cleanup,实际等于永久)。V2 评估若 family 数突破 10K+,可再评估滚动清理。
- 自定义分类在交易选择 (004)、预算 (019)、报表 (006/020) 中行为与内置分类一致 —— 下游 feature 仅按 categoryId 索引,不区分 isBuiltIn。本 feature 提供约束声明,下游 feature 无需新增逻辑。
- 家庭成员权限: MVP 阶段家庭内所有成员均可管理自定义分类 (无角色区分);V2 评估"仅家庭 owner 可管理"的权限模型。
- 不实现"分类合并" (将一个分类的交易迁移到另一分类) —— V2 评估。
- 不实现"分类图标上传" —— 仅 emoji 库。
- 不实现"三级及以上分类" —— 至多 2 层。
- 不实现"分类使用次数统计" —— V2 评估。
- 不实现"分类建议" (基于交易 remark 自动推荐分类) —— V2 评估 (可能涉及 AI)。
- 默认每个家庭自定义分类总数上限: 200 个 (含归档);超出返回 400。防止滥用。
- 自定义分类的删除 (硬删) 路径: 仅在分类从未被任何交易引用 + 已归档 + 用户在"危险区"二次确认时,可走特殊的 `category.purge` 接口 —— **本 feature 不实现** purge,V2 评估。
- **UI 范围**: 本 feature **backend-only** (procedures + schema + 测试 + 审计),不含分类管理页 UI。UI 拆为独立 feature (018-ui,与 008-transaction-ui / 009-transactions-list-ui 模式一致)。spec US1-5 acceptance scenarios 用 tRPC procedure 测试 + createCaller 验证,不依赖 UI 渲染;前端实现时基于本 feature 提供的 7 个 procedure (list/get/create/update/archive/unarchive/reorder) 构建 `/settings/categories` 页面。
