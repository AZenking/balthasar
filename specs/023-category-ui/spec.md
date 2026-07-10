# Feature 规约: 自定义分类管理 UI

**Feature 分支**: `feat/018-ui`

**创建日期**: 2026-07-10

**状态**: Draft (V1.5 UI enhancement over 018-custom-category backend)

**输入**: 用户描述 "018-ui: 自定义分类管理 UI。在 /settings/categories 页提供分类管理界面:列表/新增/编辑/归档/拖拽排序 + 更新 008 交易表单的 categoryId 下拉"

## 概述

018-custom-category backend 已交付 7 个 tRPC procedure(list/get/create/update/reorder/archive/unarchive),但用户无 UI 入口。本 feature 是 018 的前端 UI,与 008/009/010 模式一致(backend feature + UI feature 分开)。

核心能力:

- **分类管理页** (`/settings/categories`) —— 列表展示内置 + 自定义分类,层级展开(顶级 + 二级 children),支持 type 切换 + includeArchived 切换
- **新增分类** —— 表单含 type / name / emoji picker (从白名单选) / parent select (形成二级) / 可选 sortOrder
- **编辑分类** —— 受限于 018 FR-008..FR-014(内置置灰、已归档限制、type 切换限制、parentId 变更限制)
- **归档/反归档** —— 父级联子,显示级联提示
- **拖拽排序** —— 整数间隔策略,耗尽时调批量重排端点
- **交易表单更新** —— 008-transaction-ui 的 categoryId 下拉改用 `category.list` 新接口,显示内置 + 自定义 + 层级

本 feature **不新增后端 API**,仅实现前端页面 + 组件,依赖 018 已合并的 7 个 procedure。

## Clarifications

### Session 2026-07-10

- Q: mutation 的 UI 更新策略 (optimistic vs server-first)? → A: **混合策略** —— (a) create/update 为 server-first (await 响应 + invalidate,需服务端校验反馈如重名/200上限);(b) archive/unarchive/reorder 为 optimistic (本地立即更新 + 失败回滚 + toast)。详见 FR-024 + Edge Case "Optimistic 回滚"。
- Q: emoji picker 布局 (flat grid vs categorized tabs)? → A: **分类 tabs + 搜索** —— 沿用 emoji 常量文件的 ~10 大类分组 (食物/交通/购物/...),tab 切换 + 搜索框实时过滤。详见 FR-032。
- Q: 已被交易引用的分类编辑 type 字段时,UI 如何得知"已被引用"状态(018 `category.list` 不含 `hasTransactions` 字段)? → A: **乐观提交 + 后端拒绝** —— 前端不预置灰 type radio(因 list 不暴露 hasTransactions);用户改 type + 提交时,后端 018 FR-013 拒绝(400 "已被交易引用的分类不可切换 type"),前端 toast 错误 + 保留表单不关闭。避免新增 backend procedure 或 N+1 查询。详见 FR-012 改述。

(本次 spec 写入 0 个 [NEEDS CLARIFICATION],所有歧义点均落入"合理默认 + 写入 Assumptions"。可在 `/speckit-clarify` 阶段进一步 challenge。)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 查看分类列表 (Priority: P1) 🎯 MVP

已登录用户进入 `/settings/categories`,看到内置 + 自定义分类的层级列表。内置分类带🔒标记只读,自定义分类可编辑/归档。支持支出/收入 type 切换,支持"显示已归档"切换。

**为何此优先级**: 这是用户管理分类的入口 —— 没有列表,后续增删改查无从谈起。

**独立测试**: 进入 `/settings/categories`,默认显示支出 type + 隐藏归档的分类;切换到收入 type;勾选"显示已归档"后出现已归档分类(带 archivedAt 时间)。

**Acceptance Scenarios**:

