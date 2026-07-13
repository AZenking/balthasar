# Implementation Plan: 1.0.0 奶油琥珀全站改版

**Branch**: `026-cream-amber-revamp` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/026-cream-amber-revamp/spec.md`

## Summary

把仓库 UI 层从 shadcn/Radix 全量迁移到 HeroUI v3(`@heroui/react` + `@heroui/styles`),落地"奶油琥珀"单一浅色主题;同时升级信息架构(底部 5 入口导航)、新增报表页、扩展首页能力(历史月份选择 / 隐私模式 / 分类下钻)、把 `/settings` 重组为"我的"并新增昵称 mutation。

零数据库 schema 变更,复用 `member.displayName`。tRPC 层新增 `dashboard.report` procedure 与 `auth.updateNickname` mutation,扩展 `dashboard.summary` 支持月份参数。

执行策略:**Spike + Switch 两个有序 PR 各 ≤ 7 天**。Spike 完成 HeroUI 安装 + 主题令牌 + 共享适配层(UI 不切换);Switch 完成全站切换 + 删除 shadcn 依赖。Spike 期间两库共存但只有 shadcn 在用。

## Technical Context

**Language/Version**: TypeScript 5.7+ (already in repo)

**Primary Dependencies**:
- 保留:Next.js 16 (App Router) / React 19 / Tailwind v4 / tRPC v11 / Drizzle / Better-Auth / `@dnd-kit/*` / `@hookform/resolvers` / `react-hook-form` / `zod` / `sonner` / `superjson` / `uuid` / `uuidv7` / `@tanstack/react-query`
- 新增:`@heroui/react`、`@heroui/styles`、`tailwind-variants`(HeroUI v3 必需)
- 删除(在 Switch PR 末尾):14 个 `@radix-ui/*` 子包、`cmdk`、`class-variance-authority`、`lucide-react`(若 HeroUI 自带图标够用)、`tw-animate-css`(若 HeroUI 不需要)、`@radix-ui/react-*` 任一遗留

**Storage**: PostgreSQL 16(零 schema 变更,仅复用现有 `member.displayName` 列)

**Testing**: Vitest 3 + `@testing-library/react` + `@testcontainers/postgresql`(保留)

**Target Platform**: Web 浏览器,移动端优先(375px–430px 视口)+ 桌面端居中布局

**Project Type**: web-app(Next.js 全栈,T3 stack)

**Performance Goals**:
- `dashboard.summary` query p95 < 500ms(宪章五已有,扩展 month 参数后保持)
- `dashboard.report` query p95 < 800ms(新 procedure;6 个月 × 多分类聚合,需 research 验证)
- `auth.updateNickname` mutation p95 < 300ms(宪章五 mutation 预算)
- 首页月份切换 < 500ms 用户感知(SC-007)
- Lighthouse accessibility ≥ 90(SC-004)

**Constraints**:
- 移动端 375px 无横向滚动;可点击元素 ≥ 44×44px
- 隐私模式无金额闪现(SC-008,SSR/CSR 协调或 inline script)
- 宪章 §技术栈 MAJOR 修订(shadcn → HeroUI)与代码同 PR

**Scale/Scope**:
- 涉及页面:8 个(登录 / 注册 / Dashboard / 账单 / 记账 / 账户 / 分类 / API Key);其中 `/settings` 重组为"我的",新增 `/reports`
- shadcn 组件:14 个 primitive 需替换
- 新增/扩展 procedure:3 个(`dashboard.summary` 扩展、`dashboard.report` 新增、`auth.updateNickname` 新增)
- 历史 spec 引用更新:008/009/010/023/024/025

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 状态 | 说明 |
|------|------|------|
| 一、MVP 范围 | ⚠️ Violation(已正当化) | 新增 `/reports` 报表页超出 MVP 严格列表(登录/Dashboard/交易/流水/账户/分类/设置)。**正当理由**:报表是 Dashboard + 流水的衍生可视化(月度趋势 + 分类占比),不属于宪章一明文排除项(转账、预算、AI、OCR、导入导出、投资、多币种)。**迁移计划**:在 1.0.0 release notes 与 `docs/MVP.md` 中标注"1.0.0 扩展:报表页是 Dashboard 衍生"。详见 Complexity Tracking 表。 |
| 二、Feature-Sliced Architecture | ✅ Pass | 026 不改架构。前端继续 `src/app/<feature>/page.tsx` + `src/components/<feature>/`;后端继续 `src/server/api/routers/<feature>.ts`;新 procedure 入 `routers/dashboard.ts` 与 `routers/auth.ts`。 |
| 三、领域驱动设计 | ✅ Pass | `Family` 仍是唯一聚合根。026 不引入新表 / 新聚合 / 新不变量;`member.displayName` 复用,不涉及聚合边界。 |
| 四、测试优先 | ✅ Pass | spec FR-G004(单元:月份范围 / 周补零 / 跨年 / 隐私 trim / mutation 隔离)+ FR-G005(集成:summary 月参数 / report 6 月趋势 / mutation family 隔离 / 下钻越权防御)。tasks 阶段先红后绿。 |
| 五、性能与极速录入 | ✅ Pass(待 research 验证 report) | `summary` / `report` / `updateNickname` 都有 p95 目标。mutation 不变,query 扩展 month 维度需保持 p95 < 500ms,新 report p95 < 800ms 需 research 验证 SQL 聚合成本。 |
| 六、简单 (YAGNI) | ✅ Pass | 显式排除通知/预算/净资产;一次性迁移而非双库长期共存;24 个月窗口;不引入大型图表库;不做暗色模式;`/settings` 不改路由仅改文案。 |
| 技术栈 §UI 组件 | ⚠️ MAJOR Revision | shadcn/ui → HeroUI v3。spec FR-H001/H002 已要求宪章 v2.0.0 → v3.0.0 同 PR 修订,同步影响报告 MAJOR。 |

**Gate 结论**:1 项可正当化 violation(原则一报表页)+ 1 项 MAJOR 技术栈修订。两项均写入 Complexity Tracking 表,允许 Phase 0/1 继续。

## Project Structure

### Documentation (this feature)

```text
specs/026-cream-amber-revamp/
├── spec.md               # /speckit-specify 输出(已完成)
├── plan.md               # 本文件
├── research.md           # Phase 0 输出
├── data-model.md         # Phase 1 输出(tRPC procedure IO schema,零 DB 变更)
├── contracts/            # Phase 1 输出(procedure 契约文档)
│   ├── dashboard-summary.md
│   ├── dashboard-report.md
│   └── auth-update-nickname.md
├── quickstart.md         # Phase 1 输出(端到端验证手册)
└── tasks.md              # Phase 2 输出(/speckit-tasks,本命令不创建)
```

### Source Code (repository root)

```text
src/
├── app/                              # Next.js App Router
│   ├── (auth)/                       # 登录 / 注册(shadcn → HeroUI 切换)
│   ├── (app)/                        # 已登录区
│   │   ├── dashboard/page.tsx        # 首页(扩展月份选择 / 隐私 / 下钻)
│   │   ├── transactions/page.tsx     # 账单(读 URL 筛选)
│   │   ├── transaction/new/page.tsx  # 记一笔(底部凸起入口)
│   │   ├── transaction/[id]/edit/    # 编辑(保留来源页参数)
│   │   ├── reports/page.tsx          # 报表页(新)
│   │   ├── settings/page.tsx         # "我的"(原 /settings 重组)
│   │   ├── accounts/                 # 保留
│   │   └── layout.tsx                # 底部 5 入口导航(新)
│   ├── globals.css                   # 奶油琥珀令牌 + HeroUI @import
│   └── layout.tsx
├── components/
│   ├── ui/                           # Spike 期:HeroUI 适配层落地;Switch 末:shadcn 文件全删
│   ├── bottom-navigation.tsx         # 新:5 入口底部导航
│   ├── privacy-provider.tsx          # 新:localStorage 隐私态 + SSR 安全
│   ├── dashboard/                    # 月份选择器 / Top 2 分类卡 / 周维度趋势 SVG
│   ├── reports/                      # 月度趋势 SVG / 分类分析卡
│   └── [现有目录保留]
├── lib/
│   ├── theme.ts                      # 新:奶油琥珀令牌 + HeroUI 语义映射
│   ├── privacy.ts                    # 新:localStorage key / 读写工具
│   └── date-ranges.ts                # 新:UTC 月份范围 / 自然周补零 / 跨月周
└── server/
    ├── api/routers/
    │   ├── dashboard.ts              # 扩展 summary + 新增 report
    │   ├── auth.ts                   # 新增 updateNickname mutation
    │   └── [其它 router 保留]
    └── db/schema/                    # 零变更

docs/
├── THEME.md                          # 新:奶油琥珀主题文档
└── [现有文档保留]

.specify/memory/constitution.md       # v2.0.0 → v3.0.0 同 PR 修订
```

**Structure Decision**:沿用现行 Feature-Sliced 单仓结构,不引入新顶层目录。`components/ui/` 在 Spike 期作为 HeroUI 适配层(可选,用于跨页共享的小封装),Switch 末删除 shadcn 原生 14 件。`components/bottom-navigation.tsx` 与 `components/privacy-provider.tsx` 是本次新增的横切组件,放在 `components/` 根而非 `components/ui/`(因为它们是业务组件,不是 UI primitive)。

## Complexity Tracking

> 填写因为 Constitution Check 有 violations 需要正当化

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 原则一(MVP 范围):新增 `/reports` 报表页 | 报表是 Dashboard + 流水的衍生复盘能力,1.0.0 major release 是宣告"MVP 迭代期结束"的合理扩展点。家庭记账场景下月度趋势 + 分类占比是高频复盘需求,缺失会让用户落到 Excel 补位。 | "不做报表,1.0.0 只做 UI 迁移" 被否决:用户在 specify 阶段明确要求报表作为 1.0.0 内容,且报表数据完全复用现有 Transaction 表,无新表/新聚合根/新外部依赖,边际成本低。 |
| 技术栈 §UI 组件:shadcn → HeroUI v3 (MAJOR) | 用户在 specify 阶段明确要求全量切换。HeroUI v3 提供:oklch 主题系统、React Aria 无障碍、组合式 API、Tailwind v4 原生支持,与项目 Next.js 16 / React 19 / Tailwind v4 栈对齐。 | "保留 shadcn 不动" 被否决:用户决策;HeroUI v3 在 a11y / 主题系统 / 组合 API 上对单人维护更友好。"渐进式双库共存" 被否决:违反 YAGNI,长期维护成本高于短期切换成本。 |
