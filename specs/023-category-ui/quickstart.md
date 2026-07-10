# Quickstart: 自定义分类管理 UI (023-category-ui)

**Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md) | **Contracts**: [contracts/components.md](./contracts/components.md)

> Phase 1 产物:手动浏览器验证 + 组件测试场景。**不含**实现代码,实现归 `tasks.md`。

## 前置依赖

- 018-custom-category backend(已合并 main)✅
- 010-settings-ui(已交付 `/settings` 页 + 组件模式)✅
- 008-transaction-ui(已交付交易表单,本 feature 更新其 categoryId 下拉)✅
- 新增 npm 依赖:`@dnd-kit/core` / `@dnd-kit/sortable` / `sonner` / `lucide-react` + shadcn components

## Setup

```bash
git checkout feat/018-ui
pnpm install
pnpm db:migrate   # 0006 已在 main
pnpm dev          # http://localhost:3000
```

## 验证场景(浏览器手动)

### 场景 1: /settings 入口 + /settings/categories 路由

**步骤**:
1. 登录 → 进 `/settings`
2. 看到"分类管理"入口卡片(类似"账户管理")
3. 点击 → 跳转 `/settings/categories`

**预期**: URL 变为 `/settings/categories`,显示分类管理页。

---

### 场景 2: 列表展示 (US1)

**步骤**:
1. 进 `/settings/categories`
2. 默认显示支出 type + 隐藏归档
3. 看到 22 内置分类(🔒 餐饮 / 🚗 交通 / ...) + 家庭自定义分类
4. 切换 type 到"收入"
5. 勾选"显示已归档"

**预期**:
- 内置分类带 🔒,无编辑/归档/拖拽按钮
- 自定义分类有编辑/归档/拖拽手柄
- 切换 type 后仅显示对应 type 分类
- 勾选"显示已归档"后,已归档分类灰显出现

---

### 场景 3: 新增自定义分类 (US2)

**步骤**:
1. 点"新增分类"按钮
2. Modal 表单:type / name / emoji picker / parent / sortOrder
3. 选 type=支出,输入 name="宠物用品",点 emoji picker 选 🐾
4. 提交

**预期**:
- 表单 zod 校验:空 name / 超 30 字 / 非白名单 emoji 时禁用提交 + 红字提示
- 提交成功 → modal 关闭 + toast "已创建" + 列表立即含新分类(server-first,等 API 返回)
- 新分类出现在列表末尾(sortOrder=100,createdAt 最新)

**边界**:
- 家庭达 200 自定义分类时,"新增"按钮禁用 + tooltip "已达上限 200"
- 同级同名(含 case-insensitive + trim)→ toast 错误"同级下分类名已存在"

---

### 场景 4: 编辑自定义分类 (US3)

**步骤**:
1. 点某自定义分类的"编辑"按钮
2. Modal 表单预填当前值
3. 改 name = "宠物食品"
4. 提交

**预期**:
- 内置分类无"编辑"按钮(只有 🔒)
- 已归档分类:编辑表单的 type + parent 置灰 + 提示"已归档不可改"
- 已被交易引用:type 置灰 + 提示"已被引用不可切换 type"
- 已有子分类:parent 置灰 + 提示"已有子分类不可变为二级"
- 改名提交 → toast "已保存" + 列表更新

---

### 场景 5: 归档与反归档 (US4)

**步骤**:
1. 创建父 + 2 子分类
2. 点父分类的"归档"按钮 → 确认框
3. 确认 → toast "已归档(含 2 个子分类)"
4. 勾选"显示已归档" → 看到灰显的父 + 2 子
5. 点父分类的"反归档" → toast "已恢复(含 2 个子分类)"

**预期**:
- 级联提示明确告知 N(archive: 未归档的子数;unarchive: 所有子)
- 乐观更新:点击瞬间列表变化,不等 API
- 失败回滚:模拟网络错 → toast "操作失败,已恢复" + 列表回到原状

---

### 场景 6: 拖拽排序 (US5)

**步骤**:
1. 3 个同级分类(sortOrder=10/20/30)
2. 鼠标拖 C(30) 到 A(10) 和 B(20) 之间
3. 松开