1. **Given** 用户已登录且有自定义分类, **When** 访问 `/settings/categories`, **Then** 显示层级列表:内置分类(带🔒) + 自定义分类(顶级 + 二级嵌套在父的 children 里)。
2. **Given** 列表页, **When** 点击 type 切换 (支出 ↔ 收入), **Then** 列表仅显示对应 type 的分类。
3. **Given** 列表页, **When** 勾选"显示已归档", **Then** 已归档分类也出现,带归档时间标记(灰显);取消勾选则隐藏。
4. **Given** 列表页, **When** 查看内置分类行, **Then** 行末无"编辑"/"归档"按钮(只有🔒图标),hover 提示"内置分类不可修改"。
5. **Given** 二级分类存在, **When** 查看列表, **Then** 二级分类嵌套在父分类下方(缩进 + 连接线),父分类可折叠/展开。
6. **Given** 列表为空 (家庭无自定义分类), **When** 访问, **Then** 显示空状态提示"还没有自定义分类,点击'新增'开始"。
7. **Given** 未登录, **When** 访问 `/settings/categories`, **Then** 重定向 `/login`。

---

### User Story 2 - 新增自定义分类 (Priority: P1) 🎯 MVP

用户点击"新增分类"按钮,弹出表单:选 type (支出/收入)、输入 name、从 emoji 白名单选图标、可选选 parent (形成二级)、可选填 sortOrder。提交后分类立即出现在列表。

**为何此优先级**: 这是扩展分类体系的入口,与 018 US1 对齐。

**独立测试**: 新增 `{type:"expense", name:"宠物用品", icon:"🐾"}` → 列表出现该项 → 进交易表单,categoryId 下拉含该项。

**Acceptance Scenarios**:

1. **Given** 用户在列表页, **When** 点击"新增分类", **Then** 弹出表单(type radio 默认"支出" / name input / emoji picker / parent select / sortOrder input)。
2. **Given** 表单, **When** 选 type="支出" + 输入 name + 选 emoji + 提交, **Then** 成功,列表立即含新分类,toast 提示"已创建"。
3. **Given** 表单, **When** name 为空或纯空格, **Then** 提交按钮禁用 + 字段下红字"分类名不能为空"。
4. **Given** 表单, **When** name 超 30 字, **Then** 字段下红字"不能超过 30 字"。
5. **Given** 表单, **When** 选 parent (顶级分类), **Then** type radio 自动锁定为 parent 的 type (不可改),提示"子分类 type 与父一致"。
6. **Given** 表单, **When** 选 parent 后,parent 是其他家庭的分类, **Then** parent 下拉不显示其他家庭的分类(过滤)。
7. **Given** 同级已有同名 (case-insensitive), **When** 提交, **Then** toast 错误"同级下分类名已存在"。
8. **Given** 选了非白名单 emoji (如粘贴自定义字符), **When** 提交, **Then** emoji picker 不允许选非白名单值。
9. **Given** 家庭已有 200 自定义分类, **When** 点"新增", **Then** toast 错误"自定义分类数已达上限 200",表单不打开。

---

### User Story 3 - 编辑自定义分类 (Priority: P1)

用户点击自定义分类行的"编辑"按钮,弹出预填表单。内置分类无此按钮。编辑受限于 018 FR-008..FR-014。

**为何此优先级**: 用户输错名称或想换图标常见,需纠正能力。

**独立测试**: 创建分类 → 点编辑 → 改名 "宠物食品" → 提交 → 列表更新 → 尝试编辑内置 → 无按钮。

**Acceptance Scenarios**:

1. **Given** 自定义分类行, **When** 点"编辑", **Then** 弹出预填表单(type/name/icon/parent/sortOrder)。
2. **Given** 编辑表单, **When** 改 name + 提交, **Then** 成功,列表更新,toast "已保存"。
3. **Given** 内置分类行, **When** 查看, **Then** 无"编辑"按钮(只有🔒)。
4. **Given** 已归档分类的编辑表单, **When** 查看可改字段, **Then** 仅 name/icon/sortOrder 可改;type radio + parent select 置灰,提示"已归档分类不可改 type/parentId"。
5. **Given** 已被交易引用的分类, **When** 改 type + 提交, **Then** 后端(018 FR-013)拒绝 400 + toast "已被交易引用,不可切换 type" + 表单保留不关闭(FR-012 乐观策略)。
6. **Given** 已有子分类的父分类, **When** 尝试改 parentId (降为二级), **Then** parent select 置灰,提示"已有子分类,不可变为二级"。
7. **Given** 编辑后 name 与同级另一分类重名, **When** 提交, **Then** toast 错误"同级下分类名已存在"。
8. **Given** 编辑表单, **When** 改 parentId 为自己 (循环), **Then** 提交时 toast 错误"parentId 不可指向自己"。

