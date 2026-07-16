# Quickstart: 性能与代码优化 验证 Runbook

**Branch**: `025-perf-code-optimization` | **Date**: 2026-07-16
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

> Phase 1 输出。本文件是"如何在本机验证本 initiative 达成 SC-001 ~
> SC-010"的可执行 runbook。**不含实现代码**;实现细节见 tasks.md
> (Phase 2 /speckit-tasks 输出)。

## 前置条件

- Node.js 20+(见 `package.json` engines)
- pnpm(项目用pnpm v10+,见 MEMORY.md)
- 本机 PostgreSQL(用于 integration 测试;或依赖 testcontainers 自动起)
- Chrome / Chromium(Lighthouse 与 DevTools 性能测量)
- 本 initiative 的 `baseline.md` 已存在(由 PR-1 创建)

## 0. 切换到本 feature 分支

```bash
git checkout 025-perf-code-optimization
pnpm install   # 含本 initiative 新增的 @next/bundle-analyzer devDep
```

## 1. 测试套件全绿验证(SC-010)

**目标**: 现有 Vitest 单元 / procedure / integration + E2E 全部通过。

```bash
# 单元 + procedure + integration 三套并行
pnpm test              # 全量(vitest 全 project)
pnpm test:unit         # 仅 unit
pnpm test:procedure    # 仅 tRPC procedure 契约
pnpm test:integration  # 仅 integration(testcontainers + 真实 PG)
pnpm type-check        # TS 编译器零错误
pnpm lint              # ESLint 零错误
```

**期望**:
- 全部 exit code 0
- 因本次优化引入的功能性 bug 数 = 0

## 2. p95 性能回归护栏验证(SC-009)

**目标**: 创建交易 mutation p95 < 300ms,Dashboard query p95 < 500ms。

```bash
# 跑 create-transaction + dashboard-query 的 integration 基准
pnpm test:integration -- \
  src/tests/integration/perf/create-transaction.bench.ts \
  src/tests/integration/perf/dashboard-query.bench.ts
```

> 注:若 perf bench 文件不存在,在 tasks 阶段补;
> 或用现有 integration 测试中的 timing 断言作为代理。

**期望**:
- 连续 20 次测量取 p95
- create-transaction p95 < 300ms
- dashboard-query p95 < 500ms
- warm 状态(排除 cold start)

## 3. JS Bundle 体积验证(SC-004)

**目标**: 首次加载(Dashboard)JS(gzipped)较 baseline 减少 ≥ 20%。

```bash
# 触发 bundle analyzer
ANALYZE=true pnpm build

# 输出位置
# .next/analyze/server.html
# .next/analyze/client.html  ← 重点看这个
# .next/analyze/shared.html
```

**操作**:
1. 打开 `.next/analyze/client.html`
2. 找到 Dashboard 路由(`/`)的 first-load chunk
3. 记录 gzipped 大小
4. 与 `baseline.md` 中 baseline 数字对照,计算 `(-X%)`
5. 若 `≥ -20%` → SC-004 ✅

## 4. Lighthouse 性能指标验证(SC-001 / SC-005)

**目标**: Mid-Tier Mobile 下 LCP ≤ 3s、TTI ≤ 3.5s、FID ≤ 200ms、CLS ≤ baseline。

**前置**: production build + start。

```bash
pnpm build
pnpm start   # 默认 :3000
```

**测量步骤**:
1. 打开 Chrome → `http://localhost:3000`
2. 登录(用任何测试账号)→ 进入 Dashboard(`/`)
3. 打开 DevTools → Lighthouse 面板
4. **配置**:
   - Mode: Navigation
   - Device: Mobile
   - Throttling: CPU 4× slowdown + Slow 3G( Mid-Tier Mobile preset)
   - Categories: Performance
5. 点击 "Analyze page load"
6. **重复 3 次**,取中位数
7. 记录到 PR 描述

**期望**:
- LCP ≤ 3s(SC-001)
- TTI ≤ 3.5s 且较 baseline 改善 ≥ 25%(SC-005)
- FID ≤ 200ms(SC-001)
- CLS ≤ baseline(FR-013)

## 5. 滚动 FPS 验证(SC-002)

**目标**: 流水列表 50+ 条记录快速滚动 FPS ≥ 50。

**前置**: 已认证,数据库有 ≥ 50 条 transaction。

