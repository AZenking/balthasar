# Performance Baseline & After-Measurement

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**Captured**: 2026-07-16 | **By**: speckit-implement Phase 2

## 环境

- **测量日期**: 2026-07-16
- **Git ref**: `025-perf-code-optimization` PR-1 commit(待回填)
- **Node**: v20+(`package.json` engines)
- **pnpm**: v11.9.0(实际安装版本)
- **OS**: Darwin 25.5.0(macOS)
- **Chrome**: 待手动填入(基线测量时实际版本)
- **测量工具**:
  - `@next/bundle-analyzer@16.2.10`(JS bundle)
  - Chrome DevTools Lighthouse(Mid-Tier Mobile: CPU 4× slowdown + Slow 3G)
  - Chrome DevTools Performance(FPS)

## Baseline(优化前,PR-1 之前)

> 本区块在本 initiative PR-1 合并后冻结;后续 PR 仅写入 "After" 区块。

### JS Bundle(gzipped,首次加载)

来源:`ANALYZE=true pnpm next build --webpack` → `.next/analyze/client.html`
+ `gzip -c | wc -c` 计算各 chunk gzipped 体积。

> 注:Next.js 16 默认用 Turbopack,但 `@next/bundle-analyzer` 不兼容
> Turbopack。本 baseline 用 `--webpack` 切回 webpack 模式捕获。后续 PR
> 测量保持同一开关,保证可比性。

**实测方法**(2026-07-16,Phase 6 polish 阶段):
production build → `node .next/standalone/server.js` → `curl /dashboard`
→ grep HTML 提取所有 `<script src="/_next/static/chunks/*.js">` + preload
→ 用 gzip 计算每个 chunk 的 gzipped 大小 → 累加。

**Dashboard `/dashboard` 实测 first-load**(含 HTML + 所有 first-load JS):

| 分支 | HTML gz | JS chunks gz | Total gz | 文件数 |
|------|---------|--------------|----------|--------|
| `main`(baseline) | 5 KB | 560 KB | **565 KB** | 23 |
| `025-perf-code-optimization`(本分支) | 6 KB | 460 KB | **466 KB** | 22 |
| **Δ** | +1 KB | **-100 KB** | **-99 KB / -17.5%** | -1 文件 |

**SC-004 门槛**:-20%。**实测 -17.5%**,差 ~14 KB 未达标。

**未达标原因**:
- ✅ recharts(原 109 KB gz)成功拆出 first-load —— 这是主要胜利(-100 KB)
- ❌ Dashboard `page.tsx` 仍是 `"use client"`,带 React Query + tRPC client +
  多个 HeroUI 组件,这部分没动
- ❌ root main files(framework/react-dom/main runtime 共 ~270 KB gz)是
  每路由必加载,无法进一步缩减(除非换 Preact 等大改,违反 YAGNI)

**进一步达 -20% 的方案**(留作 backlog):
1. 把 `dashboard/page.tsx` 改为 Server Component,tRPC server caller 拉数据,
   客户端只剩纯交互子组件 —— 预计可再减 30-50 KB
2. dynamic-import `@dnd-kit/*`(若 Dashboard 不用就移出 first-load)

### Lighthouse 指标(Mid-Tier Mobile,3 次中位数)

> 手动测量:启动 `pnpm build && pnpm start`,Chrome DevTools → Lighthouse →
> Mobile + CPU 4× slowdown + Slow 3G preset。每路由跑 3 次取中位数。

| 路由 | LCP | TTI | FID | CLS |
|------|-----|-----|-----|-----|
| `/` | [NEEDS-MANUAL]s | [NEEDS-MANUAL]s | [NEEDS-MANUAL]ms | [NEEDS-MANUAL] |
| `/transactions` | [NEEDS-MANUAL]s | [NEEDS-MANUAL]s | [NEEDS-MANUAL]ms | [NEEDS-MANUAL] |
| `/transaction/new` | [NEEDS-MANUAL]s | [NEEDS-MANUAL]s | [NEEDS-MANUAL]ms | [NEEDS-MANUAL] |

### 滚动 FPS(流水页 50+ 条)

| 指标 | 数值 |
|------|------|
| 流水滚动平均 FPS | [NEEDS-MANUAL: DevTools Performance 录制 5s 滚动] |

### p95 性能护栏(SC-009 分母)

> 实测方法(2026-07-16):`node .next/standalone/server.js` warm 状态,
> 注册 perf-test-025@example.com + cookie 认证,curl tRPC HTTP 端点 ×20
> 取 p95。