---

### User Story 4 - 归档与反归档 (Priority: P2)

用户点击"归档"按钮归档不再使用的分类。归档父分类时级联归档子分类,UI 显示级联提示。反归档父分类时强制复活所有子(含独立归档过的)。

**为何此优先级**: 归档是替代硬删除的软停用机制,清理下拉列表但不破坏历史数据。

**独立测试**: 创建父 + 2 子 → 归档父 → toast "已归档(含 2 个子分类)" → 列表默认隐藏 → 勾选"显示已归档"可见 → 反归档 → 所有子复活。

**Acceptance Scenarios**:

1. **Given** 自定义分类行, **When** 点"归档", **Then** 弹确认框 "确定归档?该分类将从新建交易的下拉中隐藏,但历史交易仍保留。"
2. **Given** 确认框, **When** 点"确定", **Then** 调 archive API,toast "已归档",列表立即隐藏(除非勾选了"显示已归档")。
3. **Given** 父分类 (有 2 个子), **When** 归档父, **Then** toast "已归档(含 2 个子分类)",级联提示明确告知子也被归档。
4. **Given** 已归档分类 (在"显示已归档"模式下可见), **When** 点"反归档", **Then** 调 unarchive API,toast "已恢复",列表立即显示。
5. **Given** 反归档父分类 (之前有子被独立归档过), **When** 反归档, **Then** toast "已恢复(含 N 个子分类,含此前独立归档的)",所有子统一复活。
6. **Given** 内置分类, **When** 查看, **Then** 无"归档"按钮。
7. **Given** 已归档分类, **When** 在交易表单的 categoryId 下拉查找, **Then** 不出现 (归档隐藏)。

---

### User Story 5 - 拖拽排序 (Priority: P2)

用户拖拽同级分类调整顺序。前端用整数间隔策略算新 sortOrder,耗尽时调批量重排端点。

**为何此优先级**: 用户希望按使用频率排序,提升记账效率。

**独立测试**: 3 个同级分类 (sortOrder 10/20/30) → 拖 C 到 A 和 B 之间 → C.sortOrder 变 15 → 多次拖拽耗尽间隔 → 自动重排为 10/20/30。

**Acceptance Scenarios**:

1. **Given** 列表页, **When** 鼠标按住分类行拖拽, **Then** 行可拖动,显示拖拽占位符。
2. **Given** 拖拽中, **When** 拖到两行之间, **Then** 显示插入位置指示线。
3. **Given** 拖到新位置松开, **When** 间隔足够 (prev=10, next=30, mid=20), **Then** 调 update API 设 sortOrder=20,列表立即更新,无需全重排。
4. **Given** 拖到新位置松开, **When** 间隔耗尽 (prev=10, next=11), **Then** 自动调 reorder API 全重排同级为 10/20/30/...,toast "已重排"。
5. **Given** 拖拽跨 type (支出拖到收入区域), **When** 松开, **Then** 拒绝,toast "不能跨 type 排序"。
6. **Given** 拖拽跨级 (顶级拖到二级区域), **When** 松开, **Then** 拒绝,toast "不能跨级排序"。
7. **Given** 拖拽内置分类, **When** 尝试拖, **Then** 不可拖 (行无拖拽手柄,置灰)。
8. **Given** 移动端 / 触屏, **When** 长按分类行, **Then** 进入拖拽模式 (touch support)。

---

### User Story 6 - 交易表单 categoryId 下拉更新 (Priority: P1)

008-transaction-ui 的 categoryId 下拉改用 `category.list` 新接口,显示内置 + 自定义 + 层级。归档分类不出现在下拉。

**为何此优先级**: 没有 this,用户创建的自定义分类无法在记账时使用 —— 018 backend 闭环缺最后一公里。

**独立测试**: 创建自定义分类 "宠物用品" → 进交易表单 → categoryId 下拉含 "🐾 宠物用品" (在自定义分组下) → 选它创建交易 → 成功。

**Acceptance Scenarios**:

