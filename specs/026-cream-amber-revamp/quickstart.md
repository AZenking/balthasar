# Quickstart: 1.0.0 奶油琥珀全站改版 验证手册

**Feature**: 026-cream-amber-revamp | **Date**: 2026-07-13

本手册给出**端到端验证场景**,证明 spec 实现正确。每个场景独立可执行,失败时给出排错路径。按 Spike PR → Switch PR → 1.0.0 release 三阶段组织。

---

## 前置条件

- 仓库已 clone,工作目录在仓库根
- 已登录 `gh` CLI(`gh auth status` ✓)
- 本地 git user 与远端一致
- `pnpm` v10+ 已安装
- Docker 已运行(用于 testcontainers 集成测试)
- 0.2.0 已发完(026 启动的前置条件)

```sh
# 一键自检
gh auth status && \
  git status --porcelain && \
  pnpm --version && \
  docker version --format '{{.Server.Version}}' >/dev/null && echo "all good"
```

---

## 阶段 1:Spike PR 验证(基础设施)

**目标**: HeroUI v3 安装 + 奶油琥珀令牌 + 共享工具落地,**所有页面继续用 shadcn,无视觉变化**。

### 场景 1.1:依赖安装 + Hello World

**步骤**:
1. 切分支:`git checkout main && git pull && git checkout -b feat/026-spike`
2. 安装:`pnpm add @heroui/react @heroui/styles tailwind-variants`
3. 修改 `src/app/globals.css`,在 `@import "tailwindcss"` 之后加 `@import "@heroui/styles"`,落地 9 个奶油琥珀 CSS 变量
4. 临时验证路由 `src/app/dev/heroui-test/page.tsx`(用 HeroUI `<Button>`,删除前确认 styling 生效)
5. `pnpm dev` → 访问 `/dev/heroui-test`,确认按钮颜色为奶油琥珀 accent (#C79032)
6. 删除临时路由,提交

**期望结果**:
- ✅ `/dev/heroui-test` 显示奶油琥珀色 HeroUI Button
- ✅ `pnpm type-check` 通过
- ✅ `pnpm test` 全绿
- ✅ 所有现有页面(/dashboard /transactions /settings)视觉无变化

**排错**:
- HeroUI 样式不生效 → 检查 `globals.css` `@import` 顺序(tailwind 必须在前);验证 `postcss.config.js` 含 `@tailwindcss/postcss`
- Tailwind v4 config 不识别 → HeroUI v3 用 CSS-first config(`@theme` in globals.css),不依赖 `tailwind.config.js`

### 场景 1.2:共享工具落地(date-ranges / privacy / theme)

**步骤**:
1. 落地 `src/lib/date-ranges.ts`(4 个函数:getUtcMonthRange / getUtcWeeksInMonth / padDailyBuckets / getLast24Months)
2. 落地 `src/lib/privacy.ts`(localStorage key + 读写工具)
3. 落地 `src/lib/theme.ts`(令牌常量)
4. 在 `src/app/layout.tsx` `<head>` 注入隐私 inline script
5. **先写测试**(宪章四):
   - `tests/unit/date-ranges.test.ts`:跨年 / 首尾周 / 闰年 / 补零 / 24 月降序
   - `tests/unit/privacy.test.ts`:trim / 读写 / 默认值
   - `tests/unit/theme.test.ts`:lib/theme.ts 与 globals.css 一致性
6. `pnpm test:unit` → 红转绿

**期望结果**:
- ✅ 单元测试 ≥ 20 个用例,全绿
- ✅ `theme.ts` 与 `globals.css` 令牌值完全一致(单元测试断言)
- ✅ 隐私 inline script 注入 `<head>`(DevTools Elements 可见)

### 场景 1.3:主题文档落地

**步骤**:
1. 落地 `docs/THEME.md`,列出 9 个语义令牌、修改示例、`oklch` 色彩空间说明
2. 在文档中标注:本期单一奶油琥珀浅色,暗色模式保留 token 但不暴露切换

**期望结果**:
- ✅ `docs/THEME.md` 存在,内容完整
- ✅ 新人 30 分钟内能凭文档修改主色并看到效果(主观验证)

### 场景 1.4:Spike PR 合并

**步骤**:
1. `git push -u origin feat/026-spike`
2. `gh pr create --title "feat(026): Spike - HeroUI v3 + cream-amber theme + shared utils" --body "..."`
3. CI 必须全绿(lint 非阻塞 / type-check + test MUST)
4. `gh pr merge --squash --delete-branch`

**期望结果**:
- ✅ main 上多一条 squash commit
- ✅ 短分支 ≤ 7 天(spec-015 FR-003)
- ✅ Spike PR 不含任何 UI 切换 / shadcn 删除

---

## 阶段 2:Switch PR 验证(全站切换 + 新功能)

**目标**: 完成所有页面切换、新增报表页、新增 procedure、删除 shadcn。

### 场景 2.1:后端 procedure 扩展(测试先行)

**步骤**(TDD):
1. 切分支:`git checkout -b feat/026-switch`(基于 main,Spike 已合并)
2. **先写集成测试**:
   - `tests/integration/dashboard/summary.test.ts`:扩展含 year/month 参数场景(10 个用例,见 [dashboard-summary.md Test Scenarios](./contracts/dashboard-summary.md))
   - `tests/integration/dashboard/report.test.ts`:新 procedure(8 个用例,见 [dashboard-report.md](./contracts/dashboard-report.md))
   - `tests/integration/auth/update-nickname.test.ts`:新 mutation(9 个用例,见 [auth-update-nickname.md](./contracts/auth-update-nickname.md))
3. `pnpm test:integration` → 应**全红**(procedure 未实现)
4. 实现:
   - 扩展 `src/server/api/routers/dashboard.ts` 的 `summary`(加 input parser + month range 解析 + expenseTrend 聚合)
   - 新增 `dashboard.report` procedure
   - 新增 `auth.updateNickname` mutation 在 `src/server/api/routers/auth.ts`
5. `pnpm test:integration` → 转绿

**期望结果**:
- ✅ 所有集成测试通过(27 个新用例 + 现有不变)
- ✅ tRPC 类型自动派生,前端 `trpc.dashboard.report.query(...)` 类型安全
- ✅ `dashboard.summary` p95 < 500ms(本地试压)
- ✅ `dashboard.report` p95 < 800ms

### 场景 2.2:底部导航 + 报表页

**步骤**:
1. 新建 `src/app/(app)/layout.tsx`(若已存在则修改),含底部 5 入口导航
2. 新建 `src/app/(app)/reports/page.tsx`,用 HeroUI 组件 + 自建 SVG 图表
3. 单元测试覆盖图表组件的 ARIA / role

**期望结果**:
- ✅ `/reports` 可访问,显示近 6 个月趋势 + 当前月分类分析
- ✅ 点击趋势月份 → 分类分析切换
- ✅ 点击分类块 → 跳转 `/transactions?month=...&type=expense&categoryId=...`
- ✅ 底部 5 入口正确(首页/账单/记一笔凸起/报表/我的)

### 场景 2.3:首页重做

**步骤**:
1. 重做 `src/app/(app)/dashboard/page.tsx`:
   - 顶部"轻记记" + 动态问候 + 昵称 + 月份 Select(24 月)+ 隐私按钮
   - 主卡显示"本月结余"+ 收入/支出
   - Top 2 分类卡(可点击下钻)
   - 周维度 SVG 趋势图
   - 最近 4 条流水(不受月份影响)
2. 隐私按钮调用 `lib/privacy.ts` 工具,inline script 已在 layout 落地

**期望结果**:
- ✅ 切换月份,主卡 + Top 2 + 周维度图随之变化
- ✅ 最近流水不受月份影响
- ✅ 点击 Top 2 分类卡跳账单页,URL 含 month/type/categoryId
- ✅ 开启隐私,所有金额立即变 `***`
- ✅ 刷新页面,隐私态保持(无金额闪现)

### 场景 2.4:账单页 URL 筛选同步

**步骤**:
1. 修改 `src/app/(app)/transactions/page.tsx`,从 `useSearchParams` 读 `month/type/categoryId`
2. 无效或无权限的 `categoryId` 安全忽略(spec FR-C006 acceptance 3)
3. 编辑交易后返回时,保留原 URL 参数(spec FR-B004)

**期望结果**:
- ✅ 从首页 Top 2 跳来,自动应用筛选
- ✅ 直接访问 `/transactions?type=income&categoryId=xxx` 正确筛选
- ✅ 编辑某笔返回,URL 参数仍在

### 场景 2.5:"我的"页面重组 + 昵称 mutation

**步骤**:
1. 修改 `src/app/(app)/settings/page.tsx`,文案改"我的"
2. 整合:个人信息(昵称) / 账户 / 分类 / API Key / 退出
3. 新增昵称编辑对话框(用 HeroUI Modal + TextField)
4. mutation 成功后 invalidate `auth.me`

**期望结果**:
- ✅ 文案显示"我的"(路由仍 `/settings`)
- ✅ 编辑昵称 → trim 后保存 → 返回 `{ member: { id, displayName } }`
- ✅ 首页问候语同步显示新昵称(invalidate 生效)

### 场景 2.6:认证页 + 记账页切换

**步骤**:
1. 重做 `/login` 与 `/register`(HeroUI TextField + Button)
2. 重做 `/transaction/new` 与 `/transaction/[id]/edit`(HeroUI Select + TextField + Checkbox)
3. 表单错误态(spec FR-A008)+ 加载态 + 空态全覆盖

**期望结果**:
- ✅ 登录/注册成功
- ✅ 记账页金额输入与预览不受隐私模式影响(clarify Q1 = A)
- ✅ 提交成功返回来源页,缓存失效(dashboard.summary/report + transactions)

### 场景 2.7:shadcn 清理

**步骤**:
1. `git rm src/components/ui/{alert-dialog,button,card,checkbox,command,dialog,input,label,popover,radio-group,select,skeleton,tabs,tooltip}.tsx`
2. `git rm components.json`
3. `pnpm remove @radix-ui/react-alert-dialog @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-popover @radix-ui/react-radio-group @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-tooltip cmdk class-variance-authority tw-animate-css`
4. `pnpm install`(更新 lock)
5. `grep -r "@radix-ui" src/ package.json` → 0 命中
6. `grep -r "components/ui" src/` → 0 命中

**期望结果**:
- ✅ `package.json` 无 `@radix-ui/*` / `cmdk` / `class-variance-authority` / `tw-animate-css`
- ✅ `pnpm install --frozen-lockfile` CI 通过
- ✅ `pnpm build` 成功

### 场景 2.8:宪章 + 历史 spec 同步

**步骤**:
1. 修订 `.specify/memory/constitution.md` v2.0.0 → v3.0.0:
   - §技术栈"UI 组件 | shadcn/ui | Radix + Tailwind" → "HeroUI v3 | @heroui/react + @heroui/styles"
   - 同步影响报告 MAJOR(理由:UI 视觉变更 + 公共组件 API 变更 + 依赖树变更 + IA 重构 + 新增报表页)
2. 更新 008/009/010/023/024/025 spec 中"今后使用 shadcn"语句 → "HeroUI"(标题保留作为历史)
3. 提交

**期望结果**:
- ✅ 宪章头部版本号 v3.0.0
- ✅ 同步影响报告标记 MAJOR + 四条变更原因
- ✅ 历史 spec 引用一致

### 场景 2.9:Switch PR 合并

**步骤**:
1. `git push -u origin feat/026-switch`
2. `gh pr create --title "feat(026): Switch - HeroUI migration + reports + dashboard revamp + my page" --body "..."`
3. CI 全绿
4. **本地 staging 部署验证**:本地 `pnpm build && pnpm start`,跑完整 QA
5. `gh pr merge --squash --delete-branch`

**期望结果**:
- ✅ main 上多一条 squash commit
- ✅ 短分支 ≤ 7 天
- ✅ staging 端到端 QA 通过(见阶段 3)

---

## 阶段 3:1.0.0 Release 验证

**目标**: main HEAD 已包含 Spike + Switch,正式发版。

### 场景 3.1:跨尺寸人工 QA(spec FR-G002)

**步骤**: 在 375px / 430px / 桌面端三种尺寸下跑 MVP 完整流程:

| 路径 | 375px | 430px | 桌面 |
|---|---|---|---|
| 登录 | ✓ | ✓ | ✓ |
| 查看首页(切月 + 隐私 + Top 2 下钻) | ✓ | ✓ | ✓ |
| 新增交易(选账户/分类/输金额) | ✓ | ✓ | ✓ |
| 编辑交易返回账单(保留筛选) | ✓ | ✓ | ✓ |
| 查看报表(6 月趋势 + 分类块下钻) | ✓ | ✓ | ✓ |
| 修改昵称 → 首页问候同步 | ✓ | ✓ | ✓ |
| 删除交易(AlertDialog 确认) | ✓ | ✓ | ✓ |
| 退出登录 | ✓ | ✓ | ✓ |

**期望结果**:
- ✅ 所有路径成功率 = 100%
- ✅ 无横向滚动(375 / 430)
- ✅ 可点击元素 ≥ 44×44px
- ✅ P0/P1 bug = 0

### 场景 3.2:可访问性审计(spec FR-G003 + SC-004)

**步骤**:
1. Chrome DevTools → Lighthouse → Accessibility
2. 在 375px 视口下审计 4 个关键页面(/dashboard /transactions /reports /settings)

**期望结果**:
- ✅ 4 页 a11y 得分均 ≥ 90
- ✅ 键盘导航(Tab / Shift+Tab / Enter / Esc)无障碍
- ✅ 焦点样式可见
- ✅ 颜色对比度 ≥ WCAG AA
- ✅ ARIA 标签完整(图表有 `<title>` 后备)

### 场景 3.3:隐私闪现检测(spec SC-008)

**步骤**:
1. 首页开启隐私模式
2. Chrome DevTools → Network → Slow 3G + CPU throttle 6x
3. 刷新页面
4. Performance 面板录制页面加载,检查是否有"真实金额 paint"帧

**期望结果**:
- ✅ 0 次真实金额 paint 帧
- ✅ DevTools Elements 面板看到 `<html class="privacy-on">` 在 hydration 前已生效

### 场景 3.4:发版

**步骤**:
1. 在 main 上修改 `package.json` version → `1.0.0`
2. `git commit -am "chore(release): v1.0.0"`
3. `git tag -a v1.0.0 -m "Release v1.0.0

首个 major release。

主要变更:
- 全站迁移到 HeroUI v3 + 奶油琥珀主题
- 信息架构升级:底部 5 入口导航(首页/账单/记一笔/报表/我的)
- 新增报表页(/reports)
- 首页增强:历史月份选择 / 隐私模式 / Top 2 分类下钻
- '我的'页面重组 + 昵称 mutation
- 宪章 v2.0.0 → v3.0.0"`
4. `git push origin main && git push origin v1.0.0`
5. `gh release create v1.0.0 --generate-notes --latest`
6. 等 GHCR 构建(若 deploy.yml 已补 tag push 触发器);否则手动 `gh workflow run deploy.yml`

**期望结果**:
- ✅ 远端 tag `v1.0.0` 指向 version-bump commit
- ✅ GitHub Release `v1.0.0` 出现,notes 自动生成
- ✅ `docker pull ghcr.io/azenking/balthasar/app:1.0.0` 拉到镜像(若 FR-019 已落地)

---

## 阶段 4:BALTHASAR 整体改造验证(2026-07-14 新增)

**目标**: 验证 1.0.0-rc.1 前后追加的 13 项 BALTHASAR 改造(Phase 11 / spec §I 系列 FR)。所有场景在 `pnpm dev` 本地启动后人工执行。

### 场景 4.1:响应式(AppShell)

**步骤**:
1. Chrome DevTools Device Toolbar 切到 375×812(iPhone 13 mini)
2. 浏览 `/dashboard` / `/transactions` / `/reports` / `/settings`
3. 切到 768×1024(iPad)
4. 切到 1280×800(桌面)

**期望结果**:
- ✅ 375×812:底部 5 入口导航可见;`env(safe-area-inset-bottom)` 注入到 mobile 底栏外层,iPhone 全面屏 home indicator 不压住底栏按钮
- ✅ 768×1024:左侧 240px 栏显示(`md:flex`),底栏隐藏(`md:hidden`)
- ✅ 1280×800:同上,内容居中 `max-w-[1120px]`,左侧栏 fixed
- ✅ 各页面 `<h1>` 替换为统一 PageHeader(title + description + actions 三件套)

### 场景 4.2:三主题切换(system/light/dark)

**步骤**:
1. 进入 `/settings`,找到主题切换器(HeroUI Tabs 三选)
2. 默认 `system`:跟随 OS 偏好(macOS 系统设置切换 dark/light 验证)
3. 点选 `light`:刷新页面
4. 点选 `dark`:刷新页面
5. DevTools Application → Local Storage 查看 `balthasar.theme` 值

**期望结果**:
- ✅ `system`:实时跟随 OS(`prefers-color-scheme: dark` 媒体查询),无需刷新
- ✅ `light`:刷新**无 FOUC**(flash of unstyled content),页面浅色,DevTools 看到 `<html>` 无 dark class
- ✅ `dark`:刷新无 FOUC,页面深色,DevTools 看到 `<html class="dark">`
- ✅ localStorage `balthasar.theme` 持久化正确值
- ✅ 图表坐标轴 / 网格线 / tick 文字在 dark 下也清晰(用 `var(--border)` + `var(--muted)`)

### 场景 4.3:隐私模式无位移

**步骤**:
1. `/dashboard` 关闭隐私模式,观察主卡金额布局
2. 点击隐私按钮(`balthasar.privacy.enabled = true`)
3. 观察 *** 显示位置
4. 切换 `/reports`,悬停图表 Tooltip
5. DevTools Elements 检查金额 span 是否挂 `data-amount`(而非父 div)

**期望结果**:
- ✅ 金额切换前后布局**零跳动**(position: relative + ::after absolute 居中,*** 宽度变化不影响布局)
- ✅ *** 居中显示在原金额 span 的盒模型内,颜色为 `var(--muted)`
- ✅ 图表 Tooltip 内金额也遮蔽:`data-amount` 精准挂在金额 span,不挂父 div 避免子 span `text-foreground` 泄漏
- ✅ `/transaction/new` 记账页金额输入**未**挂 `data-amount`(clarify Q1 = A),正常显示

### 场景 4.4:其它(品牌 + 字体 + 空态 + 视觉细节)

**步骤**:
1. 进入 `/login` / `/register`,查看顶部 BALTHASAR 品牌 + 中文价值说明 "10 秒记账,每天坚持"
2. 进入 `/settings`,底部查看 BALTHASAR 署名 + 版本号
3. `/reports` 切换月,观察图表数字是否 `tabular-nums`(无跳动)
4. 创建空分类的月份,查看 EmptyState 组件(icon + title + description + action)
5. 视觉细节:卡片圆角 / 阴影 / 间距 / 图标尺寸 走 HeroUI 默认

**期望结果**:
- ✅ 登录/注册页 BALTHASAR 品牌显示,中文价值说明出现
- ✅ settings 页 max-w-[720px] 桌面居中,底部 BALTHASAR + version 正确(从 `package.json` 读)
- ✅ 关键金额用 `.text-amount`(tabular-nums),无宽度跳动
- ✅ 空状态统一(EmptyState 组件 6 处替换)
- ✅ 圆角/阴影/间距/图标统一走 HeroUI Card/Button 默认 token

---

## 验收检查表

完成所有场景后,逐项确认:

**Spike 阶段**:
- [ ] 场景 1.1:HeroUI 安装 + 奶油琥珀令牌生效
- [ ] 场景 1.2:共享工具 + 单元测试覆盖
- [ ] 场景 1.3:主题文档落地
- [ ] 场景 1.4:Spike PR squash 合并,短分支 ≤ 7 天

**Switch 阶段**:
- [ ] 场景 2.1:3 个 procedure 集成测试全绿(27 用例)
- [ ] 场景 2.2:底部导航 + 报表页可访问
- [ ] 场景 2.3:首页重做 + 月份切换 + 隐私 + 下钻
- [ ] 场景 2.4:账单页 URL 筛选同步
- [ ] 场景 2.5:"我的"页面 + 昵称 mutation
- [ ] 场景 2.6:认证页 + 记账页切换
- [ ] 场景 2.7:shadcn 完全清理
- [ ] 场景 2.8:宪章 v3.0.0 + 历史 spec 同步
- [ ] 场景 2.9:Switch PR squash 合并,短分支 ≤ 7 天

**1.0.0 Release 阶段**:
- [ ] 场景 3.1:375 / 430 / 桌面三尺寸 MVP + 新功能 QA
- [ ] 场景 3.2:Lighthouse a11y ≥ 90(4 页)
- [ ] 场景 3.3:隐私闪现 = 0
- [ ] 场景 3.4:tag + Release + GHCR 镜像

**BALTHASAR 改造阶段(2026-07-14 新增)**:
- [ ] 场景 4.1:响应式 AppShell(375 / 768 / 1280 + safe-area)
- [ ] 场景 4.2:三主题切换(system/light/dark,无 FOUC,localStorage 持久化)
- [ ] 场景 4.3:隐私模式无位移 + Tooltip data-amount 精准挂金额 span
- [ ] 场景 4.4:品牌 + 字体规范 + 空态 + 视觉细节

全部勾选 → 1.0.0 改版完整,可关闭 feature。
