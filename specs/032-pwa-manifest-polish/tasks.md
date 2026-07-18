---

description: "Task list for 032-pwa-manifest-polish — PWA Manifest 专业度打磨"
---

# Tasks: 032 PWA Manifest 专业度打磨

**Input**: Design documents from `/specs/032-pwa-manifest-polish/`

**Prerequisites**: [plan.md](./plan.md)(required), [spec.md](./spec.md)(required), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/manifest-fields.md](./contracts/manifest-fields.md), [quickstart.md](./quickstart.md)

**Tests**: 宪章原则四"测试优先";manifest 契约测试先改(红)→ 实现(绿)。测试落 `src/tests/unit/pwa/manifest.test.ts`(既有约定)。

**Organization**: 按 spec.md 五档优先级(US1 P1 深色 / US2 P1 id / US3 P2 shortcuts / US4 P2 screenshots / US5 P3 192 maskable)纵切。US1+US2+US5 是纯 manifest 改动(可并行);US3 需配套代码;US4 需人工制图(NEEDS-MANUAL)。

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: 可并行(不同文件,无依赖)
- **[Story]**: 用户故事标签(US1..US5),映射 spec.md
- **路径**: `public/manifest.webmanifest`(主体)+ `public/pwa/*`(资源)+ `src/app/(app)/transaction/new/page.tsx` + `src/components/transaction/transaction-form.tsx`(US3)+ `src/tests/unit/pwa/manifest.test.ts`(契约测试)

---

## Phase 1: Setup

**Purpose**: 验证分支干净 + 确认 PWA 现状基线。

- [X] T001 验证当前分支 `032-pwa-manifest-polish` 基于 main 最新(含 1.1.1 发版的 `package.json` 1.1.1),`pnpm install` + `pnpm test:unit src/tests/unit/pwa/manifest.test.ts` 通过(确认既有 manifest 测试绿,作为改造起点)
- [X] T002 [P] 先调 `/heroui-react` skill 取 HeroUI v3 关于 Select/Form/query-driven 初始化的官方文档(为 US3 的 `TransactionForm.defaultType` prop + page.tsx 读 type query 做准备,宪章原则七 FR-013)。把要点缓存到会话上下文
- [X] T003 [P] 用 Chrome DevTools → Application → Manifest + Lighthouse PWA audit 跑一次修复前快照,记录 5 项现状到 `specs/032-pwa-manifest-polish/baseline.md`(创建文件,沿用 029/031 baseline.md 模式):(a) 深色模式启动是否白闪 (b) id 当前值 (c) shortcuts 有无 (d) screenshots 有无 (e) 192 maskable 有无。作为 after 对照基准

---

## Phase 2: Foundational — manifest 契约测试更新(Blocking Prerequisites)

**Purpose**: 把 manifest 契约测试(`src/tests/unit/pwa/manifest.test.ts`)改成反映**修复后**状态的断言,先红后绿(宪章原则四)。这是 US1/US2/US3/US5 的共享前置——所有 manifest 字段改动都要在此测试里有对应断言。

**⚠️ CRITICAL**: Phase 3+ 的 manifest 改动靠此测试守护;不先定契约就无法验证字段正确。

### Tests for Foundational(test-first)

- [X] T004 改 `src/tests/unit/pwa/manifest.test.ts`,**更新 id 断言**为新值(契约 C2:推荐 `/?balthasar`,或保留 `/` 时不动此断言)—— 加注释说明 spec R2 决策(id 必须是 URL 形式,裸字符串不合规)
- [X] T005 [P] 在 `src/tests/unit/pwa/manifest.test.ts` **新增主题色断言**(契约 C1):`background_color` 与 `theme_color` 都 === `"#2a2a2d"`;加注释说明 spec R1(`dark_theme_color` 不存在,只能单一中性深色)
- [X] T006 [P] 在 `src/tests/unit/pwa/manifest.test.ts` **新增 shortcuts 断言**(契约 C3):`shortcuts` 数组长度 ≥ 2,每条含 `name` + `url`,且 url 匹配 `/transaction/new?type=(expense|income|transfer)`
- [ ] T007 [P] 在 `src/tests/unit/pwa/manifest.test.ts` **新增 screenshots 断言**(契约 C4):`screenshots` 数组长度 ≥ 2,至少一条 `form_factor: "narrow"` + 一条 `"wide"`
- [X] T008 [P] 在 `src/tests/unit/pwa/manifest.test.ts` **新增 192 maskable 断言**(契约 C5):`icons` 数组含一条 `{sizes:"192x192", purpose:"maskable"}`
- [X] T009 跑 `pnpm test:unit src/tests/unit/pwa/manifest.test.ts` 确认 T004-T008 **全红**(契约先行,实现未改)