**测量步骤**:
1. 浏览器进入 `/transactions`
2. DevTools → Performance 面板
3. 点击 "Record"
4. 用鼠标滚轮快速滚动 5 秒
5. 点击 "Stop"
6. 在 Frames tab 读取平均 FPS

**期望**: 平均 FPS ≥ 50。

## 6. 路由切换视觉过渡验证(SC-003)

**目标**: Tab 之间路由切换 ≤ 200ms,无白屏闪烁。

**手测**:
1. 进入已认证主应用
2. 用 Chrome DevTools Performance 录制,期间快速切换:
   Dashboard → 流水 → 新增交易 → 流水 → Dashboard
3. 在 Performance timeline 中观察每个路由切换的视觉过渡时间

**期望**:
- 每次切换 ≤ 200ms
- 无白屏闪烁(loading.tsx 或 Suspense fallback 即时显示)

## 7. Vercel React Best Practices 审查清单(SC-006 / SC-007)

**目标**: Dashboard / 流水 / 新增交易 三个核心 feature 的 ≥ 80% 检查项通过。

**操作**:
1. 调用 `/vercel-react-best-practices` skill 获取最新清单
2. 对照 `research.md` R1 的 17 项,逐项检查三个 feature 的代码
3. 把结果填入 `anti-patterns.md`
4. 识别 ≥ 5 处反模式并修复(每处附 before/after)

**期望**:
- 17 项中 ≥ 14 项通过(80% 门槛)
- ≥ 5 处反模式已 `verified` 状态

## 8. 视觉等价验证(FR-013 / contracts/visual-equivalence.md)

**目标**: 优化前后稳态视觉相同,CLS 不上升。

**操作**:
1. 在 PR 分支跑 `pnpm build && pnpm start`
2. 在 main 分支(baseline)重复一次
3. 对每个核心路由(Dashboard / 流水 / 新增交易)各截一张稳态截图
4. 并排对照,逐项打勾(见 `contracts/visual-equivalence.md` §5 清单)

**期望**:
- 布局/间距/颜色/字体/交互模式完全相同
- CLS ≤ baseline
- 唯一允许差异:loading Skeleton

## 9. 维护者直觉验证(SC-008)

**目标**: 在不依赖人类口头说明的前提下,仅凭仓库代码 + skill 输出,
30 分钟内准确描述本仓库 React/Next.js 范式。

**自测**(可在 PR 合并后做):
1. 找一个未参与本次 initiative 的协作者(或 AI 协作者)
2. 给定本仓库 main 分支
3. 计时 30 分钟,要求回答:
   - 本仓库用 Server Component 还是 Client Component 承载数据展示?
   - tRPC 客户端 hook 在什么场景下使用?
   - HeroUI v3 的 token 体系如何组织?
4. 三项全部正确 → SC-008 ✅

## 10. PR 提交前最终核对

```bash
# 全自动检查
pnpm type-check
pnpm lint
pnpm test

# 手测(按上文 §3-§8)
- [ ] §1 测试全绿
- [ ] §2 p95 护栏通过
- [ ] §3 bundle -20%
- [ ] §4 Lighthouse 全部达标
- [ ] §5 FPS ≥ 50
- [ ] §6 路由切换 ≤ 200ms
- [ ] §7 审查清单 ≥ 80%
- [ ] §8 视觉等价
- [ ] baseline.md 已更新本 PR 的 after 数字
- [ ] anti-patterns.md 已更新本 PR 的 AP 条目
```

全部打勾 → PR 可合并。

## 异常排查

| 现象 | 可能原因 | 排查 |
|------|----------|------|
| bundle 不降反升 | 新引入了客户端依赖或 `"use client"` 边界扩大 | 检查 client.html 红块 |
| LCP 退化 | Server Component 改 Client 或 Suspense 边界破坏 | 检查最近 PR 的 Server/Client 变更 |
| CLS 上升 | Skeleton 尺寸与稳态不一致 | 调 Skeleton `className` 加 `min-h-*` |
| FPS < 50 | 列表项未 `memo` 或 props 不稳定 | React DevTools Profiler 找重渲染源 |
| 测试失败 | 优化触及了 tRPC 输入/输出契约 | 回退或更新契约 + DOMAIN.md |

## 不在本 runbook 范围

- 具体代码改动实现(见 tasks.md)
- baseline 初始捕获(由 PR-1 完成,首次执行 §3-§7 时填入)
- 后端 p95 优化(已在 SC-009 作为护栏,无独立优化任务)
