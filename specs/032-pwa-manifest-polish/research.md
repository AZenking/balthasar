# Research: 032 PWA Manifest 专业度打磨

**Branch**: `032-pwa-manifest-polish` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

本文件解决 plan Technical Context 中识别的未知项,并给出每个决策的 Decision / Rationale /
Alternatives。调研依据:W3C App Manifest spec、MDN、Chrome for Developers、web.dev、
Chromium issue tracker(详见各节链接),以及对项目文件的实地核查。

---

## R1. 深色启动色 —— `dark_theme_color` 不存在,只能改单一 `background_color`

### Decision
**修正 spec US1 / FR-001**:放弃"加 `dark_theme_color`"方案(该字段**不存在**)。
改为把 manifest 的单一 `background_color` 从 `#ffffff` 改为**中性深色 `#2a2a2d`**
(与 `layout.tsx:42` viewport 深色 themeColor + `globals.css` `--background: oklch(0.18 0.01 285.89)`
一致)。`theme_color` 同步改 `#2a2a2d`(注:`theme_color` 在规范里也是单值,但 `layout.tsx`
viewport 的 `<meta name="theme-color">` 已用 media-query 数组处理深浅色,manifest 的
`theme_color` 主要影响安装时呈现)。

### Rationale
- **`dark_theme_color` / `dark_background_color` 都不存在**:不在 [W3C App Manifest](https://www.w3.org/TR/appmanifest/)
  也不在 [Manifest App Info registry](https://www.w3.org/TR/manifest-app-info/),无任何
  浏览器实现。WICG 社区明确拒绝该提案([WICG thread](https://discourse.wicg.io/t/dark-theme-for-web-manifest-properties/5126/))。
- **manifest `theme_color` 不支持 media-query 数组**:那是 `<meta name="theme-color">`
  HTML tag 独有的形式([MDN theme_color](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/theme_color)),
  manifest 里只能是单值字符串。
- **启动画面(splash)色来自 manifest `background_color`**([MDN background_color](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/background_color)),
  **不**来自 viewport meta。所以深色白闪只能改 manifest。
- **为什么选中性深色而非浅色**:记账 app 是夜间高频工具,深色用户占比高;`#2a2a2d`
  在浅色模式下作为启动瞬间背景也可接受(启动到首屏 < 1s,中性深色不刺眼)。
- **取舍**:无法同时满足"深色用户深色启动 + 浅色用户浅色启动"——规范限制。选深色
  对夜间高频用户更友好,浅色用户短暂中性深色启动可接受。

### Alternatives Considered
| 方案 | 否决理由 |
|---|---|
| 加 `dark_theme_color` 字段 | 字段不存在(调研确认),写了被浏览器忽略,无效 |
| 两个 manifest + `<link media>` 切换 | 非标准,浏览器支持不可靠 |
| 保持 `#ffffff` 不改 | 深色用户白闪问题不解决,违背 US1 目标 |
| 中性灰(如 `#808080`) | 两端都不理想(深色嫌亮、浅色嫌暗);`#2a2a2d` 与产品深色主题一致更优 |

### 对 spec 的影响(需修正)
- **US1 acceptance 1/2**:无法做到"深色用户深色启动 + 浅色用户浅色启动",改为"启动
  色为中性深色 `#2a2a2d`,深色用户无白闪,浅色用户短暂中性深色启动可接受"。
- **FR-001**:改为"manifest `background_color` 与 `theme_color` 改为 `#2a2a2d`"。
- **SC-001**:对照标准改为"深色用户启动无白闪;浅色用户启动为中性深色(可接受)"。

---

## R2. 稳定 id —— 必须是 URL 形式,选 `/?balthasar` 或保留 `/`

### Decision
**修正 spec US2 / FR-003**:`id` 改成 `/?balthasar`(URL 形式 + 稳定 query 后缀)。
或更简的方案:**保留 `id: "/"`**(因为 `/` 本身就是合法且稳定的 URL 形式 id,问题在于
spec 原假设它"随 start_url 漂移"是误解)。

经核查 [MDN id](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/id)
+ [Chrome PWA id](https://developer.chrome.com/docs/capabilities/pwa-manifest-id):
- `id` 规则是"形如 URL 的字符串",相对路径会**对 `start_url` 解析**。
- `id: "/"` **已经是合法稳定 id**(不是"由 start_url 推导",而是显式声明的 URL 形式)。
- spec 原假设"id 用 / 会随 start_url 变化而漂移"**不准确**:`id` 一旦显式声明,就独立
  于 start_url(start_url 变了,id 不变)。

**最终选 `/?balthasar`**:虽然 `/` 合法,但加一个不影响的 query 后缀让 id 在 DevTools
里更可辨识(人眼能看出"这是 balthasar 的 id"),且未来若有正式域名可直接用绝对 URL。
**注:若优先最小改动,保留 `/` 也是合规的**——这是产品偏好,非正确性差异。

### Rationale
- `id` 一旦显式声明就稳定(不论 start_url 怎么变)。`/` 已显式声明,本就稳定。
- 裸字符串 `"balthasar"` **不合规**:会被当作相对 URL 解析成 `<start_url>balthasar`
  = `/dashboardbalthasar`,错误。
- 合法的稳定形式:`/`(当前)、`./balthasar`(→ `/balthasar`)、`/?balthasar`、绝对 URL。
- `/?balthasar` 的 query 不影响路由(Next.js 忽略未知 query),但让 id 可辨识。

### Alternatives Considered
| 方案 | 评价 |
|---|---|
| `/`(保留当前) | ✅ 合规稳定。spec 原担忧不成立。最小改动(0 改动)。 |
| `/?balthasar`(推荐) | ✅ 合规稳定 + 可辨识。需同步改测试断言。 |
| `./balthasar`(→ `/balthasar`) | 合规但 `/balthasar` 是个不存在的路径语义,易误解。 |
| 绝对 URL(`https://...`) | 未来有正式域名再用;当前 localhost/dev 域名不稳。 |
| 裸 `balthasar` | ❌ 不合规,被强制解析为路径拼接。 |

### 对 spec 的影响(需修正)
- **US2**:核心价值"未来 start_url 调整 id 不变"**其实已经成立**(`/` 已显式声明)。
  US2 改为"显式确认 id 的稳定性 + 可辨识性"。
- **FR-003**:改为"id 保持 URL 形式且显式声明(推荐 `/?balthasar`),不随 start_url 变化"。
- **SC-002**:Lighthouse 无"id 不稳定"警告(本来就无)。
- **测试**:若选 `/?balthasar`,更新 `manifest.test.ts:25` 断言;若保留 `/`,测试不动。

---

## R3. shortcuts —— URL 支持 query,走 `/transaction/new?type=`

### Decision
shortcuts 声明"记支出""记收入"(可选"记转账"),URL 走
`/transaction/new?type=expense` / `?type=income`(全屏页模式,既有路由)。
`url` 字段支持 query params([MDN shortcuts](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/shortcuts)),
MUST 在 `scope: "/"` 内、同源(满足)。

**需配套代码改动**:`/transaction/new/page.tsx` 当前只读 `id` query,需加读 `type` query
并传给 `TransactionForm` 作为 `defaultType`;`TransactionForm` 当前 `selectedType` 硬编码
`"expense"`,需加 `defaultType?` prop。

### Rationale
- **选全屏页而非 Drawer**:Drawer(`TransactionDrawer`)只在 Dashboard 用本地 `useState`
  控制,不在路由层,无法从 URL query 冷启动打开。改 Drawer 读 query 涉及 Dashboard 层
  联动,改动深。`/transaction/new` 既有全屏页路由,加 `type` query 解析是最小改动。
- **为什么预选类型有价值**:"记支出"快捷方式打开后若还是默认 expense,体验与"记收入"
  打开后默认 expense(用户要手动切)不对称,失去 shortcut 意义。
- **Android Chrome 长按、桌面 Chrome app 菜单/任务栏跳转列表均支持 shortcuts**;iOS
  Safari 不支持(静默忽略,作为已知限制)。
- **name 长度建议 ≥ 12 字符**否则 Chrome 可能丢弃——"记一笔支出"(5 中文字符 ≈ 满足
  字节长度,但保险起见用"记一笔支出"而非"记支出")。

### Alternatives Considered
| 方案 | 否决理由 |
|---|---|
| shortcuts 指向 `/?action=new` 让 Drawer 读 query | 需改 Dashboard + Drawer 联动,改动深,违反 YAGNI |
| shortcuts 只指向 `/dashboard` 不预选(退化方案) | "记收入"打开后仍是支出,失去 shortcut 意义 |
| 不做 shortcuts | 错失"10 秒记账"系统入口层加速(宪章五) |

### 对 spec 的影响(需补 FR)
- 新增 FR:**shortcuts 触发后,`/transaction/new?type=expense|income` MUST 预选对应类型**
  (需 `TransactionForm` 加 `defaultType` prop + `page.tsx` 读 type query)。
- 触及 `src/components/**/*.tsx` JSX/props 改动 → **宪章原则七触发**,实现前查 `/heroui-react`。

---

## R4. screenshots —— form_factor narrow/wide,Chrome 桌面会预加载

### Decision
声明 3 张截图:2 张 `narrow`(Dashboard 移动端、记一笔移动端)+ 1 张 `wide`(Dashboard
桌面端)。放 `public/pwa/screenshots/`,PNG 或 WebP,单张 < 200KB。

### Rationale
- [MDN screenshots](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/screenshots)
  + web.dev:Chrome 在 Android + 桌面安装弹窗展示截图;iOS 不展示。
- **关键 gotcha**:[Chromium #372285217](https://issues.chromium.org/issues/372285217) ——
  桌面 Chrome **每次页面访问都预加载 `wide` 截图**(即使未安装)。所以 wide 截图 MUST
  小(WebP + 压缩,< 200KB),避免拖累首屏。narrow 不预加载。
- 尺寸:narrow 3:5~9:16(如 1080×1920),wide 16:9/16:10(如 1920×1080),≤4096×4096。
- 数量推荐 3-8 张。

### Alternatives Considered
| 方案 | 否决理由 |
|---|---|
| 只放 narrow(移动优先) | 桌面安装弹窗无截图,转化低 |
| 只放 wide | 移动安装弹窗无截图(Android 是主战场) |
| 不压缩 | wide 预加载拖累桌面首屏性能 |

---

## R5. 192 maskable —— 必做,安全区中心 80%

### Decision
192 也声明 maskable purpose。用既有 `public/pwa/icon-maskable-source.svg`(已用
`transform: translate(90 90) scale(.65)` 把图标缩到中心 65%,落在 maskable 安全区)
生成 `public/pwa/icon-192-maskable.png`。manifest 的 192 条目加 maskable purpose
(或新增一条专门的 maskable 条目,见 alternatives)。

### Rationale
- [MDN icons](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons):
  Android 用 192 作主屏图标;无 maskable 变体会被 squircle/circle 裁掉关键内容。
- **安全区**:画布中心 80% 直径圆([maskable.app/editor](https://maskable.app/))。
  既有 maskable-512 源用 scale(.65) → 中心 65%,在 80% 安全区内,合规。
- **`purpose: "any maskable"` 合法但非最佳**:单条目同时服务两种 purpose 时,非 maskable
  场景(如 `any` 用于启动器非裁切渲染)下全出血(maskable)图会显得留白过多。最佳实践
  是**分开条目**(`any` 一条 + `maskable` 一条)。本 feature 采用分开条目。

### Alternatives Considered
| 方案 | 评价 |
|---|---|
| 192 用 `purpose: "any maskable"` 单条目 | 合规但 `any` 场景渲染不优 |
| 192 加独立 maskable 条目(推荐) | 最佳实践,渲染最优 |
| 不做 192 maskable | Android 主屏图标可能被裁(US5 目标未达) |

---

## R6. 校验工具链 —— DevTools 迭代 + PWABuilder 预发布 + Lighthouse CI 回归

### Decision
三层校验:
- **开发迭代**:Chrome DevTools → Application → Manifest(实时看解析值 + 可安装性错误)。
- **预发布审计**:[PWABuilder](https://www.pwabuilder.com/)(在线,不跑 Lighthouse,验证
  manifest + 打包商店就绪度)。
- **CI 回归**:Lighthouse PWA audit(CI 已有,确认 manifest 完整性不回归)。

### Rationale
- 三者覆盖不同场景:DevTools 快速迭代、PWABuilder 商店就绪度、Lighthouse 自动化回归。
- 项目已有 Lighthouse 在 CI(025 initiative),本 feature 复用。

---

## 总结:6 决策与 spec FR/SC 的映射 + 需修正项

| Decision | 满足的 FR | 对 spec 的修正 |
|---|---|---|
| R1 单一 `background_color: #2a2a2d` | FR-001/FR-002 | **修正 US1/FR-001/SC-001**:`dark_theme_color` 不存在,改为单一中性深色 |
| R2 id 用 `/?balthasar`(或保留 `/`) | FR-003 | **修正 US2/FR-003**:`/` 已稳定,核心价值是"显式声明 + 可辨识" |
| R3 shortcuts → `/transaction/new?type=` | FR-005/FR-006 | **新增 FR**:需 `TransactionForm` 加 `defaultType` + page 读 type(原则七触发) |
| R4 screenshots narrow+wide | FR-007/FR-008 | (spec 原文一致)wide 截图 < 200KB(Chromium 预加载) |
| R5 192 maskable 独立条目 | FR-009/FR-010 | (spec 原文一致)用既有 maskable SVG 源生成 |
| R6 三层校验工具链 | FR-011 | (spec 原文一致) |

**需回写 spec 的 3 处修正**(R1/R2/R3),见下节。

## 需回写 spec.md 的修正清单

1. **US1 + FR-001 + SC-001(R1)**:删除"加 dark_theme_color",改为单一
   `background_color`/`theme_color` = `#2a2a2d`;acceptance 调整为"中性深色启动"。
2. **US2 + FR-003(R2)**:id 保留 URL 形式,推荐 `/?balthasar`;澄清"`/` 本就稳定"。
3. **FR-006(R3)**:shortcuts 预选类型需配套 `TransactionForm.defaultType` +
   `/transaction/new` 读 type query;宪章原则七触发。

无其它 [NEEDS CLARIFICATION] 残留。Phase 0 完成,可进入 Phase 1 设计。