1. **Given** 用户有自定义分类, **When** 打开交易表单 (新增交易), **Then** categoryId 下拉显示:内置分类 (分组"内置") + 自定义分类 (分组"自定义"),按 type 过滤。
2. **Given** 下拉, **When** 有二级分类, **Then** 二级分类缩进显示在父分类下方 (如 "🎁 人情 > 💍 婚礼红包")。
3. **Given** 下拉, **When** 有已归档分类, **Then** 不出现在下拉 (归档隐藏)。
4. **Given** 下拉, **When** 选某分类 + 提交交易, **Then** 交易创建成功 (categoryId 有效)。
5. **Given** 下拉, **When** 切换交易 type (收入 ↔ 支出), **Then** 下拉重新过滤为对应 type 的分类。
6. **Given** 家庭 0 自定义分类, **When** 打开交易表单, **Then** 下拉仅显示内置 20 个 (与 008 旧行为一致,向后兼容)。

---

### Edge Cases

- **网络中断**: 列表加载/提交表单时网络断,显示"网络错误,请重试"toast,不卡 loading 态。
- **并发编辑**: 两个 tab 同时编辑同一分类,LWW (Last-Write-Wins),后保存的覆盖,不报冲突 (与 018 backend 一致)。
- **emoji picker 性能**: 白名单 ~120 个 emoji,grid 渲染 < 100ms;搜索框输入时实时过滤。
- **拖拽到边界**: 拖到列表顶/底,自动滚动 (scroll-while-dragging)。
- **空 name 提交**: 提交按钮禁用,不允许空 name 到达 API。
- **超长 name**: input maxLength=30,超过无法继续输入。
- **parent select 跨 type**: parent 下拉仅显示与当前 type 一致的顶级分类 (FR-005(d) 子 type = 父 type)。
- **归档后立即编辑**: 已归档分类点"编辑",表单打开但 type/parent 置灰 (US3 scenario 4)。
- **200 上限边界**: 达 200 时"新增"按钮置灰,tooltip "已达上限 200"。
- **内置分类在交易下拉**: 内置分类永远可见 (isBuiltIn=true, familyId=null),所有家庭共享。
- **移动端响应式**: 列表在小屏 (< 768px) 单列;表单全屏 modal;拖拽用长按触发。
- **暗色模式**: emoji + 文字 + 按钮在暗色模式下可读,符合 WCAG AA 对比度。
- **键盘导航**: Tab 可达所有交互元素;Enter 提交表单;Esc 关闭 modal。
- **级联归档提示文案**: "已归档(含 N 个子分类)" —— N=0 时不显示"(含 N 个子分类)"。
- **Optimistic 回滚**: archive/unarchive/reorder 乐观更新失败时 (网络错 / 403 / 500),前端 MUST 回滚到操作前的列表状态 + toast "操作失败,已恢复"。不留下与服务器不一致的中间态。create/update 不乐观 (server-first),所以无需回滚 (失败时表单保留)。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 在 `/settings/categories` 路由提供分类管理页,要求登录 (未登录重定向 `/login`)。
- **FR-002**: 列表 MUST 显示内置 + 当前家庭自定义分类,层级展开 (顶级 + 二级 children 嵌套),按 type + sortOrder + createdAt 排序。
- **FR-003**: 列表 MUST 支持 type 切换 (支出/收入,默认支出) + "显示已归档" 切换 (默认关闭)。
- **FR-004**: 内置分类行 MUST 显示🔒图标 + hover 提示"内置分类不可修改",无编辑/归档/拖拽按钮。
- **FR-005**: 系统 MUST 提供"新增分类"表单,含 type radio / name input (1-30 字,trim) / emoji picker (白名单) / parent select (可选,仅顶级分类) / sortOrder input (可选,默认 100)。
- **FR-006**: parent select MUST 仅显示与当前 type 一致的顶级分类 (内置 + 自定义),过滤掉其他家庭 + 已归档 + 二级分类。
- **FR-007**: 选 parent 后,type radio MUST 自动锁定为 parent 的 type,提示"子分类 type 与父一致"。
- **FR-008**: 表单提交 MUST 调 `category.create` procedure,成功后列表立即更新 + toast "已创建"。
- **FR-009**: 表单校验 MUST 在客户端前置:name 非空 + 1-30 字 / emoji ∈ 白名单 / parent 存在且同级 type 一致。校验失败时禁用提交按钮 + 字段下红字提示。
- **FR-010**: 系统 MUST 提供"编辑分类"表单 (预填),可改 name/icon/sortOrder/parent/type,受限于 018 FR-008..FR-014。
- **FR-011**: 已归档分类的编辑表单 MUST 置灰 type radio + parent select,提示"已归档分类不可改 type/parentId"。
- **FR-012**: 已被交易引用的分类切换 type 时,前端 MUST NOT 预置灰 type radio(因 018 `category.list` 返回的 `CategoryTreeNode` 不含 `hasTransactions` 字段,UI 无从得知)。改为**乐观提交 + 后端拒绝**:用户改 type + 提交时,后端(018 FR-013)返回 400 "已被交易引用的分类不可切换 type",前端 MUST toast 错误 + **保留表单不关闭**(让用户改回原 type 或先删除引用交易)。详见 Clarify Q3。
- **FR-013**: 已有子分类的父分类的编辑表单 MUST 置灰 parent select,提示"已有子分类,不可变为二级"。
- **FR-014**: 编辑提交 MUST 调 `category.update` procedure,成功后列表更新 + toast "已保存"。
- **FR-015**: 系统 MUST 提供"归档"按钮 (仅自定义分类),点击后弹确认框,确认后调 `category.archive`。
- **FR-016**: 归档父分类时 MUST 显示级联提示 "已归档(含 N 个子分类)",N=0 时不显示括号部分。
- **FR-017**: 系统 MUST 提供"反归档"按钮 (仅已归档的自定义分类,在"显示已归档"模式下可见),点击调 `category.unarchive`。
- **FR-018**: 反归档父分类时 MUST 显示级联提示 "已恢复(含 N 个子分类,含此前独立归档的)"。
- **FR-019**: 系统 MUST 支持拖拽排序 (同级分类),拖到新位置后:间隔足够时调 `category.update` 设中位 sortOrder;间隔耗尽时调 `category.reorder` 全重排同级。
- **FR-020**: 拖拽 MUST 拒绝跨 type (支出拖到收入) + 跨级 (顶级拖到二级) + 内置分类,toast 提示原因。
- **FR-021**: 拖拽 MUST 支持桌面 (鼠标拖拽) + 移动端 (长按触发) + 键盘 (Tab+方向键,accessibility)。
- **FR-022**: 008-transaction-ui 的 categoryId 下拉 MUST 改用 `category.list` 新接口,显示内置 (分组"内置") + 自定义 (分组"自定义") + 层级 (二级缩进)。
- **FR-023**: categoryId 下拉 MUST 按 type 过滤 (交易 type=支出 → 仅支出分类),MUST 隐藏已归档分类。
- **FR-024**: 系统 MUST 在所有 mutation 后使 `category.list` query 失效 (react-query invalidate),确保列表实时更新。**更新策略分两类** (Clarify Q1 混合策略):
  - (a) **create / update 为 server-first** —— await 服务端响应 → 成功后 invalidate + 关闭表单;失败时 toast 错误 + 保留表单状态供重试 (不丢用户输入)。需服务端校验反馈 (重名/200 上限/type 限制等)。
  - (b) **archive / unarchive / reorder 为 optimistic** —— 本地立即更新列表 (隐藏/显示/移动) → 后台调 API;失败时回滚到原状态 + toast "操作失败,已恢复"。详见 Edge Case "Optimistic 回滚"。