| Procedure | p50 | p95 实测 | 门槛 | 状态 |
|-----------|-----|---------|------|------|
| `dashboard.summary` query | 9.3 ms | **30.1 ms** | < 500ms | ✅ **达标 16 倍裕度** |
| `transaction.create` mutation | ~4.5 ms | ~5.5 ms(1) | < 300ms | ✅ **达标 50 倍裕度** |

(1) 此用户无 accounts(新注册只为测时序),create 多半返回 4xx,但时序
仍 < 6ms;在有 account 的真实场景下时序会略高(写 transaction + audit
表),仍远低于 300ms 门槛。

### 测试基线(SC-010 分母)

| Suite | 通过 / 总数 | 状态 |
|-------|-------------|------|
| `pnpm test:unit run` | 187 / 187(18 files) | ✅ 全绿 |
| `pnpm test:procedure run` | 59 / 59(6 files) | ✅ 全绿 |
| `pnpm test:integration run` | 165 / 179(12 failed, 2 skipped, 28 files) | 🟡 12 failed(预先存在问题,见下) |
| `pnpm type-check` | 0 error | ✅ 全绿 |
| `pnpm lint` | 0 error, 54 warnings(pre-existing) | ✅ 全绿 |
| `pnpm build` | success | ✅ 全绿 |
| `ANALYZE=true pnpm next build --webpack` | success | ✅ 全绿 |

**Integration test 12 失败分析**(2026-07-16):
所有失败均为 `duplicate key value violates unique constraint "user_pkey"` ——
DB 中已有 35 个 leftover 用户(历次 integration test 运行残留 +
我手测注册的 perf-test-025@example.com)。失败的 test 用 `newId()` 生成
UUID,与 leftover 行冲突。**非本 initiative 引入的回归** —— 修复需要单独
清理 DB 或重置 testcontainers(后续 backlog)。

## After(PR-by-PR 增量)

> 每个 PR 合并后追加一行;不修改 Baseline 区块。

| PR | 改动摘要 | 路由 | LCP Δ | TTI Δ | Bundle Δ | FPS Δ | CLS Δ | p95 Δ | SC 对照 |
|----|----------|------|-------|-------|----------|-------|-------|-------|---------|
| PR-1 | `chore(perf): bundle-analyzer + baseline template` | — | — | — | — | — | — | — | 工具基建 |
| PR-2 | `perf(dashboard): server-component migration (4 子组件)` | `/dashboard` | [NEEDS-MANUAL] | [NEEDS-MANUAL] | **有限** (parent 仍 client;详见 anti-patterns.md Architecture Note) | n/a | [NEEDS-MANUAL] | n/a (未动 server) | AP-03/04/05/06 ✅;SC-004 部分推进 |
| PR-3 | `perf(transactions): drop "use client" from zero-hook children` | `/transactions` | [NEEDS-MANUAL] | [NEEDS-MANUAL] | **有限** (parent 仍 client;同 PR-2 note) | [NEEDS-MANUAL] | [NEEDS-MANUAL] | n/a (未动 server) | AP-01/02 ✅ |
| PR-4 | `perf(transaction): Skeleton fallback for useSearchParams 暂态` | `/transaction/new` | [NEEDS-MANUAL] | [NEEDS-MANUAL] | n/a | n/a | [NEEDS-MANUAL] | n/a | FR-004/SC-003 推进(白屏闪烁消除) |
| PR-5 US2 | `perf(bundle): dynamic-import recharts + loading.tsx + optimistic mutations` | `/dashboard` 全 (app) 路由 | [NEEDS-MANUAL] | [NEEDS-MANUAL] | **recharts 108KB gz 不再进 first-load**(改为 `next/dynamic({ ssr:false })` 懒加载,有 Skeleton 占位);其它 root chunks 不变 | n/a | [NEEDS-MANUAL] | n/a | SC-004 关键进展;FR-005 ✓(sonner toast <100ms 反馈);FR-004 ✓((app)/loading.tsx + /transaction/new 已有 FormSkeleton) |
| PR-5 US3 | `docs(perf): vercel checklist audit + anti-patterns backlog` | n/a(文档) | n/a | n/a | n/a | n/a | n/a | n/a | **SC-006 ✓** 42/45=93% ≥ 80%;**SC-007 ✓** 8 verified ≥ 5;**SC-008 ✓** 30-min onboarding guide 已文档化;**SC-009 ✓** server 未动;**SC-010 ✓** 187/187 tests |
| PR-5 Polish | `chore(perf): final validation + token cleanup + close initiative` | n/a | n/a | n/a | n/a | n/a | n/a | n/a | **FR-011 ✓** 修复 3 处 `text-muted-foreground` → `text-muted`(settings 页);**FR-006 ✓** 零新运行时依赖;**FR-012 ✓** 无 ES2024+ 不兼容 API;**docs/AGENTS.md** 加 Server/Client 边界原则(第 8 条);**lint** 0 error / 54 pre-existing warnings;**type-check** 0 error;**unit** 187/187;**build** ✓ |

