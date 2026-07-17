# Contract: 视觉等价与 Loading 改善(FR-013 / SC-003 / CLS 护栏)

**Branch**: `025-perf-code-optimization` | **Date**: 2026-07-16
**Spec**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

> Phase 1 输出。本文件是本次 initiative 唯一的"契约"—— 视觉等价契约。
> 后端 tRPC procedure 契约不在本次范围(由 TS 编译器派生,无需文档)。

## 1. 契约目的

性能优化过程(FR-013)允许的唯一视觉差异是 loading 反馈改善
(空白 → HeroUI v3 Skeleton)。本契约定义:
- 哪些维度**必须不变**(视觉等价)
- 哪些维度**允许改善**(loading 反馈)
- 如何**量化验证**(CLS + 人工核对)

## 2. 不变维度(硬契约)

任何 PR 触及以下维度 = 视觉回归 = PR 阻塞:

| 维度 | 测量方法 | 允许偏差 |
|------|----------|----------|
| 布局结构 | 截图对照 | 0(grid 列数、卡片顺序、Tab 顺序) |
| 间距(padding/margin/gap) | 截图对照 | 0 |
| 颜色(token 值) | Lighthouse + 视觉对照 | 0(必须用 HeroUI 原生 token,见 FR-011) |
| 字体(族/字重/字号) | 截图对照 | 0 |
| 字体方向(RTL/LTR) | 截图对照 | 0 |
| 图标(name/size/color) | 截图对照 | 0 |
| 交互模式(点击/滚动/路由切换) | 手测 | 0 |
| 文案(任何文字内容) | diff 工具 | 0 |
| 数字格式(`¥`、tabular-nums) | 截图对照 | 0 |

## 3. 允许改善维度

| 维度 | 允许的变化 | 必须满足 |
|------|------------|----------|
| 加载态(Dashboard 首次加载) | 空白 → HeroUI `<Skeleton>` | Skeleton 与稳态布局相同(避免 CLS) |
| 加载态(流水列表) | 空白 → HeroUI `<Skeleton>` ×N | Skeleton 行数与典型数据行数一致 |
| 加载态(新增交易表单) | 空白 → HeroUI `<Skeleton>` | Skeleton 占位与表单字段顺序一致 |
| 路由切换(Suspense 边界) | 白屏 → 上层 layout 保持 + 子树 Skeleton | 不引起 layout shift |

## 4. 量化验证

### 4.1 CLS(Cumulative Layout Shift)

- **指标**: Lighthouse 自动给出
- **门槛**: ≤ baseline 数字(基线 PR-1 捕获);不上升
- **理想**: 0(任何 Skeleton 必须占稳态位置)

### 4.2 人工截图对照(PR 模板必填)

PR 描述必须包含以下对照截图(稳态):

| 截图 | 路径 | 状态 |
|------|------|------|
| 主屏(Dashboard) | `/` | 稳态 |
| 流水列表 | `/transactions` | 稳态(至少 5 条数据) |
| 新增交易 | `/transaction/new` | 表单空态 |
| 设置页 | `/settings` | 稳态(辅助对照) |

每张截图附 baseline 与 after 并排对照。

### 4.3 Loading 反馈核对(允许改善的部分)

| 场景 | 触发方式 | 期望 |
|------|----------|------|
| Dashboard 慢网加载 | DevTools Slow 3G + 首次进入 | Skeleton 出现,无空白 |
| 流水慢网加载 | 同上 | Skeleton 列表项 ×3-5 |
| 路由切换 | 快速点击 Tab | 上层 layout 保持,子树 Skeleton |

## 5. PR Review 检查清单

每个 PR 的 reviewer(或自审)必须逐项打勾:

```markdown
## 视觉等价核对(FR-013)
- [ ] CLS 数值 ≤ baseline(Lighthouse 输出附后)
- [ ] 主屏布局未变(附对照截图)
- [ ] 流水列表项间距/颜色/字体未变(附对照截图)
- [ ] 新增交易表单字段顺序未变(附对照截图)
- [ ] 唯一允许的差异:loading Skeleton(已对照 baseline)
- [ ] 涉及 className / variant 改动已查 /heroui-react skill(FR-011)
- [ ] 涉及 HeroUI token 使用原生命名(text-muted 等,非 text-muted-foreground)
```

## 6. 异常处理

- **若 baseline CLS > 0**:说明优化前已有 layout shift,本次 initiative
  在 PR 描述记录但不要求修复(留待独立 initiative);after 数字
  ≤ baseline 即达标
- **若优化引入新的 CLS**:PR 阻塞,必须修复(调整 Skeleton 尺寸或加
  `min-h-*` 占位)
- **若稳态布局必须改动**:违反 spec FR-013,需回到 spec 阶段新增
  clarification

## 7. 不在本契约范围

- 后端 p95 性能契约(由 SC-009 + 宪章原则五独立约束)
- 数据库 schema 契约(本次不动 schema)
- tRPC procedure 契约(由 TS 派生)
- 可访问性(由 HeroUI v3 React Aria 默认提供,本次不专门处理)
