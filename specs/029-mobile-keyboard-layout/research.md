# Research: 029 移动端键盘弹起布局稳定性

**Branch**: `029-mobile-keyboard-layout` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

本文件解决 spec Technical Context 中识别出的 5 个未知项,并给出每个决策的 Decision / Rationale / Alternatives。

---

## R1. 跨浏览器键盘检测的唯一可靠信号 — `visualViewport` API

### Decision
采用 [`window.visualViewport`](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport) API 作为键盘可见性检测的**唯一真相源**,通过 `resize` + `scroll` 双事件订阅计算键盘高度。

### Rationale
- **iOS Safari 把虚拟键盘当 overlay**,不缩小 layout viewport(`window.innerHeight` 不变);Android Chrome 会缩小 layout viewport。这种**跨浏览器行为不一致**是问题的根因,只用 CSS `vh`/`dvh` 无法解决([Reddit r/reactjs 实测](https://www.reddit.com/r/reactjs/comments/1sfnata/dvh_doesnt_solve_the_mobile_keyboard_problem_i/),[WICG viewport-resize-behavior explainer](https://github.com/bramus/viewport-resize-behavior/blob/main/explainer.md))。
- `visualViewport.height` 在两个平台都反映**键盘弹起后的可见高度**,`window.innerHeight - visualViewport.height` 得到键盘高度。
- 阈值 `> 150px` 过滤掉 URL bar 显示/隐藏的噪音(典型 URL bar ≈ 50–80px)。

### Alternatives Considered
| 方案 | 否决理由 |
|---|---|
| CSS `dvh` 单位 | 只响应 browser chrome(URL bar),**不响应虚拟键盘**(键盘是 overlay) |
| `resize` 事件 on `window` | iOS 上不触发(layout viewport 没变) |
| 第三方库 `react-hooks-use-visual-viewport` 等 | 宪章原则六 YAGNI;30 行 hook 已足够 |
| `viewport-resize-behavior` CSS 提案 | 仍是 WICG 草案,2026 浏览器支持不全 |

### 代码草图(仅作 plan 阶段决策参考,不进 spec)

```ts
// src/lib/hooks/use-visual-viewport.ts
export function useVisualViewport() {
  const [vv, setVv] = useState({ height: innerHeight, offsetTop: 0 });
  useEffect(() => {
    const vp = window.visualViewport;
    if (!vp) return;
    const handler = () => setVv({ height: vp.height, offsetTop: vp.offsetTop });
    vp.addEventListener("resize", handler);
    vp.addEventListener("scroll", handler);
    return () => {
      vp.removeEventListener("resize", handler);
      vp.removeEventListener("scroll", handler);
    };
  }, []);
  return {
    ...vv,
    keyboardHeight: Math.max(0, window.innerHeight - vv.height),
    isKeyboardOpen: window.innerHeight - vv.height > 150,
  };
}
```

---

## R2. HeroUI v3 Drawer/Modal 不内置键盘适配 — 外层 workaround 必要且允许

### Decision
- 在 HeroUI `Drawer.Body` / `Drawer.Footer` 之外加一层 className/style 协调键盘高度(`paddingBottom`、`bottom` 等);
- 在 HeroUI 组件 **不替换、不绕过** 的前提下,通过 React `onFocus` 事件 + `scrollIntoView({ behavior: "smooth", block: "center" })` 让聚焦字段自动滚入可视区域。

### Rationale
- `/heroui-react` skill 调研结论:
  - Drawer 文档(`drawer.mdx`)明确:**Focus trap + Body scroll disabled + ESC 关闭 + Tab 循环**。
  - `Drawer.Body` 使用 **native scrolling**(非虚拟滚动),`overflow: auto` 由 HeroUI styles 注入。
  - `isKeyboardDismissDisabled` prop 仅控制 ESC,**不涉及虚拟键盘**。
  - **无任何 `keyboardHeight` / `keyboardAware` / `visualViewport` 集成 props**。
- spec clarification Q2(2026-07-17)已确认:**HeroUI 外层加薄薄 workaround 是允许的**,只要不替换组件、不引入新 UI 库。
- React Aria(HeroUI v3 底层)GitHub issue [#6447](https://github.com/heroui-inc/heroui/issues/6447)指出:React Aria 内置的 `scrollIntoView` 在 Modal/Drawer 内部 `scroll="inside"` 时可能"卡住"。**对策**:不依赖 React Aria 自带的 scroll 行为,在我们的 workaround 里用 `requestAnimationFrame` + `setTimeout(300)` 等待键盘动画完成后主动调用。

### Alternatives Considered
| 方案 | 否决理由 |
|---|---|
| 替换 HeroUI Drawer 为 Base UI Drawer(自带 keyboard-aware focus) | 违反宪章原则七 |
| 在 HeroUI Drawer 之上做 polyfill monkey-patch | 维护负担高,违反 YAGNI |
| 用 `react-native-modal` 风格的全屏 form sheet | 改变产品 IA,违反 spec US1 的"底部 Drawer"语义 |

### 代码草图(Workaround Hook)

```ts
// src/lib/hooks/use-scroll-into-view-on-focus.ts
export function useScrollIntoViewOnFocus() {
  return useCallback((node: HTMLElement | null) => {
    if (!node) return;
    node.addEventListener("focusin", (e) => {
      const target = e.target as HTMLElement;
      requestAnimationFrame(() => {
        setTimeout(() => {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300); // iOS 键盘动画 ≈ 250ms
      });
    });
  }, []);
}
```

---

## R3. 保存按钮始终可达 — 三种放置策略对比

### Decision
**Strategy A — Drawer.Footer 黏在键盘上方**(推荐用于 P1 TransactionDrawer):
- 监听 `useVisualViewport`,动态计算 `keyboardHeight`;
- `Drawer.Footer` 容器加 inline style `paddingBottom: max(env(safe-area-inset-bottom), keyboardHeight)`,或 `transform: translateY(-keyboardHeight)`;
- 当键盘收起时,平滑过渡回 0。

**Strategy B — `position: sticky; bottom: 0`**(推荐用于 P2 全屏页):
- 全屏页 `/transaction/new` 内的提交按钮用 `sticky bottom-0`;
- 监听 visualViewport,paddingBottom 动态加 `keyboardHeight`。

**Strategy C — Drawer.Body 自身高度 = `visualViewport.height - header`**:
- 让整个 Body 区域跟随 keyboard 缩短,Footer 自然贴底。
- 实施成本最高(需自定义 Drawer.Content 高度),收益与 A 重叠。

### Rationale
- A 与 B 复用同一 `useVisualViewport` hook;C 增加复杂度违反 YAGNI。
- spec FR-002 要求"保存按钮始终可达",Strategy A/B 直接达成。
- spec clarification Q2(2026-07-17)允许"HeroUI 外层加薄薄 workaround",A/B 完全合规。

### Alternatives Considered
| 方案 | 否决理由 |
|---|---|
| 把保存按钮放进 Drawer.Body 内部(随表单滚动) | 用户每次输完都要滚动到底部找按钮,违反 FR-002 精神 |
| 弹键盘时显示浮动"保存"FAB | 视觉冗余,与主按钮重复 |
| 等待 HeroUI 上游加 `keyboardAware` prop | 阻塞 initiative,违反 spec 时间预算 |

---

## R4. CLS=0 视觉等价契约 — viewport meta + transitions

### Decision
- `layout.tsx` `viewportFit: "cover"` 已落地(commit 96d470f,branch base 已含)。
- 所有键盘触发的布局调整(paddingBottom、transform)加 `transition: 200ms ease`,与 iOS 键盘动画(250ms)+ Android 键盘动画(200ms)对齐,避免瞬时跳变。
- **不**修改 `layout.tsx` 的 `maximumScale: 1`(已有),因为 pinch-zoom 禁用是表单类应用合理选择(避免聚焦时浏览器自动放大 11px 以下 input,与 spec FR-003 CLS=0 一致)。

### Rationale
- spec FR-003 要求 CLS=0;CSS `transition` 是达成"无抖动感"的最小成本手段。
- iOS Safari 的 keyboard 动画是 250ms cubic-bezier,我们的 transition 200ms ease 略快,体感是"键盘弹起 → 表单同步收起"而非"先跳后稳"。

### Alternatives Considered
| 方案 | 否决理由 |
|---|---|
| 完全无 transition(瞬时变化) | CLS 数字可能仍低,但用户感知是"闪烁" |
| 300ms+ 长动画 | 与 iOS 250ms 不匹配,产生"双段感" |
| `view-transitions API` | 浏览器支持不全,YAGNI |

---

## R5. 桌面端回归 0 缺陷 — 同一 hook 的优雅降级

### Decision
- `useVisualViewport` hook 内 `if (!window.visualViewport) return identity`;桌面端(物理键盘)永远不触发 keyboard detection,`keyboardHeight = 0`,`isKeyboardOpen = false`。
- `useScrollIntoViewOnFocus` 在桌面端正常工作(聚焦时 scrollIntoView 是合理行为,不破坏现有交互)。

### Rationale
- spec FR-006 / SC-005 桌面端回归 0 缺陷;`window.visualViewport` 在所有现代桌面浏览器存在但 `innerHeight === visualViewport.height`,**永远不会误判**。
- 物理键盘 + `Tab` 导航时,React Aria 自带的 focus 管理 + 我们的 scrollIntoView 是叠加增强,不冲突。

### Alternatives Considered
| 方案 | 否决理由 |
|---|---|
| 仅在 mobile viewport 加载 hook(`@media (max-width: 768px)`) | 服务端无法判别,需客户端 mount 后判断 → 闪烁风险 |
| 通过 User-Agent 判别 mobile | UA sniffing 是反模式,违反宪章原则六 |
| 用 CSS `@media (hover: none) and (pointer: coarse)` 媒体查询判定 touch 设备 | 仍需 JS 检测键盘事件,只是冗余条件 |

---

## R6. 现有代码基线 — 96d470f 已完成 viewport-fit=cover

### Status
commit `96d470f`(`fix(mobile): iPhone 安全区底部边距 — viewport-fit=cover`,2026-07-17)已经在 branch base 上落地。它做了:

| 改动 | 作用 |
|---|---|
| `layout.tsx` viewport 加 `viewportFit: "cover"` | iOS Safari 识别 `env(safe-area-inset-*)` 的**必要前提** |
| `bottom-navigation.tsx` `paddingBottom: max(env(safe-area-inset-bottom), 0px)` | 底栏避开 home indicator |

### Implication for 029
- 本 initiative **不需要再动 viewport meta**;R4 的 transition 决策叠加在 96d470f 之上即可。
- 但本 initiative 的 `useVisualViewport` hook 仍需考虑 safe-area:`keyboardHeight` 是从 `innerHeight` 减出,但 `innerHeight` 不含 safe-area inset;`max(env(safe-area-inset-bottom), keyboardHeight)` 是正确的兜底(键盘收起后仍尊重 home indicator 区域)。

---

## 总结:5 个决策与 spec FR/SC 的映射

| Decision | 满足的 FR | 满足的 SC |
|---|---|---|
| R1 `visualViewport` API | FR-001(聚焦字段可见)、FR-008(PWA + 浏览器一致) | SC-001(300ms 内可见) |
| R2 HeroUI 外层 workaround | FR-007(宪章原则七) | SC-007(P3 等价达标) |
| R3 Drawer.Footer / sticky bottom | FR-002(保存按钮始终可达) | SC-002(主要表单 100%) |
| R4 transitions + viewport-fit | FR-003(CLS=0)、FR-004(顶部元素可见) | SC-003(CLS ≤ 0.05) |
| R5 桌面端优雅降级 | FR-006(桌面回归 0 缺陷) | SC-005(0 缺陷) |

无 [NEEDS CLARIFICATION] 残留。Phase 0 完成,可进入 Phase 1 设计。