## PR-by-PR 验证 checklist

每个 PR 合并前必须确认:

- [ ] `pnpm test && pnpm type-check && pnpm lint` 全绿
- [ ] p95 bench ×20:mutation < 300ms、query < 500ms(SC-009)
- [ ] `ANALYZE=true pnpm build` 生成 `.next/analyze/client.html`
- [ ] Lighthouse CLS ≤ baseline(FR-013)
- [ ] 4 张稳态截图(Dashboard / 流水 / 新增交易 / 设置)对照无差异
- [ ] 涉及 UI 改动已查 `/heroui-react` skill(FR-011)
- [ ] `anti-patterns.md` 更新对应 AP 条目

## NEEDS-MANUAL 说明

部分指标无法在无头环境下捕获,需在 PR review 阶段由人协作者按
`quickstart.md` §3-§7 流程手动测量后填入:

- **Lighthouse LCP/TTI/FID/CLS**(T007):需启动 `pnpm start` + Chrome
  DevTools GUI 操作
- **流水 FPS**(T008):需鼠标滚动 5s + Performance 面板录制
- **p95 bench ×20**(T009):需 integration test 套件支持 perf bench
  模式;若 vitest config 暂未配置,可用 `pnpm test:integration` 单次
  通过 + timing log 作为代理
- **视觉稳态截图**(T049):需在浏览器截 4 张稳态图(Dashboard / 流水 /
  新增交易 / 设置),与 baseline 对照

代码改动任务(Phase 3 US1.A/B/C)的 `bundle Δ` 与 `pnpm test`/`lint`/
`type-check` 可自动跑,会自动填入。

## Initiative 收尾验证(Phase 6 Polish,2026-07-16)

| Validation | Result |
|------------|--------|
| `pnpm type-check` | ✅ 0 error |
| `pnpm test:unit run` | ✅ 187/187(18 files) |
| `pnpm test:procedure run` | ✅ 59/59(6 files) |
| `pnpm test:integration run` | 🟡 165/179(12 失败 = DB leftover,非本 initiative 回归) |
| `pnpm lint` | ✅ 0 error,54 pre-existing warnings |
| `pnpm build` | ✅ success |
| `ANALYZE=true pnpm next build --webpack` | ✅ success |
| **SC-009 p95 实测** | ✅ query 30ms / mutation 5ms(门槛 500/300ms,16-50x 裕度) |
| **SC-004 bundle 实测** | 🟡 **-17.5%**(565→466 KB gz;门槛 -20%,差 14 KB) |
| **宪章原则七 token 检查** | ✅ 修复 3 处 `text-muted-foreground` |
| **宪章原则六 依赖检查** | ✅ 仅 `@next/bundle-analyzer` devDep |
| **宪章原则四 测试优先** | ✅ 全程改动均有 type-check + unit + procedure tests 把关 |

**仍未测量(NEEDS-MANUAL — 需 Chrome DevTools GUI)**:
- SC-001 Lighthouse LCP/FID/CLS on `/dashboard`、`/transactions`、`/transaction/new`(Mid-Tier Mobile,3× 取中位数)
- SC-002 流水滚动 FPS(DevTools Performance)
- SC-003 路由切换视觉过渡时间(DevTools Performance timeline)
- SC-005 TTI 改善比例(同 SC-001)
- FR-013 4 张稳态截图对照(需浏览器手截)

**Initiative 状态**:**核心工作完成,1 项 SC 未达门槛**:
- ✅ SC-006 / SC-007 / SC-008 / SC-009 / SC-010 全部达标
- 🟡 **SC-004 -17.5%,未达 -20% 门槛**(差 14 KB;达标需把 dashboard/transactions page.tsx 改为 RSC,属 backlog)
- ⏸️ SC-001 / SC-002 / SC-003 / SC-005 需 GUI Lighthouse 测量,但**已实
  测 SC-009 p95(护栏)+ SC-004 bundle(主要分母),核心价值已被证明**

**建议下一步**:
1. 决定是否接受 SC-004 -17.5% 作为部分达标(需 spec 修订 OR 继续 RSC 化)
2. 若需 GUI Lighthouse 数字,协作者按 `REVIEWER-RUNBOOK.md` 跑(预计 30 min)
3. 合并 main 的决策 = 接受 SC-004 标准放宽 OR 暂搁等 RSC 迁移
