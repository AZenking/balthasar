# 主题:HeroUI v3 默认配色

026-cream-amber-revamp 修订(2026-07-13):放弃奶油琥珀自定义令牌,改用 HeroUI v3 默认主题。`@heroui/styles` 已注入完整 token,组件层直接消费,业务语义通过 HeroUI variant 表达。

## HeroUI 默认 token(由 @heroui/styles 注入)

完整定义见 `node_modules/@heroui/styles/dist/themes/default/variables.css`。常用项:

| CSS 变量 | 默认值 | 语义 | 用途 |
|---|---|---|---|
| `--background` | `oklch(0.9702 0 0)` | 页面底色 | `<body>` 背景 |
| `--surface` | `var(--white)` | 卡片底色 | Card / Modal / Popover |
| `--surface-secondary` / `--surface-tertiary` | oklch(94%) / oklch(93.7%) | 分层卡片 | 嵌套 Card |
| `--foreground` | `var(--eclipse)` ≈ oklch(0.21) | 主文字 | 标题 / 正文 |
| `--muted` | `oklch(0.5517 0.0138 285.94)` | 次文字 / 占位 | 辅助说明 |
| `--accent` | `oklch(0.6204 0.195 253.83)` ≈ 蓝 | 主强调 | Button primary / 链接 / focus |
| `--accent-foreground` | `var(--snow)` | accent 上的文字 | primary 按钮文字 |
| `--default` | `oklch(94% 0.001 286.375)` | 中性背景 | secondary 按钮 |
| `--success` | `oklch(0.7329 0.1935 150.81)` ≈ 绿 | 成功 / 收入 | 见业务映射 |
| `--warning` | (见 HeroUI variables.css) | 警告 | — |
| `--danger` | (见 HeroUI variables.css) | 危险 / 支出 | 见业务映射 |

> 不再维护 TS 端真相源 —— HeroUI 的 `variables.css` 是单一真相源。

## 业务语义映射(组件层)

记账场景的两个核心业务色,通过 HeroUI variant / token 表达,不引入业务自定义变量:

| 业务语义 | HeroUI 表达 | 适用场景 |
|---|---|---|
| **收入(income)** | `--success` / `variant="success"` / Tailwind 类 `text-success` | 收入金额、正向趋势、Top 收入分类 |
| **支出(expense)** | `--danger` / `variant="danger"` / Tailwind 类 `text-danger` | 支出金额、负向趋势、删除按钮 |

组件迁移(US1 / Phase 3)时,所有原"奶油琥珀 income/expense"调用改为 HeroUI success/danger variant。

## 修改主色的步骤

主色 = HeroUI `--accent`(默认蓝)。若要改色:

1. **覆盖 token**:在 `src/app/globals.css` 加 `:root { --accent: oklch(...); }`(覆盖 HeroUI 默认)。
2. **跑 dev**:`pnpm dev`,刷新页面看 accent 按钮颜色变化。
3. **不需要双写 / 不需要跑测试**(没有 TS 端真相源;HeroUI 的 CSS 变量直接生效)。

> HeroUI v3 推荐 oklch(感知均匀)。换算工具:[oklch.com](https://oklch.com)。

## 暗色模式(本期不启用)

- HeroUI v3 默认支持暗色(`<html class="dark">` 切换;`themes/dark/variables.css` 自动加载)。
- **本期(026 / 1.0.0)明确不做暗色**(spec Assumptions:用户决策"深色不在本期")。
- 若未来启用:(1) 在 `layout.tsx` 加暗色 toggle(类似隐私模式 inline script);(2) HeroUI 自动切换 token,无需额外 CSS。

## 相关文件

| 文件 | 作用 |
|---|---|
| `src/app/globals.css` | 仅含 `@import "@heroui/styles"` + 隐私 CSS,无 token override |
| `node_modules/@heroui/styles/dist/themes/default/variables.css` | HeroUI 默认 token 真相源(只读) |
| `specs/026-cream-amber-revamp/spec.md` FR-A005 | 令牌规范(待同步:奶油琥珀 → HeroUI 默认) |
| `specs/026-cream-amber-revamp/data-model.md` §2.7 | ThemeToken 契约(待同步) |
