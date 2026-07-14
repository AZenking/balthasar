# Quickstart: 手机端首页及相关页面重做

**Feature**: 027-mobile-home-revamp | **Date**: 2026-07-14

端到端验证手册。证明 027 的核心能力(转账/预算/资产/首页重做/隐私补强)可用。**不含实现代码**(见 tasks.md)。

## 前置

- Node 20+ / PostgreSQL 16 / Docker(可选,用于本地 PG)
- `.env` 已配 `DATABASE_URL`(见 `.env.example`)
- 宪章 v3.2.0 已合并(US1 前置;否则 US4/5/6 不可验证)

## 1. 启动

```bash
pnpm install          # 零新依赖(US1 宪章修订后)
pnpm db:migrate       # 应用 027 的 3 类 migration(transfer 枚举+列/account type/budgets 表)
pnpm dev              # Next.js dev server
```

## 2. 端到端验证场景

### 场景 A:转账(US4)
1. 设置:创建 2 个 asset 账户(A 余额 1000,B 余额 0)。
2. 操作:点首页 FAB → 记一笔 → 选"转账"模式 → 转出 A、转入 B、金额 300 → 保存。
3. 验证:
   - 明细页出现该转账(类型标识转账)。
   - 首页"本月收支"的支出/收入**不含** 300(SC-006 转账隔离)。
   - 首页"资产概览":A 余额 700、B 余额 300,netAssets 不变(转账不改变净资产)。
4. 反向验证:转账转出=转入账户 → 应被拒绝(FR-014)。

### 场景 B:预算四态(US5)
1. 当前月支出 ¥3,680,设月预算 ¥5,800。
2. 验证首页预算区:usagePercent ≈ 63.4%,status="normal",剩余 ¥2,120。
3. 调小预算至 ¥4,600 → usagePercent ≈ 80% → status="warning"(接近超支)。
4. 调小至 ¥3,000 → usagePercent ≈ 122.7% → status="overspent",显示超支 ¥680(SC-007)。
5. 删除预算 → status="unset",显示"设置预算"引导(FR-019)。

### 场景 C:资产 type 分组(US6)
1. 创建 3 asset 账户(各 ¥10,000) + 1 debt 账户(信用卡,余额 -¥4,200)。
2. 验证首页资产概览:totalAssets=¥30,000、totalLiabilities=¥4,200、netAssets=¥25,800。
3. 无账户时:显示"添加第一个账户"引导(FR-021)。

### 场景 D:首页主数字 + 趋势(US2)
1. 本月有收支,打开首页。
2. 验证:收支卡主数字是"本月支出"(非结余,FR-001)。
3. 趋势区:本月每日曲线 + 灰色上月同期线 + "较上月 ±X%"徽标(research R6)。
4. 切换上月:收支/分类/趋势同步刷新;最近账单**不变**(全局最新,FR-003)。

### 场景 E:隐私补强(US2,补 026 缺口)
1. 打开隐私模式(收支卡右上角眼睛)。
2. 验证趋势图:**Y 轴刻度**显示 `••` 而非真实金额(research R3,026 缺口)。
3. 点数据点:Tooltip 金额显示 `***`。
4. 全应用无任何真实金额可见(SC-004)。

### 场景 F:左滑删除 + 撤销(US2)
1. 最近账单某条左滑 → 露出删除 → 点击删除。
2. 验证:列表移除该条 + toast"已删除 [撤销]"。
3. 点撤销 → 该条恢复(research R7)。

## 3. 测试套件

```bash
pnpm test:unit         # 领域纯函数:预算四态边界、转账符号、同账户拒绝
pnpm test:procedure    # tRPC createCaller:transfer 双账户、预算 upsert、资产隔离
pnpm test:integration  # testcontainers 真实 PG:migration + 聚合 SQL + 退款冲减
```

关键测试见各 contract 的 "Test Scenarios" 节。

## 4. 性能验证

```bash
# warm 状态手动测(宪章五不计冷启动)
# dashboard.summary p95 < 500ms(6 并行 task,见 dashboard-summary 契约 Performance Budget)
# transaction.create(transfer)p95 < 300ms
```

## 5. 宪章合规检查

- [ ] US1:constitution.md 版本号 = 3.2.0,原则一移除"转账、预算",原则三允许 Budget/Asset/Debt
- [ ] 每个涉及 UI 的 task 实现前查过 `/heroui-react` skill(原则七)
- [ ] migration down 路径验证可回滚(宪章开发流程 1)
