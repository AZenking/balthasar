# Feature Specification: PWA Manifest 专业度打磨

**Feature Branch**: `032-pwa-manifest-polish`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description(对照市面 PWA 标准核对后的改进优先级表):
> P1:manifest theme_color/background_color 对齐深色模式 + 加 dark_theme_color(消除深色用户安装时白闪)
> P1:id 改稳定字符串(防未来 start_url 变动导致重复安装)
> P2:加 shortcuts("记一笔支出/收入")(高频入口,服务"10 秒记账")
> P2:加 screenshots(2-3 张)(安装体验提升)
> P3:192 也加 maskable(Android 图标更稳)
> (P4 离线数据缓存 IndexedDB 属产品定位决策,不在本 feature 范围)

## Clarifications

### Session 2026-07-18

- **Q1 — 本 feature 范围是否包含 P4"离线数据缓存(IndexedDB)"?**
  → A:**不包含**。P4 是大工程(需同步层 + 冲突解决 + 数据陈旧性策略),且本质是产品定位
  决策(当前是"标准 PWA"还是"离线优先 app")。本 feature 只做 **manifest 层的专业度
  打磨**(P1-P3:深色对齐、稳定 id、shortcuts、screenshots、192 maskable),不触及 SW
  缓存策略与数据层。**P4 将另开独立 spec(预计 033-pwa-offline-cache)**,与本 feature
  解耦交付——先发 manifest 打磨(快、低风险),离线缓存单独走完整 speckit 流程。

- **Q2 — "id 改稳定字符串"会打破既有 manifest 契约测试(断言 `id === "/"`),如何处理?**
  → A:**同步更新测试** + **评估已安装用户的影响**。`id` 是 PWA 的唯一身份:改了 id
  后,旧 id(`/`)的已安装实例与新 id(`balthasar`)会被系统当成**两个不同的 app**,
  导致已安装用户出现"重复图标"或旧安装无法收到更新。应对策略:由于本项目当前用户
  基数极小(单人/家庭 MVP 阶段),且 `id: "/"` 会随 start_url 变化而漂移(是已知的
  不稳定隐患),**尽早改成稳定 id 是正确的**——越晚改影响越大。测试同步更新断言为
  新 id 值。

- **Q3 — shortcuts 与 screenshots 的具体内容?**
  → A(research R3/R4 细化):
  - **shortcuts**(P2):至少 2 条——"记一笔支出"、"记一笔收入"(对应交易表单的两种
    类型);可加第 3 条"记一笔转账"(027 已解锁转账)。`url` 指向既有全屏页路由
    `/transaction/new?type=expense|income|transfer`(research R3:`url` 支持 query,
    且 Drawer 不在路由层无法冷启动打开,故走全屏页)。预选类型需配套:
    `TransactionForm` 加 `defaultType` prop + `/transaction/new/page.tsx` 读 type query。
  - **screenshots**(P2):3 张——2 张 `form_factor: "narrow"`(Dashboard 移动端、记一笔
    移动端)+ 1 张 `"wide"`(Dashboard 桌面端)。静态 PNG/WebP,放 `public/pwa/screenshots/`。
    `wide` 单张 < 200KB(桌面 Chrome 每次访问预加载,research R4)。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 深色模式用户安装不再白闪 (Priority: P1)

一位使用深色模式的用户首次把 BALTHASAR 安装到主屏幕(或桌面)。安装完成、app 启动的
瞬间,用户看到的启动画面(splash screen)背景色是中性深色(与产品深色主题一致),
而不是当前修复前的白色闪烁一下再切到深色。浅色模式用户启动时也会看到短暂的中性深色
背景(从启动到首屏 < 1s,可接受)。

**Why this priority**:深色模式是高频偏好(尤其记账类高频工具,夜间使用多)。安装瞬间的
白闪是 PWA 最常见的"廉价感"来源之一,且修复成本极低。这是把 PWA 从"达标"提升到
"专业"的最小投入高回报项,作为 P1 优先解决。

**技术限制(plan 阶段 research R1 确认)**:PWA manifest 规范**不支持** per-color-scheme
的 `theme_color`/`background_color`(那是 `<meta name="theme-color">` HTML tag 独有),
也**不存在** `dark_theme_color` 字段(W3C/App-Info registry 均无,所有浏览器未实现)。
启动画面色来自 manifest 单一 `background_color`。因此**无法做到**"深色用户深色启动 +
浅色用户浅色启动"——只能选一个中性色,深色用户受益最大(夜间高频),浅色用户短暂中性
深色启动可接受。