**Checkpoint**: 契约测试就位(全红),Phase 3+ 可开始把 manifest 改到符合契约。

---

## Phase 3: User Story 1 + 2 + 5 — 纯 manifest 改动(主题色 / id / 192 maskable)

**Goal**: 改 `public/manifest.webmanifest` 的主题色(R1)、id(R2)、加 192 maskable 图标条目(R5)。这三个 US 都是纯 manifest + 静态资源,无代码逻辑改动,可并行。

**Independent Test**: `pnpm test:unit src/tests/unit/pwa/manifest.test.ts` 的 id/主题色/192 maskable 断言转绿 + DevTools Application 面板确认。

### Tests for US1/US2/US5(test-first 已在 Phase 2 完成)

(无额外测试任务,契约测试 T004-T008 已覆盖)

### Implementation for US1(主题色,契约 C1)

- [X] T010 [P] [US1] 改 `public/manifest.webmanifest`:把 `background_color` 与 `theme_color` 都从 `"#ffffff"` 改为 `"#2a2a2d"`(对齐 `src/app/layout.tsx` viewport 深色 themeColor + `src/app/globals.css` 深色 `--background`)。**不添加** `dark_theme_color`(字段不存在,research R1)
- [X] T011 [US1] 跑 `pnpm test:unit src/tests/unit/pwa/manifest.test.ts` 确认主题色断言(T005)**转绿**

### Implementation for US2(id,契约 C2)

- [X] T012 [P] [US2] 改 `public/manifest.webmanifest` 的 `id`:推荐从 `"/"` 改为 `"/?balthasar"`(URL 形式 + 可辨识 query,query 不影响路由)。或经 review 决定保留 `"/"`(若保留则跳过本任务 + T004 用保留值)。**禁止**用裸字符串 `"balthasar"`(不合规,research R2)
- [X] T013 [US2] 跑 `pnpm test:unit src/tests/unit/pwa/manifest.test.ts` 确认 id 断言(T004)**转绿**

### Implementation for US5(192 maskable,契约 C5)

