# Data Model: 032 PWA Manifest 专业度打磨

**Branch**: `032-pwa-manifest-polish` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

## 持久化实体

**无。** 本 feature 是纯静态 manifest 配置 + 静态资源(PNG 图标/截图),不触及:
- 数据库 schema —— 无
- tRPC procedure —— 无
- 领域函数 —— 无
- Drizzle migration —— 无
- IndexedDB / localStorage —— 无(031 的 draft-storage 不在本范围)

依据宪章原则三(领域驱动)与本 feature spec Clarifications Q1 范围限定(P4 离线缓存另开 033),领域与数据层完全不受影响。

## 配置实体(静态 manifest 字段,非持久化)

本 feature 涉及的是 `public/manifest.webmanifest` 的**字段配置实体**,由浏览器/PWA 运行时读取,不经应用代码持久化。记录于此供 tasks.md 与 contracts 引用:

### CE-1: 主题色(浅色 + 深色)

- **职责**:驱动启动画面(splash)背景色、标题栏/状态栏配色。
- **字段**:`theme_color` / `background_color` / `dark_theme_color`(若浏览器支持,见 research)。
- **真相源**:`src/app/layout.tsx` viewport `themeColor` 已声明浅色 `#ffffff` + 深色 `#2a2a2d`(与 globals.css `--background: oklch(0.18 0.01 285.89)` ≈ `#2a2a2d` 一致)。manifest MUST 对齐此真相源。
- **当前问题**:manifest 写死 `#ffffff`,深色用户安装时启动画面白闪。

### CE-2: 稳定 id

- **职责**:PWA 的唯一身份标识,独立于 start_url。
- **当前**:`id: "/"`(由 start_url 推导,不稳定)。
- **目标**:稳定字符串(如 `balthasar`),不随 start_url 变化。
- **迁移代价**:已安装用户(/ id)与新 id 并存(MVP 阶段可接受,spec Q2 记录)。

### CE-3: shortcuts(快捷入口)

- **职责**:系统级长按/右键菜单的快速操作。
- **字段数组**:每条含 `name` / `short_name` / `url` / `icons`(可选)/ `description`(可选)。
- **内容**:"记支出" → 预选 expense;"记收入" → 预选 income(可加"记转账")。
- **URL 目标**:由 research 决定(`/transaction/new?type=expense` 全屏页,或让 Drawer 读 query)。MUST 在 `scope: "/"` 内、同源。
- **依赖**:TransactionForm 的 `selectedType` 当前硬编码 `"expense"`,无 prop 入口 → 预选类型需加 `defaultType` prop(改动见 contracts)。

### CE-4: screenshots(安装预览图)

- **职责**:安装弹窗内的产品截图,提升安装转化。
- **字段数组**:每条含 `src` / `sizes` / `type` / `form_factor`("narrow"|"wide") / `label`(可选)。
- **内容**:2-3 张(Dashboard / 记一笔 / 流水),至少一张窄屏 + 一张宽屏。
- **资源**:PNG,放 `public/pwa/screenshots/`,单张 < 200KB。

### CE-5: icons(含 192 maskable)

- **职责**:各场景的 app 图标(启动器、通知、安装弹窗、自适应图标)。
- **当前**:192(any) + 512(any) + 512(maskable)。
- **目标**:192 也加 maskable(Android 自适应图标小尺寸场景裁切更稳)。
- **生成**:既有 `public/pwa/icon-maskable-source.svg`(用 `transform: translate+scale(.65)` 把图标缩到中心 65%,落在 maskable 安全区)。192 maskable 用同源生成。
- **安全区**:maskable 内容 MUST 落在中心 80%(或 research 确认的精确值)内。

## 关系图(配置层)

```text
public/manifest.webmanifest
  ├─ CE-1 theme_color / background_color [/ dark_theme_color]  ← 对齐 layout.tsx viewport
  ├─ CE-2 id: "balthasar"(稳定字符串)                          ← 替换 id: "/"
  ├─ CE-3 shortcuts[]                                           ← 新增
  │    ├─ {name:"记支出", url:"/transaction/new?type=expense"}  ← URL scheme 由 research 定
  │    └─ {name:"记收入", url:"/transaction/new?type=income"}
  ├─ CE-4 screenshots[]                                         ← 新增(public/pwa/screenshots/)
  │    ├─ {form_factor:"narrow", src:".../dashboard-mobile.png"}
  │    └─ {form_factor:"wide",   src:".../dashboard-desktop.png"}
  └─ CE-5 icons[]                                               ← 192 加 maskable
       ├─ {src:"icon-192.png", purpose:"any"}                   (既有)
       ├─ {src:"icon-192-maskable.png", purpose:"maskable"}     ← 新增
       ├─ {src:"icon-512.png", purpose:"any"}                   (既有)
       └─ {src:"icon-maskable-512.png", purpose:"maskable"}     (既有)

src/app/(app)/transaction/new/page.tsx  ← 若 shortcuts 走全屏页:读 ?type= 传给 TransactionForm
src/components/transaction/transaction-form.tsx ← 加 defaultType prop(若预选类型)
src/tests/unit/pwa/manifest.test.ts     ← 同步更新(id 断言)+ 新增字段断言
```

注:CE-3 shortcuts 的 URL 目标与是否需要改 `TransactionForm`/`page.tsx`,由 research.md R4 决策定。若选"退化方案"(shortcuts 指向 `/dashboard` 不预选),则不改这些组件。
