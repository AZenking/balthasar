# Research: 031 记一笔 Drawer 键盘避让收敛 + 类型 Tabs 优化

**Branch**: `031-drawer-keyboard-and-tabs` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

本文件解决 plan Technical Context 中识别的未知项,并给出每个决策的 Decision / Rationale /
Alternatives。**所有 UI 决策均已先调 `/heroui-react` skill**(宪章原则七)。

研究依据:
- `/heroui-react` skill 缓存的 HeroUI v3 文档(`drawer.mdx` / `modal.mdx` / `tabs.mdx`)
- 官方文档: [Drawer](https://www.heroui.com/en/docs/react/components/drawer) /
  [Modal](https://www.heroui.com/en/docs/react/components/modal) /
  [Tabs](https://www.heroui.com/en/docs/react/components/tabs)
- React Aria(HeroUI v3 底层)上游 issue: adobe/react-spectrum #5926、#7902
  (iOS 上 overlay 相对 `window` 定位、focused element 不自动滚入 Modal body)
- 029 既有 research.md(R1 `visualViewport` / R2 HeroUI 外层 workaround / R3 footer 策略)

---

## R1. 根因确认 — 029 双重键盘补偿在 iOS 上互相叠加

### Decision
**确认**用户的诊断:截图中的"Drawer 底部与键盘间空隙 + 设置页透出"根因是 029 落地的
**两套互相叠加的键盘补偿机制**:
1. `useScrollIntoViewOnFocus` 在输入框 focus 后 300ms 调用**全局**
   `element.scrollIntoView({ block: "center" })`;
2. `transaction-form.tsx` embedded 分支给表单 wrapper 加
   `paddingBottom: max(env(safe-area-inset-bottom), keyboardHeight)`。

在 iOS Safari/PWA 上:全局 `scrollIntoView` 不只滚动 `Drawer.Body`,而是滚动整个文档 /
Visual Viewport,于是 `position: fixed`(相对 `window`)的 `Drawer.Content` 被带着上移;
同时 `paddingBottom` 又把内容往上顶,两者叠加产生可见空隙,背景页从空隙透出。

### Rationale
- React Aria `Modal` 把 overlay 相对 `window` 定位,**不相对 `visualViewport`**(上游 issue
  #5926 / #7902),且 iOS 上 focused element **不会**自动滚入 Modal body。这正是 029 当初
  要加 workaround 的原因——workaround 本身没错,错在用了"全局 scroll + 内层 padding"两套
  互相耦合的机制。
- `position: fixed` 在 iOS Safari 上对 `scrollIntoView` 的反应 notorious:浏览器为把目标
  滚入视口会滚动最近的可滚动祖先,可能是 `<html>` / `<body>` 而非 `Drawer.Body`,于是
  fixed 容器视觉上"上移"。
- 同时存在两套补偿 = 同时移动两处(Drawer 本体 + 内层 padding),必然抖动叠加。

### Alternatives Considered
| 方案 | 否决理由 |
|---|---|
| 只调小 029 的 300ms 延迟 / 改 block 值 | 治标;根因是"全局 scroll 滚动 fixed 容器",改参数不解决耦合 |
| 保留全局 scrollIntoView,只去掉 paddingBottom | 仍会滚 fixed 容器,Drawer 仍上移 |
| 保留 paddingBottom,只去掉 scrollIntoView | 聚焦字段不再自动滚入,违背 029 FR-001(spec US1 acceptance 2) |

→ 结论:**必须收敛为单一机制**,见 R2。

---

## R2. 单一键盘避让机制 — Drawer.Content 高度钳制 visualViewport.height

### Decision
**唯一真相源**:`Drawer.Content`(或 `Drawer.Dialog`)的可视高度受 `visualViewport.height`
钳制。键盘弹起 → `visualViewport.height` 缩小 → Drawer 自然变矮并紧贴键盘上方,**无需**
任何 `paddingBottom` 或 `translateY` 补偿。

实现要点(留给 tasks.md 落地,本处只定契约):
- 在 `TransactionDrawer` 内用 `useVisualViewport`(029 既有)读取 `height`;
- **HeroUI v3.2.2 已预留 `--visual-viewport-height` CSS 变量**(T003 验证):
  `drawer.css` 里 `.drawer__backdrop` 与 `.drawer__content` 都是
  `height: var(--visual-viewport-height)`。因此最干净的落地是:在 `useLayoutEffect`
  里把 `document.documentElement.style.setProperty("--visual-viewport-height", \`${vv.height}px\`)`
  写到 `:root`,HeroUI 自动钳制 backdrop + content(无需 inline maxHeight)。
- `Drawer.Dialog` 默认有 `max-h-[85vh]` 会盖过 viewport 钳制,需用
  `className="max-h-[var(--visual-viewport-height)]"` 覆盖(或 `max-h-none` 让
  flex 子项 min-h-0 自然收缩)。
- `transition: max-height 200ms ease-out` 与 iOS 键盘 250ms 动画对齐(沿用 029 R4);
- 桌面端 `vv.height === innerHeight`,等价于不钳制,优雅降级(029 R5)。

### Rationale
- `/heroui-react` skill 调研结论(见 plan Phase 0 报告 Q1):HeroUI v3 Drawer/Modal **没有**
  `keyboardDynamicViewport` / `keyboardAware` / `keyboardHeight` 等 prop;React Aria 的
  "modal adapts to keyboard" 仅在 overlay 相对 `visualViewport` 定位时成立,而 iOS 上相对
  `window`,因此必须由我们显式钳制高度。
- 钳制高度 = 让 Drawer 的可见区域 **等于键盘之上的可视区域**,于是:
  - Drawer 底边天然贴键盘顶(无空隙)→ spec FR-003;
  - `position: fixed` 不再被"滚"上移(因为没有全局 scroll 了)→ 根因消除;
  - footer 在 Body 之外,自然停在可视区底部 → FR-005。
- 复用 029 `useVisualViewport`,不引入新依赖(YAGNI)。

### Alternatives Considered
| 方案 | 否决理由 |
|---|---|
| `transform: translateY(-keyboardHeight)` 推 Drawer | 仍是"移动 fixed 容器",iOS 上 transform 与键盘动画竞态,易抖动 |
| CSS `dvh` 单位 | 029 R1 已证 dvh 不响应 iOS 键盘(键盘是 overlay) |
| 等待 HeroUI 上游加 keyboard-aware prop | 阻塞修复,违反 spec 时间预算 |
| 把整个表单改成全屏页(P2) | 改变产品 IA,违反 spec US1"底部 Drawer"语义 |

---

## R3. scroll 只滚 Drawer.Body 内部 — 改造 useScrollIntoViewOnFocus(最近优先)

### Decision
**移除**全局 `element.scrollIntoView({ block: "center" })`,改为**计算输入框相对
`Drawer.Body` 的位置,只调整 `Drawer.Body` 自身的 `scrollTop`**。策略从 029 的
"滚到中心"改为 **"最近优先 + 底部留白"**:只在字段底部降到 Body 可视底边以下
(减去 bottomMargin=16)时才向上滚,刚好让字段底部贴在可视底边 - margin。
字段已在可视区 → 不动,**顶部 Tabs 不被推出**(FR-008)。

实现契约(已落地):
- hook 返回 `{ scrollContainerRef, attachRef }`;scrollContainerRef 指向
  `Drawer.Body`,attachRef 挂表单根;
- focusin 时纯函数 `computeBodyScrollDelta(targetRect, bodyRect, scrollTop, 16)`
  算 newScrollTop,赋值给 `container.scrollTop`;
- **不调用** `target.scrollIntoView`(避免滚动任何祖先);
- 保留 029 的 `requestAnimationFrame`(等 React 渲染),**移除** 300ms setTimeout
  (钳制高度的 transition 已让 Drawer 在键盘动画期间可见,无需再等);
- `cancelAnimationFrame` 去抖(spec FR-007):新 focusin 进来时 cancel 上一个 pending rAF。

### Rationale
- 根因(R1)就是全局 scroll 滚了 fixed 祖先;只滚 Body 内部 = 物理上不可能带动 Drawer 本体。
- HeroUI `Drawer.Body` 用 native scrolling(`overflow: auto` 由 styles 注入,见 drawer.mdx
  anatomy),直接改 `scrollTop` 是官方支持的行为,不算"绕过 HeroUI"。
- 去掉 300ms 延迟改善"10 秒体感"(宪章五):字段可见越快越好。

### Alternatives Considered
| 方案 | 否决理由 |
|---|---|
| 保留全局 scrollIntoView 但传 `{ block: "nearest" }` | iOS 上 nearest 仍可能滚 fixed 祖先,不可控 |
| 用 React Aria 自带的 focus scroll | 上游 issue #6447 说在 Modal `scroll="inside"` 下会"卡住"(029 R2 已记录) |
| 不做任何 scroll,靠用户手动滚 | 违背 spec US1 acceptance 2(切换字段应自动滚入) |

---

## R4. 提交按钮始终可达 — flex mt-auto(放弃 Drawer.Footer 方案)

### Decision(实现时收敛)
**放弃**原计划"submit 移入 `Drawer.Footer` + 用 `form={id}` 关联"的方案,改用更简的
**`flex flex-col` + submit `mt-auto`**:表单根用 flex 列布局,submit 加 `mt-auto` 被
推到 Drawer.Body 可视区底部;Body 随 `--visual-viewport-height` 钳制收缩后,submit 自然
停在键盘上方。移除 embedded 分支的 `paddingBottom: keyboardHeight` 补偿。

机制变化:
- **修复前**:Body 内 `<div style={{paddingBottom: keyboardHeight}}>{fields}{submit}</div>`
  ——submit 在可滚动区,靠 padding 顶到底部(029 第二套补偿机制,R1 根因之一)。
- **修复后**:Body 内 `<div className="flex flex-col"><div className="space-y-4">{fields}</div>
  <div className="mt-auto">{submit}</div></div>` ——submit 被 flex 推到底,无需 padding。

### Rationale
- Footer 方案要求把 submit 从 `TransactionForm` 内部提为对外暴露(render prop)+ 用
  `form={id}` HTML 属性关联,涉及组件 props 重构 + submit 状态(isSubmitting/selectedType)
  跨组件传递,复杂度高。
- flex mt-auto 同样达成"submit 始终在可视区底部、键盘弹出时贴键盘上方、无需 padding 补偿",
  且改动局部、零跨组件耦合。**YAGNI 胜出**。
- `Drawer.Body` 随父级 `max-h-[var(--visual-viewport-height)]` 钳制收缩时,Body 的 flex
  子项(submit)自然重新贴底,无需监听键盘高度。

### Alternatives Considered
| 方案 | 否决理由 |
|---|---|
| submit 移入 Drawer.Footer(原 R4 计划) | 需拆 TransactionForm + form={id} 关联,复杂度高 |
| 保留 submit 在 Body 内,只去掉 paddingBottom | submit 会随表单滚走,违反 FR-005 精神 |
| 弹键盘时显示浮动 FAB submit | 视觉冗余,与主按钮重复(YAGNI) |

### Trade-off / 接口影响
- 仅 `TransactionForm` embedded 分支内部 JSX 结构变化,无 props 重构、无 tRPC/领域影响。

---

## R5. 类型 Tabs 收紧 + HeroUI v3 官方用法对齐

### Decision
- **无 `size` prop**:`/heroui-react` skill 调研(Tabs API 表)确认 HeroUI v3 Tabs 没有内置
  `size`,密度由 `className` on `Tabs.List` / `Tabs.Tab` 控制。
- 收紧方案:给 `Tabs.List` 加 `*:h-8 *:px-3 *:text-sm`(或更紧的 `*:h-7 *:px-2.5 *:text-xs`,
  实测择优),降低 Tab 高度与左右 padding,让首屏多露一个字段(spec FR-009 / SC-003)。
- 保留既有结构:`<Tabs><Tabs.List><Tabs.Tab>{label}<Tabs.Indicator/></Tabs.Tab>…`(当前代码
  已是 v3 compound 正确用法),只调密度 className + 校验 `Tabs.Indicator` 的 indicatorCls
  着色仍正确(支出红 / 收入绿 / 转账蓝)。
- Tabs 放在 `Drawer.Body` **之外**(Header 区或 Body 上方的固定区),保证键盘弹起时 Tabs 不滚走
  (spec FR-008)。当前 Tabs 在 `TransactionForm` 顶部、属于 Body 内首屏——需确认重构后 Tabs
  是否仍稳。若实测键盘弹起会把 Tabs 滚出,则把 Tabs 提到 Body 外的 sticky 区。

### Rationale
- 这是 HeroUI 官方推荐的密度控制方式(tabs.mdx Styling 示例),不是绕过。
- 颜色语义不变(income→success / expense→danger / transfer→accent,见 docs/THEME.md),
  仅调几何尺寸,符合 spec Q2"不改语义,只优化密度"。

### Alternatives Considered
| 方案 | 否决理由 |
|---|---|
| 改用 `variant="secondary"`(下划线指示器)更省空间 | 改变产品既有视觉(填充药丸 → 下划线),超出 spec Q2 "优化"范畴 |
| 自定义重写 Tabs 组件 | 违反宪章原则七(不替换 HeroUI 组件) |

---

## R6. "为什么和 heroui-react 不一样" — 差异清单与对齐项

### Decision
据 `/heroui-react` skill 与官方 v3 文档,逐项核对当前实现,列出**真实偏离项**与本 feature
的对齐动作:

| # | 偏离项(对照 v3 官方) | 当前代码 | 本 feature 对齐动作 |
|---|---|---|---|
| 1 | submit 应在 `Drawer.Footer`,不在 `Drawer.Body` 内 | embedded 分支 submit 在 Body 内、靠 paddingBottom 垫底 | R4:移入 Footer |
| 2 | Drawer 高度应可受 visualViewport 钳制 | 无钳制,靠 padding 补偿 | R2:钳制 vv.height |
| 3 | Tabs 密度应通过 `Tabs.List`/`Tabs.Tab` className 控制 | 用默认高度 | R5:加 `*:h-* *:px-*` |
| 4 | 全局 scrollIntoView 不应作用于 fixed 容器 | useScrollIntoViewOnFocus 用全局 scroll | R3:改为只滚 Body.scrollTop |

### Rationale
- 用户感知的"不一样"主要来自 #1 / #2(submit 位置 + 高度策略偏离官方 anatomy),修好 R2/R4
  后 Drawer 行为会与官方"Modal adapts to keyboard"示例一致。
- #3 / #4 是次要项,一并修。

### 不算偏离的项(记录以免误改)
- `Tabs` 已是 v3 compound API(`Tabs.List` / `Tabs.Tab` / `Tabs.Indicator`),非 v2 flat API。✅
- 颜色用 `--danger`/`--success`/`--accent` CSS 变量(docs/THEME.md 真相源),非硬编码。✅
- 用 `onPress` 非 `onClick`(Drawer trigger 用原生 button,可接受)。✅
- 无 `<HeroUIProvider>` / `framer-motion` / `@heroui/theme` 残留。✅

---

## 总结:6 个决策与 spec FR/SC 的映射

| Decision | 满足的 FR | 满足的 SC |
|---|---|---|
| R1 根因确认(双重补偿) | (诊断依据) | — |
| R2 高度钳制 vv.height | FR-001(单一机制)、FR-003(无空隙不透出) | SC-001(无空隙)、SC-002(CLS) |
| R3 scroll 只滚 Body | FR-002(只滚 Body) | SC-002(无抖动) |
| R4 submit 移入 Footer | FR-005(始终可达) | SC-001(footer 可达) |
| R5 Tabs 收紧 | FR-008(Tabs 可见)、FR-009(密度) | SC-003(多露字段) |
| R6 对齐官方用法 | FR-010(对齐 heroui-react) | SC-005(差异落档) |

桌面端优雅降级沿用 029 R5(`vv.height === innerHeight` 时钳制等价不钳制),
满足 FR-011 / SC-004。

无 [NEEDS CLARIFICATION] 残留。Phase 0 完成,可进入 Phase 1 设计。