- **FR-025**: 系统 MUST 在 200 上限达时禁用"新增"按钮 + tooltip "已达上限 200"。
- **FR-026**: 系统 MUST 显示操作反馈:成功 toast (创建/编辑/归档/反归档/重排) + 错误 toast (校验失败/API 错误/网络断)。
- **FR-027**: 系统 MUST 支持暗色模式 (Tailwind dark: variants) + 移动端响应式 (< 768px 单列,表单全屏 modal)。
- **FR-028**: 系统 MUST 支持键盘导航:Tab 可达所有交互元素 / Enter 提交表单 / Esc 关闭 modal。
- **FR-029**: 系统 MUST NOT 实现分类硬删除 UI (与 018 FR-019 一致,仅归档)。
- **FR-030**: 系统 MUST NOT 实现分类合并 UI (V2 评估,与 018 FR-029 一致)。
- **FR-031**: 系统 MUST NOT 实现图标上传 UI (仅 emoji 白名单,与 018 FR-030 一致)。
- **FR-032**: emoji picker (Clarify Q2) MUST 用**分类 tabs + 搜索**布局:沿用 `src/lib/constants/category-emojis.ts` 的 ~10 大类 (食物/交通/购物/健康/娱乐/教育/人情/收入/宠物/旅行/家庭/其他) 作为 tab 切换;搜索框输入关键词时跨所有类别实时过滤 (前端 fuzzy match emoji 字符或类别名);选中后高亮当前选中 emoji。picker 作为 popover (桌面) / bottom sheet (移动端) 弹出。

