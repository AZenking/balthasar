# Reviewer Runbook — 025-perf-code-optimization

> 你的回合。所有 NEEDS-MANUAL 任务在这里集中,逐项跑、把数字填到 `baseline.md` 对应位置。
> 跑完每一节后,可以在表格里打勾。

## 前置(一次性)

```bash
# 切到本分支
git checkout 025-perf-code-optimization
pnpm install   # 含本 initiative 新增的 @next/bundle-analyzer devDep

# 准备 PG(用于 integration tests / p95 bench)—— 择一
docker run -d --name balthasar-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
# 或者用 testcontainers(本仓库的默认做法,无需手动起 PG)
```

环境变量(`.env`):
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/balthasar
BETTER_AUTH_SECRET=...
```

---

## §1 Bundle 体积(SC-004 核心)

**目的**:验证 recharts 拆出后,Dashboard first-load JS 较 baseline -20%。

```bash
# 在 025-perf-code-optimization 分支
ANALYZE=true pnpm next build --webpack

# 在 main 分支(baseline)
git stash -u  # 暂存任何未提交改动
git checkout main
ANALYZE=true pnpm next build --webpack
git checkout 025-perf-code-optimization
git stash pop
```

**取数**:打开 `.next/analyze/client.html` 找 `/dashboard` 路由的 first-load JS(gzipped)。

**填入** `baseline.md` 的 After 区块 PR-5 US2 行 Bundle Δ 列:

| 路由 | baseline (main) | after (本分支) | Δ% | SC-004 (-20%) |
|------|-----------------|----------------|-----|----------------|
| `/dashboard` | [填] KB | [填] KB | [-X]% | ✅/❌ |
| `/transactions` | [填] KB | [填] KB | [-X]% | — |
| `/transaction/new` | [填] KB | [填] KB | [-X]% | — |

- [ ] §1 跑完

---

## §2 Lighthouse 测量(SC-001 / SC-005)

**目的**:Mid-Tier Mobile 下 Dashboard LCP/TTI/FID/CLS 达标 + 弱网 TTI 改善 25%。

```bash
pnpm build
pnpm start   # http://localhost:3000
```

**测量步骤**(每路由跑 3 次取中位数):
1. 浏览器登录 → 进入 `/dashboard`(或 `/transactions` / `/transaction/new`)
2. DevTools → Lighthouse 面板
3. **配置**:
   - Mode: Navigation
   - Device: Mobile
   - Throttling: **CPU 4× slowdown + Slow 3G**(Mid-Tier Mobile preset)
   - Categories: Performance
4. 点 "Analyze page load"
5. 记录 LCP / TTI / FID / CLS
6. **重复 3 次,取中位数**

**填入** `baseline.md` 的 Lighthouse 指标 表格:

| 路由 | LCP (s) | TTI (s) | FID (ms) | CLS | 备注 |
|------|---------|---------|----------|-----|------|
| `/dashboard` baseline | [填] | [填] | [填] | [填] | main 分支跑 |
| `/dashboard` after | [填] | [填] | [填] | [填] | 本分支跑 |
| `/transactions` baseline | [填] | [填] | [填] | [填] | |
| `/transactions` after | [填] | [填] | [填] | [填] | |
| `/transaction/new` baseline | [填] | [填] | [填] | [填] | |
| `/transaction/new` after | [填] | [填] | [填] | [填] | |

**SC 对照**:
- [ ] SC-001 `/dashboard` LCP ≤ 3s + FID ≤ 200ms
- [ ] SC-005 `/dashboard` TTI ≤ 3.5s + 较 baseline 改善 ≥ 25%
- [ ] CLS ≤ baseline(视觉等价 FR-013)

---

## §3 流水 FPS(SC-002)

**目的**:流水页 50+ 条记录快速滚动 FPS ≥ 50。

**前置**:数据库里至少 50 条 transaction(若不足,可以临时在 `/transaction/new`
连续记账 50 次,或直接 SQL 插入)。

**测量步骤**:
1. 浏览器登录 → 进入 `/transactions`
2. DevTools → Performance 面板
3. 点 ●Record
4. 用鼠标滚轮快速滚动 **5 秒**
5. 点 ■Stop
6. 底部 Frames tab → 看平均 FPS

**填入** `baseline.md` 的滚动 FPS 表格:

| 指标 | 数值 |
|------|------|
| 流水 FPS(baseline main) | [填] |
| 流水 FPS(after 本分支) | [填] |

- [ ] SC-002 FPS ≥ 50 ✅/❌

---

## §4 路由切换时间(SC-003)

**目的**:Tab 之间路由切换视觉过渡 ≤ 200ms,无白屏闪烁。

**测量步骤**(因为 Lighthouse 不直接给这个数,用 Performance timeline):
1. DevTools → Performance 面板 → ●Record
2. 快速切换 5 次:Dashboard → 流水 → 新增交易 → 流水 → Dashboard
3. ■Stop
4. 在 timeline 上找每次路由切换的视觉空白段,记录 ms

**填入** `baseline.md` After 区块 PR-2/3/4 行 CLS Δ / 备注列:

| 路由切换 | baseline (ms) | after (ms) | 白屏闪烁? |
|----------|---------------|------------|-----------|
| → /dashboard | [填] | [填] | ✓/✗ |
| → /transactions | [填] | [填] | ✓/✗ |
| → /transaction/new | [填] | [填] | ✓/✗ |

- [ ] SC-003 ≤ 200ms ✅/❌

---

## §5 视觉稳态截图(FR-013 / contracts/visual-equivalence.md)

**目的**:证明优化前后稳态视觉相同,唯一允许差异是 Skeleton。

**取图步骤**:
1. `git checkout main && pnpm build && pnpm start` — baseline
2. 浏览器登录,对以下 4 个路由各截一张稳态截图,保存到 `specs/025-perf-code-optimization/screenshots/baseline-*.png`
   - `/dashboard`
   - `/transactions`(至少 5 条数据)
   - `/transaction/new`(表单空态)
   - `/settings`
3. `git checkout 025-perf-code-optimization && pnpm build && pnpm start` — after
4. 同样截 4 张,保存到 `screenshots/after-*.png`
5. **对照**:稳态下应完全一致

**填入** `baseline.md` PR-5 Polish 行备注列:
- [ ] 4 张 baseline 截图已截
- [ ] 4 张 after 截图已截
- [ ] 对照结论:✅ 完全一致 / ❌ 有差异(说明)
- [ ] Skeleton loading 反馈(loading.tsx / FormSkeleton)在弱网下生效

```bash
# 创建截图目录
mkdir -p specs/025-perf-code-optimization/screenshots
```

---

## §6 Integration + Procedure tests(SC-010)

**目的**:验证后端 + tRPC 契约未回归。

```bash
pnpm test:procedure    # tRPC procedure 契约
pnpm test:integration  # testcontainers + 真实 PG
```

**填入** `baseline.md` 测试基线表:
- [ ] `pnpm test:procedure` 全绿(填通过数)
- [ ] `pnpm test:integration` 全绿(填通过数)

---

## §7 p95 性能护栏(SC-009)

**目的**:确认 mutation p95 < 300ms,query p95 < 500ms(warm 状态 ×20)。

仓库目前没有现成的 bench 文件。两种做法:

**A** —— 简单做法(代理指标):
```bash
# integration 测试本身的耗时就是代理
time pnpm test:integration
# 看 transaction create / dashboard query 相关 test 的耗时
```

**B** —— 完整做法(写 bench):
```bash
# 在 src/tests/integration/perf/ 新建文件
# 用 vitest 的 bench API 跑 20 次 create + 20 次 dashboard query
```
见 `quickstart.md` §2。

**填入** `baseline.md` 的 p95 性能护栏 表:
- [ ] `transaction.create` p95 < 300ms
- [ ] `dashboard.query` p95 < 500ms

---

## §8 最终 acceptance(`quickstart.md` §1-§10 全跑)

按 `quickstart.md` 顺序跑一遍,每节打勾:

- [ ] §1 测试套件全绿
- [ ] §2 p95 护栏通过
- [ ] §3 bundle -20%(同 §1)
- [ ] §4 Lighthouse 全部达标(同 §2)
- [ ] §5 FPS ≥ 50(同 §3)
- [ ] §6 路由切换 ≤ 200ms(同 §4)
- [ ] §7 审查清单 ≥ 80%(已在 anti-patterns.md 闭环)
- [ ] §8 视觉等价(同 §5)
- [ ] §9 30-min onboarding(已在 anti-patterns.md 文档化)

---

## 跑完之后

1. **提交 baseline.md 更新**:
   ```bash
   git add specs/025-perf-code-optimization/baseline.md specs/025-perf-code-optimization/screenshots/
   git commit -m "docs(perf): fill NEEDS-MANUAL measurement results"
   ```

2. **更新 baseline.md 末尾 "Initiative 状态" 行**:
   - 全部 SC 达标 → `**Initiative 状态**:**全部 SC 达标,可合并 main**`
   - 有未达标 → 列出具体哪几项,决定补 fix 还是降标准

3. **合并决策**:
   - 全绿 → 直接 merge 到 main
   - 部分红 → 决定每个红项是补 PR 修复还是降 SC 门槛(后者需 spec 修订)

---

## 最小可行验收(如果时间紧)

跑不动全套?**最低限度跑这 3 项**即可证明 initiative 价值:
1. **§1 bundle** —— 跑 `ANALYZE=true pnpm next build --webpack` 两次,对比 `/dashboard` first-load JS
2. **§2 LCP** —— 跑 1 次 Lighthouse `/dashboard`,看 LCP
3. **§5 视觉截图** —— 截 4 张 after 截图,目测对比

这 3 项足以证明 "recharts 拆出 + Skeleton loading + 4 处 server-component 迁移"
的实际效果。其它 SC 走个过场即可。
