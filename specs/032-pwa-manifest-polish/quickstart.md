# Quickstart: 032 PWA Manifest 专业度打磨

**Branch**: `032-pwa-manifest-polish` | **Date**: 2026-07-18
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

本文件是**端到端验证指南**:如何用 Lighthouse + 真机/DevTools 证明 manifest 打磨生效。
不含实现代码(实现见 tasks.md)。

## 前置

| 项 | 值 |
|---|---|
| Node | 22.x LTS |
| pnpm | v11.9.0 |
| 验证浏览器 | Chrome/Edge 最新版(桌面 + Android)、Safari(iOS,已知 shortcuts/screenshots 限制) |
| 校验工具 | Lighthouse PWA audit(Chrome DevTools 内置)、Chrome `Application > Manifest` 面板、可选 [PWA Builder](https://www.pwabuilder.com/) |
| baseline 对照 | 修复前后同环境截图 |

## 1. 启动

```bash
pnpm install
pnpm build && pnpm start    # 生产构建( manifest 是静态文件,dev 也可但 build 更接近真实)
# 或 pnpm dev
# 访问 http://localhost:3000
```

## 2. 自动化测试(契约层)

```bash
pnpm test:unit src/tests/unit/pwa/manifest.test.ts
```

**预期**:全绿。重点断言(本 feature 后):
- `id` === 新稳定值(非 `"/"`)
- 主题色字段(浅色 + 深色)声明
- `shortcuts` 数组长度 ≥ 2,每条含 name + url
- `screenshots` 数组长度 ≥ 2,至少一张 narrow + 一张 wide
- 192 图标含 maskable purpose

## 3. Lighthouse PWA Audit(机械化验收)

Chrome DevTools → Lighthouse → 勾 "PWA" → Generate report。

**✅ 通过标准**:
- "Web app manifest meets installability requirements" ✅
- "Displays appropriate theme color" ✅(深色模式下识别到深色主题色)
- "Provides a valid apple-touch-icon" ✅(既有,不回归)
- 无 "maskable icon missing"、"shortcuts missing"、"screenshots missing" 等建议性警告(注:Lighthouse 核心审计不强制 shortcuts/screenshots,但 PWA Builder 会评估)

## 4. 真机/DevTools 走查(NEEDS-MANUAL)

### 4.1 US1 — 深色模式启动不白闪(P1)

1. 系统设为**深色模式**。
2. Chrome 安装 BALTHASAR 到桌面/主屏幕(或用 `chrome://webapk/` 预览)。
3. 启动 app,观察启动画面(splash)。
   - **✅ 通过**:启动画面背景为深色(与系统深色一致),无白色闪烁。
   - **❌ 修复前**:白闪一下再切深色。
4. 切浅色模式重装,确认浅色启动画面不回归。

### 4.2 US2 — 稳定 id(P1)

1. Chrome DevTools → Application → Manifest。
2. 查看 `id` 字段。
   - **✅ 通过**:`id` 为稳定字符串(非 `/`、非由 URL 推导)。
3. (可选)PWA Builder 检测,确认无"id derived from start_url"警告。

### 4.3 US3 — shortcuts 长按快速记账(P2)

1. **Android Chrome** 安装 app 到主屏幕。
2. 长按图标。
   - **✅ 通过**:快捷菜单出现"记支出""记收入"(可加"记转账"),带图标与标签。
3. 点"记支出"。
   - **✅ 通过**:app 打开,直达记账入口,交易类型预选为支出。
4. 点"记收入",确认预选为收入。
5. **桌面 Chrome**:安装后点 app 图标右键菜单,确认 shortcuts 出现。
6. **iOS**:长按图标,记录 iOS 实际行为(已知支持弱,不阻塞)。

### 4.4 US4 — screenshots 安装预览(P2)

1. Chrome 触发安装弹窗(地址栏右侧安装图标,或菜单"安装")。
2. 观察弹窗。
   - **✅ 通过**:弹窗内展示 ≥2 张产品截图(非仅图标+名字)。
3. DevTools → Application → Manifest,确认 `screenshots` 数组可解析、图片 URL 可访问。

### 4.5 US5 — 192 maskable(P3)

1. 用 [Maskable.app Editor](https://maskable.app/editor) 或 Chrome 检查 192 图标。
   - **✅ 通过**:192 声明 maskable purpose,品牌标识在安全区内。
2. DevTools → Application → Manifest,确认 192 有 maskable 条目。

## 5. 回归验收

既有 PWA 功能不破坏:
- [ ] SW 注册正常(DevTools → Application → Service Workers,显示 activated)
- [ ] 离线 fallback:断网后 navigate 请求回退 `offline.html`
- [ ] 安装引导(`beforeinstallprompt` / install-section)正常
- [ ] 更新流程(update-alert + SKIP_WAITING)正常
- [ ] iOS `apple-touch-icon` / `apple-mobile-web-app-*` meta 不回归

## 6. 平台矩阵

| 平台 | 必跑项 |
|---|---|
| Chrome 桌面(深色 + 浅色) | US1 启动色 / US2 id / US4 screenshots / US5 maskable |
| Chrome Android | US1 / US3 shortcuts(主验收平台) |
| Edge 桌面 | US1 / US2 / US4 |
| Safari iOS | 仅回归(US3/US4 已知限制) |

## 7. 边界场景

- **既有已安装用户**(改 id):本地 dev 安装的旧实例可能与新 id 并存,属预期(spec Q2 记录)。
- **manifest 缓存**:浏览器缓存 manifest,改后可能需 hard reload 或重装才能看到新值。验收前清缓存。
- **screenshots 体积**:确认单张 < 200KB,manifest 总体积 < 2KB。
- **shortcuts URL 冷启动**:点 shortcut 是冷启动,确认目标 URL 在冷启动(非热 app)下也能正确打开并预选类型。
