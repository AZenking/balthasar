# Baseline: 032 PWA Manifest 专业度打磨

**Branch**: `032-pwa-manifest-polish` | **Created**: 2026-07-18

本文件归档"修复前/后"PWA manifest 五项核心字段状态,作为 PR 对照基准。
对齐 `specs/029-mobile-keyboard-layout/baseline.md` 与 `specs/031-drawer-keyboard-and-tabs/baseline.md`
模式:机械化测量 + NEEDS-MANUAL(GUI/真机)分项。

## 环境

| 项 | 值 |
|---|---|
| Node | 22.x LTS |
| pnpm | v11.9.0 |
| HeroUI | `@heroui/react` / `@heroui/styles` v3.2.2 |
| 验证浏览器 | Chrome/Edge 最新(桌面 + Android)、Safari(iOS 已知限制) |
| 校验工具 | Chrome DevTools Application 面板、Lighthouse PWA audit、PWABuilder |
| 测量日期(NEEDS-MANUAL) | [待填写] |

## 修复前(BEFORE,Phase 3 之前)

### manifest 五项核心字段现状

| 项 | 修复前值 | 状态 |
|---|---|---|
| `background_color` / `theme_color` | `#ffffff`(双白) | ⚠️ 深色用户启动白闪 |
| `id` | `"/"` | ✅ 已显式 URL 形式(research R2 澄清本就稳定,本 feature 仅做可辨识优化) |
| `shortcuts` | 无 | ❌ 缺失(长按图标无快速记账入口) |
| `screenshots` | 无 | ❌ 缺失(安装弹窗无预览图) |
| 192 `maskable` | 无(仅 512 maskable) | ⚠️ Android 小尺寸图标场景裁切不稳 |

### 自动化测试基线(机械化)

| 项 | 值 |
|---|---|
| `pnpm test:unit src/tests/unit/pwa/manifest.test.ts` | **1 测试 全绿**(既有,断言 id === "/" + 3 图标) |
| `pnpm build` | [NEEDS-MANUAL:Phase 3 前跑一次确认 TS strict 通过] |

### 真机/DevTools 走查基线(NEEDS-MANUAL)

走查步骤(对应 quickstart.md §3-5):

1. **深色模式启动**:Chrome 安装到桌面/主屏幕 → 首启观察启动画面
   - [NEEDS-MANUAL:截图 1 — 预期症状:深色模式下白色启动闪一下再切深色]
2. **DevTools Application 面板**:读 manifest 解析值
   - [NEEDS-MANUAL:截图 2 — id/theme_color/background_color/shortcuts/screenshots 当前值]
3. **Lighthouse PWA audit**:跑一次 PWA 报告
   - [NEEDS-MANUAL:截图 3 — 记录 manifest 相关审计项通过/警告状态]
4. **长按图标(Android)**:看 shortcuts 菜单
   - [NEEDS-MANUAL:截图 4 — 预期:无快捷菜单]
5. **Chrome 安装弹窗**:看 screenshots
   - [NEEDS-MANUAL:截图 5 — 预期:仅图标+名字,无预览图]

## 修复后(AFTER,v1.1.2 已发布 + 真机验证通过)

> 2026-07-18:v1.1.2 已发布(Docker 镜像 `app:1.1.2` 上线),US1/US2/US3/US5
> 真机验证通过(用户确认)。同日补齐 US4 的 3 张 production 截图、manifest 声明与
> 契约测试；Chrome 安装弹窗展示仍待 T028 真机确认。

### MVP(US1 + US2 + US5)— ✅ 验证通过

| 项 | BEFORE | AFTER | 验收结果 |
|---|---|---|---|
| `background_color` / `theme_color` | `#ffffff` | `#2a2a2d` | ✅ manifest 契约测试断言 + 真机深色启动无白闪 |
| `id` | `"/"` | `/?balthasar` | ✅ manifest 契约测试断言 + DevTools 可辨识 |
| 192 `maskable` | 无 | 独立条目 `purpose: "maskable"` | ✅ manifest 契约测试断言 + 图标渲染正常 |
| 深色模式启动 | 白闪 | 中性深色 `#2a2a2d` 无白闪 | ✅ 真机验证通过 |
| manifest 测试 | 1 passed | **6 passed**(id + 主题色 + 192 maskable + shortcuts + screenshots + 既有) | ✅ `pnpm test:unit manifest.test.ts` |

### US3(shortcuts)— ✅ 验证通过(PR #18 / v1.1.2)

| 项 | BEFORE | AFTER | 验收结果 |
|---|---|---|---|
| `shortcuts` 数组 | 无 | 3 条(记支出/收入/转账) | ✅ manifest 契约测试断言 + 真机长按图标出现 |
| 预选类型配套 | n/a | `TransactionForm.defaultType` + page 读 type query + `parseDefaultType` | ✅ 单元测试(4)+ 真机点击 shortcut 预选正确 |

### US4(screenshots)— 🟡 资源与契约完成，安装弹窗待真机确认

| 项 | BEFORE | AFTER | 状态 |
|---|---|---|---|
| `screenshots` 数组 | 无 | 3 条(2 narrow + 1 wide，含完整元数据) | ✅ manifest 契约测试通过(T026/T027) |
| 截图资源 | 无 | 2×1080×1920 PNG + 1×1920×1080 WebP | ✅ 169872 / 85817 / 26160 bytes，均 < 200KB(T025) |
| Chrome 安装弹窗 | 仅图标+名字 | 展示 ≥2 张产品截图 | ⏳ 待 T028 真机确认 |

### 回归

| 项 | BEFORE | AFTER |
|---|---|---|
| `pnpm test:unit`(全量) | 329(1.1.1) | ✅ **337 全绿**(+8:manifest 契约 + parseDefaultType) |
| `pnpm build` | ✓ | ✓ Compiled successfully |
| `pnpm lint` | 0 error | ✅ 0 error(54 既有 warning) |
| `pnpm exec tsc --noEmit` | 0 | ✅ 0 错误 |
| 既有 PWA(SW/离线/安装/更新) | 正常 | ✅ 真机回归正常(用户确认) |
