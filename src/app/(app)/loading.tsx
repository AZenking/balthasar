/**
 * (app) route group 通用 loading.tsx(025 US2 T034)。
 *
 * 触发条件:Next.js App Router 在路由切换时,当目标 page.tsx 的 RSC payload
 * 或 client JS chunk 还在流式加载,会立即渲染同目录或父级的 loading.tsx,
 * 避免白屏闪烁(FR-004 / SC-003)。
 *
 * Server Component —— 不能 import `@heroui/react`(其内部含 `client-only`
 * 副作用导入),所以用纯 Tailwind `animate-pulse` 占位。视觉效果与 HeroUI
 * Skeleton 一致,但不引入 client-only 依赖,可被 RSC 流式渲染。
 *
 * 高度与常见 Dashboard / 流水 页接近,保持 CLS=0(FR-013)。
 */
export default function AppLoading() {
  return (
    <div className="space-y-4 p-4" aria-busy="true">
      <div className="h-9 w-32 animate-pulse rounded bg-default" />
      <div className="h-28 w-full animate-pulse rounded-2xl bg-default" />
      <div className="h-32 w-full animate-pulse rounded-2xl bg-default" />
      <div className="h-44 w-full animate-pulse rounded-2xl bg-default" />
      <div className="space-y-2">
        <div className="h-14 w-full animate-pulse rounded bg-default" />
        <div className="h-14 w-full animate-pulse rounded bg-default" />
        <div className="h-14 w-full animate-pulse rounded bg-default" />
      </div>
    </div>
  );
}
