# Manifest 字段契约: 032 PWA Manifest 专业度打磨

**Branch**: `032-pwa-manifest-polish` | **Date**: 2026-07-18
**Spec**: [spec.md](../spec.md) | **Research**: [research.md](../research.md) R1-R6

本文件是 `public/manifest.webmanifest` 字段改动的**唯一契约**。tasks.md 的实现任务
MUST 遵守此契约;代码审查 MUST 据此核对。所有决策依据见 research.md 对应 R 编号。

## C1. 主题色(单一中性深色,research R1)

| 字段 | 修复前 | 修复后(契约) |
|---|---|---|
| `background_color` | `#ffffff` | **`#2a2a2d`**(对齐 layout.tsx viewport 深色 + globals.css `--background`) |
| `theme_color` | `#ffffff` | **`#2a2a2d`**(同上) |
| `dark_theme_color` | (无) | **不添加**(字段不存在,W3C/App-Info registry 均无) |

**约束**:
- manifest 规范 `theme_color`/`background_color` 均为**单值字符串**(不支持 media-query
  数组——那是 `<meta name="theme-color">` 独有)。
- 启动画面色来自 manifest `background_color`(非 viewport meta)。
- 取舍:深色用户受益(无白闪),浅色用户接受短暂中性深色启动(< 1s)。

满足: spec FR-001、FR-002、SC-001。

## C2. 稳定 id(URL 形式,research R2)

| 字段 | 修复前 | 修复后(契约) |
|---|---|---|
| `id` | `"/"` | **`/?balthasar`**(推荐)或保留 `"/"` |

**约束**:
- `id` MUST 是 URL 形式(裸字符串如 `"balthasar"` 不合规,被当相对 URL 解析成路径拼接)。
- `id` 一旦显式声明就独立于 `start_url`(start_url 变 id 不变)。
- `/?balthasar` 的 query 不影响路由(Next.js 忽略未知 query),仅让 id 可辨识。
- 改 id 会创建新 app 身份,旧安装孤立(MVP 阶段可接受)。

满足: spec FR-003、FR-004、SC-002。

## C3. shortcuts(记支出/收入/转账,research R3)

```json
"shortcuts": [
  {
    "name": "记一笔支出",
    "short_name": "支出",
    "description": "直接进入新建支出",
    "url": "/transaction/new?type=expense",
    "icons": [{ "src": "/pwa/shortcut-expense.png", "sizes": "96x96", "type": "image/png" }]
  },
  {
    "name": "记一笔收入",
    "short_name": "收入",
    "description": "直接进入新建收入",
    "url": "/transaction/new?type=income",
    "icons": [{ "src": "/pwa/shortcut-income.png", "sizes": "96x96", "type": "image/png" }]
  }
]
```

**约束**:
- `name` 必填,recommended ≥ 12 字符(用"记一笔支出"而非"记支出"保险)。
- `url` MUST 在 `scope: "/"` 内、同源;支持 query params。
- 走全屏页 `/transaction/new?type=`(Drawer 不在路由层,无法冷启动打开)。
- 预选类型需配套代码(见 C7)。
- iOS Safari 不支持(静默忽略,已知限制);Android Chrome 长按 + 桌面 Chrome app 菜单支持。
- (可选)第 3 条"记一笔转账"→ `/transaction/new?type=transfer`。

满足: spec FR-005、FR-006、SC-003。

## C4. screenshots(narrow + wide,research R4)

```json
"screenshots": [
  {
    "src": "/pwa/screenshots/dashboard-mobile.png",
    "sizes": "1080x1920",
    "type": "image/png",
    "form_factor": "narrow",
    "label": "Dashboard 概览(移动端)"
  },
  {
    "src": "/pwa/screenshots/new-transaction-mobile.png",
    "sizes": "1080x1920",
    "type": "image/png",
    "form_factor": "narrow",
    "label": "记一笔表单(移动端)"
  },
  {
    "src": "/pwa/screenshots/dashboard-desktop.webp",
    "sizes": "1920x1080",
    "type": "image/webp",
    "form_factor": "wide",
    "label": "Dashboard 概览(桌面端)"
  }
]
```

**约束**:
- 至少 1 张 `narrow` + 1 张 `wide`。
- narrow 比例 3:5~9:16(如 1080×1920);wide 比例 16:9/16:10(如 1920×1080);≤4096×4096。
- **`wide` 单张 < 200KB**(桌面 Chrome 每次访问预加载,Chromium #372285217),优先 WebP。
- narrow 不预加载,体积可稍宽但仍建议 < 200KB。
- 放 `public/pwa/screenshots/`。

满足: spec FR-007、FR-008、SC-004。

## C5. icons(192 加 maskable,research R5)

```json
"icons": [
  { "src": "/pwa/icon-192.png",          "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "/pwa/icon-192-maskable.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
  { "src": "/pwa/icon-512.png",          "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "/pwa/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```

**约束**:
- 192 与 512 都有独立 maskable 条目(分开 `any` + `maskable`,而非 `"any maskable"` 单条)。
- 192 maskable 复用既有 `public/pwa/icon-maskable-source.svg`(scale .65 → 中心 65%,
  在 maskable 安全区中心 80% 直径圆内)。
- 品牌标识 MUST 落在安全区内。

满足: spec FR-009、FR-010、SC-005(部分)。

## C6. 校验工具链(research R6)

| 层 | 工具 | 用途 |
|---|---|---|
| 开发迭代 | Chrome DevTools → Application → Manifest | 实时看解析值 + 可安装性错误 |
| 预发布审计 | [PWABuilder](https://www.pwabuilder.com/) | manifest 完整性 + 商店就绪度 |
| CI 回归 | Lighthouse PWA audit(已有) | manifest 完整性不回归 |

满足: spec FR-011。

## C7. shortcuts 配套代码改动(FR-006,触发原则七)

shortcuts 的 `?type=` 预选需要配套:

| 文件 | 改动 |
|---|---|
| `src/app/(app)/transaction/new/page.tsx` | 读 `type` query(expense/income/transfer),传给 `<TransactionForm>` |
| `src/components/transaction/transaction-form.tsx` | 新增 `defaultType?: "income"\|"expense"\|"transfer"` prop;`selectedType` 初始值取自 `defaultType ?? "expense"` |

**约束**:
- `defaultType` 仅在 create 模式生效(edit 模式由 editData.type 决定)。
- 触及 `src/components/**/*.tsx` props + `src/app/**/*.tsx` query 解析 → **宪章原则七触发**,
  实现前 MUST 查 `/heroui-react` skill(虽然改动是 props/query 非样式,但仍属组件改动范围)。
- 回归:`/transaction/new` 不带 type query 时,行为与修复前一致(默认 expense)。

满足: spec FR-006、FR-013。

## C8. 回归保护(FR-012)

既有 PWA 功能不破坏:
- SW 注册 / 离线 fallback(offline.html)/ 安装引导(beforeinstallprompt)/ 更新流程
  (SKIP_WAITING + buildId)/ iOS apple-touch-icon + appleWebApp meta —— 全部回归 0 缺陷。
- manifest 契约测试同步更新(id 断言)+ 新增字段断言。

满足: spec FR-012、SC-006。