- [X] T014 [P] [US5] 生成 `public/pwa/icon-192-maskable.png`:用既有 `public/pwa/icon-maskable-source.svg`(已用 `transform: translate(90 90) scale(.65)` 把图标缩到中心 65%,落在 maskable 安全区中心 80% 直径圆内)渲染成 192×192 PNG。可用 `npx svgexport` / `sharp` / 在线工具 / Figma 导出(任选)。复用 maskable-512 的同一源,仅尺寸不同
- [X] T015 [P] [US5] 改 `public/manifest.webmanifest` 的 `icons` 数组:新增一条 `{ "src": "/pwa/icon-192-maskable.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" }`。**不**用 `"any maskable"` 单条目(research R5:分开条目渲染最优)。既有 192(any)/512(any)/512(maskable) 三条保留
- [X] T016 [US5] 跑 `pnpm test:unit src/tests/unit/pwa/manifest.test.ts` 确认 192 maskable 断言(T008)**转绿**;用 [maskable.app/editor](https://maskable.app/editor) 或 DevTools 确认 192 maskable 品牌标识在安全区内(NEEDS-MANUAL 视觉验证)

**Checkpoint**: US1/US2/US5 完成 —— manifest 主题色/id/192 maskable 全部符合契约,测试全绿。

---

## Phase 4: User Story 3 — shortcuts(记支出/收入/转账)+ 配套代码

**Goal**: manifest 加 shortcuts(R3),指向 `/transaction/new?type=expense|income|transfer`;配套改 `TransactionForm` 加 `defaultType` prop + `/transaction/new/page.tsx` 读 type query,使 shortcuts 触发后预选类型。

**Independent Test**: manifest shortcuts 断言转绿;在 Android Chrome 安装后长按图标确认 shortcuts 出现 + 点击直达 `/transaction/new` 且类型预选(spec US3 acceptance 1-3)。

**⚠️ 原则七触发(FR-013)**: 本 Phase 改 `src/components/**/*.tsx` props + `src/app/**/*.tsx` query 解析,T002 已查 `/heroui-react` skill。

### Tests for US3(test-first)

- [X] T017 [P] [US3] 写 `src/tests/unit/transaction-form-default-type.test.tsx`(jsdom):render `<TransactionForm defaultType="income" />`(embedded 或 page 模式),断言初始选中类型为 income(通过 Tabs 的 selectedKey 或 TYPE_META 映射断言);断言不传 `defaultType` 时仍默认 expense(回归保护)。mock tRPC/PWA provider 同 031 模式(若全量 render 太重,改测 `defaultType` 的纯函数初始值推导)
- [X] T018 [P] [US3] 写 `src/tests/unit/transaction-new-page.test.tsx`(jsdom)或纯函数测:断言 `/transaction/new?type=income` 的 query 解析正确把 `income` 传给 TransactionForm(可抽一个纯函数 `parseDefaultType(queryValue): "expense"|"income"|"transfer"|"undefined"` 便于 node 测)
- [X] T019 跑 `pnpm test:unit src/tests/unit/transaction-form-default-type.test.tsx src/tests/unit/transaction-new-page.test.tsx` 确认 T017-T018 **红**(defaultType prop 尚未实现)

### Implementation for US3

- [X] T020 [US3] 改 `src/components/transaction/transaction-form.tsx`:新增 `defaultType?: "income" | "expense" | "transfer"` prop;`selectedType` 初始值从硬编码 `"expense"` 改为 `defaultType ?? "expense"`(line 175-177 附近)。**仅 create 模式生效**(edit 模式由 editData.type 决定,不改)。JSDoc 注释 032 FR-006 来源。先查 `/heroui-react` skill 确认无 HeroUI Tabs 受控初始值更优 API(T002 已缓存)
- [X] T021 [US3] 改 `src/app/(app)/transaction/new/page.tsx`:在 `NewTransactionPageInner` 读 `type` query(`searchParams.get("type")`),经 `parseDefaultType` 纯函数校验后传给 `<TransactionForm defaultType={...} editId={editId} />`。无效/缺失 type 时不传(默认 expense,回归)
- [X] T022 [US3] 改 `public/manifest.webmanifest`:加 `shortcuts` 数组(契约 C3):至少"记一笔支出"(`/transaction/new?type=expense`)+"记一笔收入"(`/transaction/new?type=income`),可选第 3 条"记一笔转账"(`/transaction/new?type=transfer`)。每条含 `name`(≥ 12 字符推荐,用"记一笔支出"而非"记支出") + `url` + 可选 `short_name`/`description`/`icons`
- [X] T023 [US3] 跑 `pnpm test:unit src/tests/unit/transaction-form-default-type.test.tsx src/tests/unit/transaction-new-page.test.tsx src/tests/unit/pwa/manifest.test.ts` 确认 T017-T018 + T006 全部**转绿**
- [X] T024 [US3] 真机走查(NEEDS-MANUAL):Android Chrome 安装 app → 长按图标 → 确认 shortcuts 出现 → 点"记一笔支出"直达 `/transaction/new` 且类型预选支出 → 点"记一笔收入"预选收入。桌面 Chrome 右键 app 图标确认菜单项。iOS 记录实际行为(已知支持弱,不阻塞)

**Checkpoint**: US3 完成 —— shortcuts 声明 + 预选类型配套代码 + 测试全绿 + 真机验证。

---

## Phase 5: User Story 4 — screenshots(安装预览图)

**Goal**: manifest 加 screenshots(R4):2 张 narrow + 1 张 wide,放 `public/pwa/screenshots/`。

**Independent Test**: manifest screenshots 断言转绿;Chrome 安装弹窗展示截图(spec US4 acceptance 1-2)。

**⚠️ NEEDS-MANUAL**: 截图 PNG/WebP 需**人工制图**(无法自动生成),这是本 Phase 的主要工作。

### Tests for US4(test-first,已在 Phase 2 T007 完成)

(无额外测试任务,契约测试 T007 已覆盖)

### Implementation for US4

- [ ] T025 [US4] **人工制图(NEEDS-MANUAL)**:制作 3 张截图放 `public/pwa/screenshots/`:
  - `dashboard-mobile.png`(narrow,1080×1920,3:5~9:16 比例,Dashboard 概览)
  - `new-transaction-mobile.png`(narrow,1080×1920,记一笔表单)
  - `dashboard-desktop.webp`(**wide**,1920×1080,16:9/16:10,**< 200KB**,WebP 压缩 —— Chromium #372285217 桌面 Chrome 每次访问预加载 wide)
  制图方式:生产构建后浏览器截图 / Playwright 截图脚本 / 设计工具。narrow 单张也建议 < 200KB
- [ ] T026 [US4] 改 `public/manifest.webmanifest`:加 `screenshots` 数组(契约 C4),3 条对应 T025 的文件,每条含 `src`/`sizes`/`type`/`form_factor`/`label`
- [ ] T027 [US4] 跑 `pnpm test:unit src/tests/unit/pwa/manifest.test.ts` 确认 screenshots 断言(T007)**转绿**
- [ ] T028 [US4] 真机/DevTools 走查(NEEDS-MANUAL):Chrome 触发安装弹窗(地址栏安装图标或菜单"安装"),确认弹窗展示 ≥2 张截图;DevTools Application → Manifest 确认 screenshots 可解析、URL 可访问

**Checkpoint**: US4 完成 —— screenshots 声明 + 截图资源 + 测试全绿 + 安装弹窗验证。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 全量校验 + 回归 + baseline after 回填 + 发版准备。

- [ ] T029 [P] 跑 Chrome DevTools → Application → Manifest,确认无 manifest 解析错误/可安装性错误;所有字段(theme_color/background_color/id/shortcuts/screenshots/icons)解析值正确
- [ ] T030 [P] 跑 Lighthouse PWA audit(DevTools 内置),确认 "Web app manifest meets installability requirements" ✅ + "Displays appropriate theme color" ✅,无 manifest 完整性警告
- [ ] T031 [P] 跑 [PWABuilder](https://www.pwabuilder.com/) 预发布审计(在线,粘贴 dev URL 或发布后 URL),确认 manifest 评分 + 商店就绪度无重大扣分项
- [ ] T032 [P] 全量跑 `pnpm test:unit`(unit + ui)确认无既有测试被本 feature 打破(尤其 manifest 契约测试 + 既有 PWA 测试)
- [ ] T033 [P] 全量跑 `pnpm build` 确认无类型/构建错误(TS strict);`pnpm lint` 确认无新增 error
- [ ] T034 既有 PWA 功能回归(spec FR-012 / SC-006):DevTools Application → Service Workers 确认 SW 注册正常;断网测 navigate 请求回退 `offline.html`;安装引导(beforeinstallprompt / install-section)正常;更新流程(update-alert + SKIP_WAITING)正常;iOS apple-touch-icon + appleWebApp meta 不回归
- [ ] T035 把 quickstart.md §3-7 走查结果回填到 `specs/032-pwa-manifest-polish/baseline.md` 的 after 区块(对照 before 截图:深色启动色 / id / shortcuts / screenshots / 192 maskable 五项)
- [ ] T036 [P] 文档同步:若 `docs/AGENTS.md` 或 `docs/THEME.md` 有 manifest 相关描述,核对是否需更新(深色 background_color 值)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖,立即开始。T002/T003 可与 T001 并行。
- **Foundational (Phase 2)**: 依赖 Phase 1。**阻塞** Phase 3-5(契约测试先行)。
- **US1/US2/US5 (Phase 3)**: 依赖 Phase 2。三者都是纯 manifest 改动(不同字段/文件),**可完全并行**。
- **US3 (Phase 4)**: 依赖 Phase 2(契约测试 T006)。可与 Phase 3 并行(不同文件),但建议 Phase 3 先行(纯 manifest 风险更低)。
- **US4 (Phase 5)**: 依赖 Phase 2(契约测试 T007)。**T025 人工制图是关键路径**(无法自动化)。
- **Polish (Phase 6)**: 依赖 Phase 3-5 全部完成。

### Within Each User Story

- Tests(若含)**MUST** 先写并观察红,再实现转绿(宪章原则四)
- 纯 manifest 字段 → 静态资源 → 测试转绿 → 真机走查
- 每个 Checkpoint 可独立验证、独立提交

### Parallel Opportunities

- Phase 1: T002 ∥ T003(T001 完成后)
- Phase 2: T005 ∥ T006 ∥ T007 ∥ T008(同文件不同 describe,可同 PR;T004 是 id 断言单独)
- Phase 3: T010(主题色)∥ T012(id)∥ T014/T015(192 maskable)—— 不同字段/文件
- Phase 4: T017 ∥ T018(测试文件不同)
- Phase 6: T029 ∥ T030 ∥ T031 ∥ T032 ∥ T033 ∥ T034 ∥ T036(不同关注点)

---

## Parallel Example: Phase 3(纯 manifest 改动)

```bash
# 并行三条独立改动(均 [P]):
Task: "T010 [US1] 主题色改 #2a2a2d(public/manifest.webmanifest)"
Task: "T012 [US2] id 改 /?balthasar(public/manifest.webmanifest)"
Task: "T014/T015 [US5] 192 maskable 图标 + 条目(public/pwa/ + manifest)"
# 注:T010/T012/T015 都改 manifest.webmanifest 同文件,实操中串行提交避免冲突;
# 但 T014(生成 icon PNG)可与其它并行。
```

---

## Implementation Strategy

### MVP First(US1 + US2 + US5,纯 manifest)

1. Phase 1 Setup(T001-T003)
2. Phase 2 Foundational 契约测试(T004-T009,全红)
3. Phase 3 US1/US2/US5(T010-T016,转绿)
4. **STOP and VALIDATE**: `pnpm test:unit manifest.test.ts` 全绿 + DevTools/Lighthouse 验证
5. 单独提 PR:`feat(pwa): 032 manifest 专业度打磨(深色/id/192 maskable)`

### Incremental Delivery

1. Setup + Foundational → 契约测试就位
2. + US1/US2/US5 → manifest 基础属性打磨(MVP,可独立发版 patch)→ 提 PR-1
3. + US3 → shortcuts + 配套代码 → 提 PR-2(或并入 PR-1)
4. + US4 → screenshots(等人工制图)→ 提 PR-3(可延后)
5. + Polish → 全量校验 + baseline after → 收尾

**screenshots(US4)可延后**:T025 人工制图是 NEEDS-MANUAL,不阻塞 US1/US2/US3/US5 发版。manifest 没 screenshots 仍可安装(只是安装弹窗无预览图)。

---

## Notes

- **测试落点约定**: `src/tests/unit/pwa/manifest.test.ts`(既有,改 + 加断言)+ `src/tests/unit/transaction-form-default-type.test.tsx`(US3 新增,ui/jsdom)+ `src/tests/unit/transaction-new-page.test.ts`(US3 新增,纯函数)。不用 `__tests__/` 目录(项目约定是 `src/tests/unit/`)。
- **真机走查为 NEEDS-MANUAL**: T024 / T028 / T034 / T035 涉及 GUI/真机,沿用 029/031 baseline.md 模式,不阻塞 PR 但 MUST 在合并前完成。
- **宪章原则七**: T002(查 skill)+ T020/T021(改 TransactionForm props / page query)显式要求;任何额外 JSX/className/props 改动同此。
- **YAGNI**: 不引入 PWA 资产生成库(如 `pwa-assets-generator`),除非 T014 证明手动生成 192 maskable 太繁;优先复用既有 `icon-maskable-source.svg`。
- **NEEDS-MANUAL 关键路径**: T025(screenshots 制图)是本 feature 唯一无法自动化的任务;若制图延后,US1/US2/US3/US5 仍可独立发版。
- **id 决策点**: T012 需 review 确认是 `/?balthasar`(可辨识)还是保留 `/`(最小改动)。两者都合规(research R2)。
