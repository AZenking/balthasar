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

**Root main files(每个路由都加载,gzipped)**:

| Chunk | gzipped | 备注 |
|-------|---------|------|
| `framework-*.js` | 59.7 KB | React 19 |
| `8f39d3da-*.js` | 68.7 KB | shared lib(待 US2 阶段 audit) |
| `7261-*.js` | 60.5 KB | shared lib(待 US2 阶段 audit) |
| `main-*.js` | 39.8 KB | Next.js main runtime |
| `polyfills-*.js` | 39.5 KB | browser polyfills |
| `webpack-*.js` | 1.7 KB | webpack bootstrap |
| `main-app-*.js` | 0.3 KB | app shell |
| **小计(root)** | **≈ 270 KB** | 每路由必加载 |

**Top per-route / shared chunks(gzipped,按大小降序)**:

| Chunk | gzipped | 候选归属 |
|-------|---------|----------|
| `1111-*.js` | 108.8 KB | 最大共享块 —— 待 US2 audit |
| `4865-*.js` | 48.8 KB | |
| `9344-*.js` | 40.4 KB | |
| `1489-*.js` | 27.5 KB | |
| `5333-*.js` | 25.9 KB | |
| `9629-*.js` | 25.0 KB | |

**Dashboard `/` first-load 估算**:`root (270 KB) + 至少 1 个 page chunk (≥ 50 KB)` ≈ **320+ KB gzipped**(精确数字需 Lighthouse 测量或 Turbopack analyzer)。

**SC-004 目标**:较本 baseline 减少 ≥ 20% → 目标 first-load ≤ **256 KB gzipped**(root 上限)。

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

> 跑 `pnpm test:integration` 中 create-transaction + dashboard-query bench ×20。

| Procedure | p95(baseline) | 门槛 |
|-----------|---------------|------|
| `transaction.create` | [NEEDS-MANUAL]ms | < 300ms |
| `dashboard.query` | [NEEDS-MANUAL]ms | < 500ms |

### 测试基线(SC-010 分母)

| Suite | 通过 / 总数 | 状态 |
|-------|-------------|------|
| `pnpm test:unit run` | 187 / 187(18 files) | ✅ 全绿 |
| `pnpm type-check` | 0 error | ✅ 全绿 |
| `pnpm lint` | [NEEDS-MANUAL: 未在本次跑测] | — |
| `pnpm test:procedure` | [NEEDS-MANUAL] | — |
| `pnpm test:integration` | [NEEDS-MANUAL: 需 testcontainers + PG] | — |

## After(PR-by-PR 增量)

> 每个 PR 合并后追加一行;不修改 Baseline 区块。

| PR | 改动摘要 | 路由 | LCP Δ | TTI Δ | Bundle Δ | FPS Δ | CLS Δ | p95 Δ | SC 对照 |
|----|----------|------|-------|-------|----------|-------|-------|-------|---------|
| PR-1 | `chore(perf): bundle-analyzer + baseline template` | — | — | — | — | — | — | — | 工具基建 |
| PR-2 | (待填) | `/` | | | | | | | |
| PR-3 | (待填) | `/transactions` | | | | | | | |
| PR-4 | (待填) | `/transaction/new` | | | | | | | |

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

代码改动任务(Phase 3 US1.A/B/C)的 `bundle Δ` 与 `pnpm test`/`lint`/
`type-check` 可自动跑,会自动填入。
