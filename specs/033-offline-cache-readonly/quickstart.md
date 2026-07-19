# Quickstart: 033 离线可读 + 写入队列同步(B 级离线)

**Branch**: `033-offline-cache-readonly` | **Date**: 2026-07-18
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

本文件是**端到端验证指南**:如何用 DevTools Offline + 真机走查证明离线能力生效。
不含实现代码(实现见 tasks.md)。

## 前置

| 项 | 值 |
|---|---|
| Node | 22.x LTS |
| pnpm | v11.9.0 |
| 验证浏览器 | Chrome/Edge 最新版(桌面 + Android,支持 Background Sync)、Safari iOS(降级验证) |
| 校验工具 | Chrome DevTools → Application → Service Workers + IndexedDB + Network(Offline throttling) |
| baseline 对照 | 修复前后同环境截图 |

## 1. 启动

```bash
pnpm install
pnpm build && pnpm start    # 生产构建(SW + IDB 行为更接近真实)
# 或 pnpm dev
# 访问 http://localhost:3000
```

## 2. 自动化测试

```bash
pnpm test:unit src/tests/unit/offline/        # 纯函数:缓存读写/保留期/版本/队列状态机
pnpm test:unit src/tests/unit/lib/trpc/       # offline-fallback link(若 Q2 选 link 方案)
pnpm test:procedure                          # transaction.create 幂等去重(若 Q3)
```

**预期**:全绿。重点断言:
- 缓存读写:network 成功用服务器、network 失败回退 IDB
- 保留期过滤:30 天外的交易被清理
- 版本检查:schemaVersion 不匹配时丢弃重建
- 队列状态机:pending → syncing → success(出队)/ fail(retry++ / 达上限 failed)
- 幂等(若 Q3):同 clientRequestId 重复提交返回既有 transaction,不新建

## 3. DevTools Offline 走查(主验收,US1 + US2 + US3)

### 3.1 US1 + US3 — 断网可读 + network-first

1. **先联网加载一次**(建立缓存):打开 Dashboard + 流水页,等数据加载完。DevTools →
   Application → IndexedDB 确认 `balthasar-offline` DB 有 transactions + dashboard_summaries。
2. **DevTools → Network → Offline**:勾选 Offline。
3. **刷新 Dashboard**:
   - **✅ 通过**:显示缓存的本月摘要 + 预算进度(不是空白/offline.html),页面顶部"离线模式"
     轻量提示;< 2 秒(SC-001)。
4. **打开流水页**:
   - **✅ 通过**:显示最近 30 天交易列表,可滚动,按日分组;< 1 秒。
5. **取消 Offline,刷新**:
   - **✅ 通过**(network-first):服务器有新数据就用最新的(可通过服务器端改一笔后刷新验证);
     无新数据则与缓存一致。
6. **服务器请求失败模拟**(DevTools → Network → 把 `/api/trpc` 改 `Status: 500`):
   - **✅ 通过**:回退缓存 + "离线模式"提示(验证 network-first 的"失败才回退"分支)。

### 3.2 US2 — 断网记账入队列 + 后台同步

1. **DevTools → Network → Offline**。
2. **打开记一笔 Drawer,记一笔**(金额/分类/备注):
   - **✅ 通过**:点"确认记账"后**不报错**,显示轻量提示("已记录,联网后自动同步"),
     < 1 秒(SC-003)。DevTools → IndexedDB → `pending_queue` 有 1 条。
3. **再记 2 笔**(队列 3 条):
   - **✅ 通过**:IndexedDB `pending_queue` 有 3 条,按 `createdAt` 排序。
4. **DevTools → Service Workers → Manual → `balthasar-flush-queue` sync 触发**(或取消 Offline
   让 Background Sync 自动触发):
   - **✅ 通过**:队列逐条提交到服务器,全部成功后 `pending_queue` 清空;< 30 秒(SC-004)。
5. **打开流水页**:确认 3 笔交易已出现,按 occurredAt 排序(与正常记账无异)。

### 3.3 幂等(若 Q3 选 clientRequestId)

1. **Offline 状态记 1 笔**(入队列)。
2. **手动模拟"服务器收到但响应丢失"**:DevTools 拦截 `transaction.create` 第一次响应改成
   network error,但服务器实际已建(检查 DB)。
3. **取消 Offline 触发同步**:
   - **✅ 通过**:重试时同 `clientRequestId`,服务器返回既有 transaction(去重),**不新建**
     第二笔。流水页只有 1 笔,不是 2 笔。

### 3.4 失败处理(US2 acceptance 4)

1. **Offline 记 1 笔**。
2. **取消 Offline,但让服务器持续返回 500**(DevTools block `/api/trpc` 或后端停服)。
3. **触发同步**:
   - **✅ 通过**:重试达上限(建议 5 次)后,`pending_queue` 该条转 `failed`,UI 提醒
     "有 1 笔交易未能同步,点击查看";提供手动重试/丢弃。
4. **认证失效模拟**(把 session cookie 改无效):
   - **✅ 通过**:服务器返回 401,队列项**立即**转 `failed`(不重试 401),提示重新登录。

## 4. US4 — 缓存空间管理

1. **长期使用模拟**:用脚本/手动记 100+ 笔交易(跨 60 天)。
2. **DevTools → Application → Storage**:
   - **✅ 通过**:IndexedDB `balthasar-offline` 大小 < 10MB(SC-006)。
3. **检查保留期**:`transactions` store 只有近 30 天的;30 天前的(服务器有)不在缓存。
4. **跨月**:系统时间进下个月,`dashboard_summaries` 新增新月度,上月按需保留/清理。

## 5. iOS 降级(US2 acceptance 6)

1. **iPhone Safari 安装 PWA**(或 iOS Chrome)。
2. **飞行模式记 1 笔** → 入队列 + 提示。
3. **关闭飞行模式,不主动操作**:
   - **iOS 已知限制**:Background Sync 不支持,**不会立即**同步。
4. **打开 app(前台)**:
   - **✅ 通过**:app 前台时检查队列并重试(FR-009 降级),交易提交成功,队列清空。

## 6. 回归验收(既有 PWA 不破)

- [ ] SW 注册正常(DevTools → Application → Service Workers,activated)
- [ ] offline.html 仍生效(完全无缓存 + 断网时显示)
- [ ] 安装引导 / 更新流程(update-alert + SKIP_WAITING)正常
- [ ] 031 草稿 draft-storage 不受影响(草稿仍正常保存/恢复)
- [ ] 既有 manifest / shortcuts(032)不破
- [ ] 桌面端正常(无键盘但有网络切换/离线场景)

## 7. 边界场景

- **首次使用即断网**(无缓存):打开 Dashboard → offline.html 或"无缓存,请联网首次加载"
  提示,不空白/崩溃。
- **缓存范围外**:断网查看 90 天前交易 → "需联网查看",不假装有数据。
- **离线编辑/删除**(FR-013 禁用):断网时编辑/删除 → 禁用按钮或"需联网操作"提示。
- **隐私模式**:IDB 受限 → 退化为非离线模式,不报错。
- **schema 演进**:把 CacheMeta.schemaVersion 改成不匹配 → 下次启动丢弃 IDB 重建。
- **多标签页并发**:两标签同时记一笔 → 各自 clientRequestId,服务器各自建(独立交易)。