**预期**:
- 间隔足够(10, 20 → mid=15):调 `category.update({ id: C, sortOrder: 15 })`
- 列表立即更新(C 在 A 和 B 之间),optimistic 无需等 API
- 多次拖拽耗尽间隔(10, 11 → mid=NaN):自动调 `category.reorder` 全重排为 10/20/30
- toast "已重排"
- 拖拽内置分类:不可拖(无手柄)
- 拖拽跨 type(支出拖到收入区域):拒绝 + toast "不能跨 type 排序"
- 移动端:长按分类行进入拖拽模式

---

### 场景 7: 交易表单 categoryId 下拉更新 (US6)

**步骤**:
1. 先在 /settings/categories 创建自定义分类 "🐾 宠物用品"
2. 进 /transaction/new(新增交易)
3. 点 categoryId 下拉

**预期**:
- 下拉含"内置"分组(22 个)+ "自定义"分组(刚创建的"🐾 宠物用品")
- 二级分类缩进显示在父下方(如"🎁 人情 > 💍 婚礼红包")
- 已归档分类不出现在下拉(后端 includeArchived=false 已过滤)
- 切换交易 type(支出↔收入)→ 下拉重新过滤
- 选自定义分类 + 提交交易 → 成功(端到端闭环)

---

### 场景 8: emoji picker (US2 + Clarify Q2)

**步骤**:
1. 新增分类表单 → 点 emoji picker trigger
2. Popover 弹出:搜索框 + Tabs(食物/交通/...) + Grid
3. 切换 Tab → grid 显示该类 emoji
4. 搜索框输入 "咖啡" 或 "☕" → 跨所有类别过滤

**预期**:
- Tabs ~10 个(食物/交通/购物/健康/娱乐/教育/人情/收入/宠物/旅行/家庭/其他)
- Grid 8 列 × N 行,emoji button 大小够触屏点击(≥ 44px)
- 选中 emoji 高亮(ring-2 + 颜色)
- 性能:首次渲染 < 100ms,搜索输入 < 50ms(SC-003)

---

### 场景 9: 响应式 + 暗色模式 + 键盘导航 (FR-027/028)

**步骤**:
1. Chrome DevTools 切到 iPhone SE (375px)
2. 进 /settings/categories
3. 暗色模式切换(若有 toggle)
4. Tab 键导航

**预期**:
- 移动端:单列布局,表单全屏 modal(bottom sheet 风格),拖拽用长按
- 暗色模式:文字 + emoji + 按钮 contrast ≥ WCAG AA (4.5:1)
- Tab 可达所有交互元素(新增/编辑/归档/拖拽手柄/emoji picker)
- Enter 提交表单,Esc 关闭 modal

---

## 组件测试(Vitest + Testing Library)

```bash
pnpm test -- unit/components/category
```

### 测试覆盖

| 组件 | 测试文件 | 场景数 |
|---|---|---|
| EmojiPicker | `src/tests/unit/components/category/emoji-picker.test.tsx` | 5(tab 切换 / 搜索 / 选中 / 白名单 / 空搜索结果) |
| CategoryForm | `src/tests/unit/components/category/category-form.test.tsx` | 8(create happy / 校验 / parent 锁 type / 已归档限制 / 已引用限制 / 有子限制 / 重名 / 取消) |
| CategorySelect | `src/tests/unit/components/category/category-select.test.tsx` | 4(分组渲染 / 二级缩进 / type 过滤 / 归档隐藏) |

> CategoryManager / CategoryItem / useCategoryReorder 用手动浏览器验证(DnD + optimistic 难单测,与 010 模式一致)。

---

## 性能验证 (spec SC-002..004)

| 指标 | 目标 | 验证方法 |
|---|---|---|
| 列表渲染 P95 | < 500ms | Chrome DevTools Performance tab,刷新 10 次取 P95 |
| emoji picker 渲染 | < 100ms | 打开 popover,记录 first paint |
| emoji 搜索 | < 50ms | 输入关键词,记录 filter 时间 |
| 拖拽响应(间隔足够) | < 300ms | mousedown → mouseup → 列表更新 |
| 拖拽响应(全重排) | < 800ms | 同上 + 等 reorder API |

---

## 不验证的内容 (Out of Scope)

- 后端 procedure 行为(018 集成测试已覆盖)
- 数据库 schema(018 migration 已交付)
- 内置分类数据(003 seed 已验证)
- 交易表单的其他字段(008 已覆盖,本 feature 只改 categoryId 下拉)