**Independent Test**:在深色模式的桌面浏览器 / 手机上,用 Lighthouse PWA audit 或 Chrome
`chrome://webapk/` 安装预览,对照修复前后的启动画面截图,确认背景色为中性深色、无白闪。

**Acceptance Scenarios**:

1. **Given** 用户的系统/浏览器处于深色模式,
   **When** 用户把 BALTHASAR 安装到主屏幕并首次启动,
   **Then** 启动画面(splash)背景色为中性深色(产品深色主题色,如 `#2a2a2d`),不出现白色闪烁。
2. **Given** 用户的系统/浏览器处于浅色模式,
   **When** 同样安装并首次启动,
   **Then** 启动画面背景为中性深色(规范限制,单一 background_color),从启动到首屏 < 1s,
   体感可接受(不要求浅色启动——规范不允许 per-scheme)。
3. **Given** manifest 声明了与产品深色主题一致的主题色,
   **When** 用 PWA 校验工具(如 Lighthouse / DevTools Application 面板)检查,
   **Then** manifest 的 `background_color` 与 `theme_color` 解析为产品深色主题色,无"缺少
   主题色"警告。

---

### User Story 2 - 稳定且可辨识的 app 身份(id) (Priority: P1)

BALTHASAR 的 manifest 声明一个稳定、可辨识的 `id`,作为 PWA 的唯一身份。经 plan 阶段
research R2 核查 [MDN id](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id)
+ [Chrome PWA id](https://developer.chrome.com/docs/capabilities/pwa-manifest-id):`id`
规则是"形如 URL 的字符串"(裸字符串如 `balthasar` 不合规,会被当相对 URL 解析成路径
拼接);**`id` 一旦显式声明就独立于 start_url**(start_url 变了 id 不变)——所以当前
`id: "/"` 其实**本就稳定**(不是 spec 原假设的"由 start_url 推导")。

本 US 的真实价值是:**让 id 在显式声明的基础上更可辨识**(如 `/?balthasar`,query 后缀
不影响路由,但人眼/DDevTools 能看出"这是 balthasar")。这是产品偏好层面的优化,非
正确性修复。

**Why this priority**:与 US1 并列 P1,因为成本极低(改一行 + 测试断言)且让 manifest 更
专业。但优先级低于 US1(US1 解决真实白闪痛点,US2 是锦上添花)。

**Independent Test**:用 PWA 校验工具(DevTools Application 面板)检查 `id` 字段,确认
为 URL 形式的稳定值,非裸字符串。

**Acceptance Scenarios**:

1. **Given** manifest 显式声明 URL 形式的 id(如 `/?balthasar` 或保留 `/`),
   **When** 用 PWA 校验工具检查,
   **Then** 工具识别到 `id` 字段,值为合法 URL 形式(非裸字符串、非由 start_url 推导)。
2. **Given** 已显式声明的 id,
   **When** 未来调整 start_url(如 `/dashboard` → `/`),
   **Then** 已安装用户**不会**出现重复图标,id 独立于 start_url(PWA id 规范保证)。
3. **Given** 既有 manifest 契约测试(断言 `id === "/"`),
   **When** id 改为新值(如 `/?balthasar`),
   **Then** 测试已同步更新为新断言,全绿(不留下红色测试)。若选择保留 `/`,测试不动。

---

### User Story 3 - 长按图标快速记账(shortcuts) (Priority: P2)

用户在手机主屏幕长按 BALTHASAR 图标(或桌面右键),弹出的快捷菜单里直接看到"记一笔
支出""记一笔收入"(可选"记转账")选项。点击后 app 直接打开到记账入口并预选好对应
类型,省去"打开 app → 点底部记一笔按钮 → 选类型"三步。这是"10 秒完成一笔账"(宪章
原则五)在系统入口层的直接加速。

**Why this priority**:`shortcuts` 是 PWA 高频入口特性,直接服务产品的核心体感预算
("10 秒记账")。但它是 P2,因为依赖 manifest 的 shortcuts 字段被系统正确渲染(部分
平台/iOS 支持有限),收益平台相关;且需要配合"冷启动直达记账入口"的 URL scheme。
在 P1(manifest 基础属性)就绪后独立交付。

**Independent Test**:在 Android Chrome 安装后长按图标,确认快捷菜单出现"记支出/收入";
点击后确认 app 打开并直达记账 Drawer 且类型已预选。iOS 可作为已知限制记录(iOS 对
shortcuts 支持弱)。

**Acceptance Scenarios**:

1. **Given** 用户已安装 app 到主屏幕(Android),
   **When** 长按图标,
   **Then** 快捷菜单出现至少"记一笔支出""记一笔收入"两项,带图标与简短标签。
2. **Given** 快捷菜单的"记一笔支出",
   **When** 用户点击,
   **Then** app 打开并直达记账入口(底部 Drawer 打开),交易类型预选为"支出"。
3. **Given** 快捷菜单的"记一笔收入",
   **When** 用户点击,
   **Then** app 打开并直达记账入口,交易类型预选为"收入"。
4. **Given** iOS 用户安装 app,
   **When** 长按图标,
   **Then** 快捷菜单行为以 iOS 实际支持为准(iOS 对 PWA shortcuts 支持有限,作为已知
   限制记录,不阻塞本 feature)。

---

### User Story 4 - 安装弹窗有预览图(screenshots) (Priority: P2)

用户在 Chrome 等浏览器看到"安装 BALTHASAR"提示弹窗时,除了图标和名字,还能看到 2-3 张
产品截图(Dashboard 概览、记一笔表单、流水列表),直观了解 app 长什么样。这提升了
安装意愿与转化率,也让 app 在应用商店式呈现中更专业。

**Why this priority**:安装转化率是 PWA 商业价值的关键杠杆,但截图需要人工制图(投入
高于其它项)。P2,与 shortcuts 并列,可在 shortcuts 之后或同时交付。

**Independent Test**:用 Chrome 安装弹窗预览或 Lighthouse PWA audit,确认 manifest 声明
了 screenshots 且图片文件存在、尺寸符合规范(宽屏 ≥1280px、窄屏 ≥320px)。

**Acceptance Scenarios**:

1. **Given** manifest 声明了 screenshots,
   **When** 用 PWA 校验工具检查,
   **Then** 工具识别到至少 2 张截图,尺寸符合规范(至少一张宽屏、一张窄屏)。
2. **Given** 浏览器弹出安装提示(支持截图的平台),
   **When** 用户看到弹窗,
   **Then** 弹窗内展示产品截图(非仅有图标+名字)。
3. **Given** 截图文件,
   **When** 检查 public 目录,
   **Then** 截图 PNG 文件存在、可访问、体积合理(不拖累 manifest 加载)。

---

### User Story 5 - Android 图标在自适应模式下更稳(192 maskable) (Priority: P3)

Android 自适应图标(adaptive icon)会把 app 图标裁剪成不同形状(圆、方、泪滴)。在
修复前,只有 512 提供了 maskable 版本;192 缺 maskable 意味着某些 Android 设备在
小尺寸图标场景(如通知栏、某些启动器)下用非 maskable 图标,可能被裁掉关键内容。
修复后,192 也提供 maskable 版本,图标在各尺寸下都留有安全边距,裁切更稳。

**Why this priority**:实际影响面较小(只在部分 Android 启动器 + 小尺寸场景可见),
且 512 maskable 已覆盖主要场景。P3,作为锦上添花。

**Independent Test**:用 Maskable.app Editor 或 Chrome PWA 检查,确认 192 图标也声明了
maskable purpose 且内容在安全区内。

**Acceptance Scenarios**:

1. **Given** manifest 的 192 图标声明了 `purpose: "maskable"`(或 "any maskable"),
   **When** 用 PWA 校验工具检查,
   **Then** 192 与 512 都有 maskable 版本。
2. **Given** Android 设备用自适应图标模式渲染 192 图标,
   **When** 图标被裁成圆形/方形,
   **Then** 关键内容(品牌标识)不被裁掉(在 maskable 安全区内)。

---

### Edge Cases

- **既有契约测试同步**:改 `id` 会打破 `src/tests/unit/pwa/manifest.test.ts`(断言
  `id === "/"`)。本 feature MUST 同步更新该测试为新 id 值,不允许留下红色测试
  (宪章原则四测试优先,改实现先改测试)。
- **既有已安装用户**:改 `id` 会导致旧安装(`/` id)与新安装(`balthasar` id)并存。
  当前 MVP 阶段用户基数极小,影响可接受;但 spec 显式记录此影响,作为已知迁移代价。
  实现阶段若发现已有真实用户,需评估是否提供迁移说明。
- **iOS 对 shortcuts/screenshots 支持弱**:iOS Safari 对 PWA shortcuts 与 screenshots
  的渲染支持有限或不支持。本 feature 以 Android/Chrome 为主要验收平台,iOS 行为作为
  已知限制记录,不阻塞。
- **深色主题色跨平台差异**:`dark_theme_color` 是 Chrome 115+ 支持的较新字段,旧版
  浏览器会忽略它(回退到 `theme_color`)。不阻塞,渐进增强。
- **screenshots 体积**:截图 PNG 体积过大会拖累 manifest 解析与首次安装。需控制单张
  体积(合理压缩,如 < 200KB/张)。
- **shortcuts URL scheme**:快捷方式指向的 URL 需在冷启动时直达记账入口并预选类型。
  若当前路由不支持(如 `?action=new&type=expense` 未实现),需在本 feature 或前置
  任务中补;若实现成本高,可先只声明 shortcuts 指向 `/dashboard`(不带预选),作为
  退化方案。
- **maskable 安全区**:192 maskable 图标的内容(品牌标识)必须落在 maskable 安全区
  (中心 80% 区域)内,否则裁切后丢失。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: manifest 的 `background_color` 与 `theme_color` MUST 改为产品深色主题色
  (对齐 `layout.tsx` viewport 的深色 themeColor `#2a2a2d` + `globals.css` 深色
  `--background`)。**注**:PWA manifest 规范不支持 per-color-scheme,也**不存在**
  `dark_theme_color` 字段(research R1 确认),故只能选单一中性色;深色用户受益最大。
- **FR-002**: manifest `background_color` 改中性深色后,深色模式用户安装/首启的启动画面
  MUST 不出现白色闪烁;浅色模式用户启动画面为中性深色(规范限制,接受)。
- **FR-003**: manifest MUST 显式声明 URL 形式的稳定 `id`(推荐 `/?balthasar`,或保留
  当前的 `/`)。裸字符串(如 `balthasar`)**不合规**(research R2),MUST 避免。id 独立
  于 start_url,未来 start_url 调整时 app 身份连续。
- **FR-004**: 若 id 改为新值(如 `/?balthasar`),既有 manifest 契约测试
  (`src/tests/unit/pwa/manifest.test.ts`)MUST 同步更新断言,测试套件全绿,不留红色测试。
  若保留 `/`,测试不动。
- **FR-005**: manifest MUST 声明至少 2 条 `shortcuts`("记一笔支出""记一笔收入",可加
  "记一笔转账"),每条含 `name` + `url`(`short_name`/`icons`/`description` 可选)。
  `url` MUST 在 `scope: "/"` 内、同源,支持 query params。
- **FR-006**: shortcuts 的 `url` 指向 `/transaction/new?type=expense|income|transfer`
  (research R3)。触发后 app 打开该全屏页,交易类型 MUST 预选为对应类型。这要求:
  (a)`/transaction/new/page.tsx` 读取 `type` query 并传给 TransactionForm;
  (b)`TransactionForm` 新增 `defaultType?` prop,`selectedType` 初始值取自它
  (当前硬编码 `"expense"`)。
- **FR-007**: manifest MUST 声明至少 2 张 `screenshots`(至少一张 `form_factor: "narrow"`
  + 一张 `"wide"`),展示核心场景(Dashboard / 记一笔 / 流水)。
- **FR-008**: 截图文件单张体积 MUST 控制在 < 200KB(research R4:桌面 Chrome 每次访问
  预加载 `wide` 截图,大体积拖累首屏);`wide` 优先 WebP 压缩。
- **FR-009**: manifest 的 192 图标 MUST 有 maskable 变体(独立条目 `purpose: "maskable"`,
  research R5 推荐分开条目而非 `"any maskable"` 单条)。
- **FR-010**: 192 maskable 图标的内容(品牌标识)MUST 落在 maskable 安全区(画布中心
  80% 直径圆)内,裁切后不丢失关键内容。复用既有 `icon-maskable-source.svg`(scale .65)。
- **FR-011**: 所有 manifest 改动 MUST 通过 PWA 校验工具(DevTools Application 面板 +
  PWABuilder + Lighthouse PWA audit)检查,无 manifest 完整性警告。
- **FR-012**: 改动 MUST 不破坏既有 PWA 功能(SW 注册、离线 fallback、安装引导、更新流程
  回归 0 缺陷)。
- **FR-013**(原则七):FR-006 触及 `src/components/**/*.tsx` 的 props 改动
  (`TransactionForm.defaultType`)与 `src/app/**/*.tsx` 的 query 解析,实现前 MUST 先查
  `/heroui-react` skill 获取 HeroUI v3 相关 API(宪章原则七)。

### Key Entities

本 feature 无新增数据实体。涉及的是 **manifest 配置实体**(非持久化,静态文件):

- **manifest 主题色**:浅色 + 深色两套,驱动启动画面与标题栏配色。
- **manifest id**:app 的唯一身份标识,稳定字符串。
- **manifest shortcuts**:系统级快捷入口列表(记支出/收入/转账)。
- **manifest screenshots**:安装弹窗预览图列表。
- **manifest icons**:应用图标集合(含 maskable 变体)。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 深色模式用户安装并首次启动 app 时,启动画面背景为中性深色(产品深色主题
  色 `#2a2a2d`),无白色闪烁——以修复前后同环境截图对照确认(定性验收,二值:通过/不通过)。
  浅色模式用户启动画面同为中性深色(规范限制单一 background_color,接受)。
- **SC-002**: Lighthouse PWA audit 对 manifest 的检查项**全部通过**,无"主题色缺失"
  "id 不稳定""图标不完整"等警告(机械化验收)。
- **SC-003**: 已安装 app 在长按图标(Android)时出现至少 2 条快捷入口("记支出""记
  收入"),且点击后直达记账入口并预选对应类型(真机/DevTools 走查)。
- **SC-004**: 安装弹窗(支持的平台)展示至少 2 张产品截图,以浏览器安装预览或 Lighthouse
  确认。
- **SC-005**: manifest 契约测试同步更新为新 id 断言,`pnpm test:unit` 全绿(机械化
  验收,0 红色测试)。
- **SC-006**: 既有 PWA 功能(SW、离线、安装引导、更新)回归测试通过,无新增缺陷。
- **SC-007**: 整体 PWA 专业度提升——对照市面主流记账 PWA(或 PWA Checklist),本 app
  在 manifest 层无显著差距(定性走查)。

## Assumptions

- **沿用 029/030/031 的环境基线**:目标平台为 PWA / 移动浏览器(iOS Safari、Android
  Chrome)与桌面浏览器。本 feature 不扩展平台范围。
- **沿用既有 manifest 文件位置与格式**:`public/manifest.webmanifest`(静态 JSON),
  本 feature 只改其内容字段,不换文件位置、不换生成方式。
- **沿用既有 manifest 契约测试模式**:`src/tests/unit/pwa/manifest.test.ts` 直接读
  manifest JSON 断言。改 id 时同步更新断言。
- **P4(离线数据缓存 IndexedDB)不在范围**:它是大工程 + 产品定位决策,应单独立 spec。
  本 feature 只做 manifest 层打磨。
- **iOS 平台限制已知**:iOS Safari 对 shortcuts/screenshots 支持弱,本 feature 以
  Android/Chrome 为主要验收平台,iOS 行为作为已知限制记录,不阻塞。
- **截图需人工制图**:screenshots 的 PNG 文件需要人工制作(展示核心场景),本 feature
  spec 不规定具体制图工具,只规定内容、尺寸、体积约束。
- **shortcuts URL scheme 可能需要前置工作**:若当前路由不支持冷启动直达记账入口并
  预选类型,实现阶段评估成本;退化方案为指向 `/dashboard`(不预选),并在 research
  记录。
- **当前用户基数小,改 id 影响可接受**:MVP 阶段,改 manifest id 导致的"已安装用户
  重复图标"影响极小,且越早改代价越低。若实现阶段发现已有较多真实用户,需重新评估。
- **依赖宪章原则七(UI 调整纪律)**:本 feature 触及 manifest 与可能的图标资源,但
  manifest 是配置文件而非 `src/components/**/*.tsx` 的 JSX/className 改动;若实现中
  需要新增/改 UI 组件(如 shortcuts 触发后的预选逻辑),MUST 先查 `/heroui-react`
  skill。