### Key Entities

- **CategoryTreeNode** (前端类型,来自 018 `category.list` 返回): id / name / type / icon / sortOrder / familyId / isBuiltIn / parentId / archivedAt / createdAt / updatedAt / children (二级数组)。
- **CategoryFormValues** (表单值): type / name / icon / parentId? / sortOrder?。
- **EmojiLibrary** (引用 018 `src/lib/constants/category-emojis.ts`): ~120 个 emoji 常量,前后端共享。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户能在 30 秒内完成"打开 /settings/categories → 点新增 → 选 type/输入名/选 emoji → 提交"端到端流程。
- **SC-002**: 列表首次加载 (含内置 + 自定义 + 层级) P95 < 500ms (前端渲染,不含 API 延迟,API SLA 由 018 SC-003 保证)。
- **SC-003**: emoji picker 渲染 ~120 个 emoji P95 < 100ms,搜索输入实时过滤 P95 < 50ms。
- **SC-004**: 拖拽排序端到端 (mousedown → mouseup → API 响应 → 列表更新) P95 < 300ms (间隔足够场景) / P95 < 800ms (间隔耗尽全重排场景)。
- **SC-005**: 100% 内置分类行无编辑/归档/拖拽按钮 (FR-004)。
- **SC-006**: 100% 已归档分类不出现在交易表单 categoryId 下拉 (FR-023)。
- **SC-007**: 100% mutation 后列表实时更新 (无手动刷新,FR-024 invalidate)。
- **SC-008**: 交易表单 categoryId 下拉含用户刚创建的自定义分类 (端到端闭环,US6)。
- **SC-009**: 暗色模式 + 移动端 (< 768px) + 键盘导航全部可用 (WCAG AA 对比度 + Tab 可达)。
- **SC-010**: 008 既有交易表单测试在 018-ui 上线后仍通过 (向后兼容,categoryId 下拉行为扩展不破坏)。

## Assumptions

- 本 feature 是 018-custom-category backend 的前端 UI,依赖其 7 个 tRPC procedure 已合并到 main (feat/018-ui 从含 018 的 main 切出)。
- 路由: `/settings/categories` (新建),与现有 `/settings` (010-settings-ui) 同级;`/settings` 页加"分类管理"入口卡片。
- 表单组件: 沿用 010 的 account-form / account-item 风格 (shadcn/ui + react-hook-form + zod resolve)。
- emoji picker: 从 `src/lib/constants/category-emojis.ts` (018 已交付) 读白名单,grid 布局 + 搜索框。
- 拖拽库: 使用 `@dnd-kit/core` (现代、支持触屏 + 键盘) 或 `react-beautiful-dnd` (成熟但维护慢);plan 阶段定。
- state 管理: tRPC + react-query (与 008/009/010 一致),mutation 后 `utils.category.list.invalidate()`。
- 暗色模式: 沿用 010 的 Tailwind dark: 方案 (若 010 未实现暗色,本 feature 也不实现,defer 到统一暗色 feature)。
- 移动端: 沿用 008/009 的响应式断点 (sm: 768px),不引入新断点。
- 008 交易表单的 categoryId 下拉: 当前用 003 的 `category.list` (仅内置),本 feature 改用 018 扩展后的 `category.list` (内置+自定义+层级)。008 既有测试可能需更新 (mock 适配新返回结构)。
- 不实现: 分类硬删 UI (018 FR-019 不实现) / 分类合并 UI (018 FR-029 不实现) / 图标上传 UI (018 FR-030 不实现) / 三级分类 UI (018 限制 ≤ 2 层) / 分类建议 AI (V2) / 隐藏内置分类 UI (内置永远可见)。
- V-层级: V1.5 enhancement (与 018 backend 同级,非 V2+ 范围外)。
- 权限: MVP 家庭内所有成员均可管理 (与 018 一致,无角色区分)。
