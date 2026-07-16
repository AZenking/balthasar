/**
 * BrandHeader(026-switch 第二期 1:BALTHASAR 品牌标题)。
 *
 * 登录 / 注册页统一品牌区,显式承担三件事:
 *   - 标题(默认 "BALTHASAR")
 *   - 副标题(产品价值说明,默认 "10 秒记账,每天坚持。")
 *   - 上下文 action(如"已有账号?去登录")
 *
 * 设计原则:
 *   - 与 PageHeader 区别:PageHeader 用于应用内页面顶行(标题 +
 *     描述 + actions),BrandHeader 用于鉴权页的"产品门面",
 *     字号更大(text-3xl)+ 居中布局。
 *   - 与 HeroUI Card 解耦:本组件只渲染文字区,外壳 (Card) 由
 *     调用方包(详见 login / register page.tsx)。
 *   - 颜色全部走 HeroUI token (var(--foreground) / var(--muted)),
 *     不写死色,自动适配 dark / light / privacy 模式。
 */
interface BrandHeaderProps {
  /** 主标题(默认 "BALTHASAR")。 */
  title?: string;
  /** 副标题 / 价值说明。 */
  subtitle?: string;
  /** 可选 actions(如"已有账号?登录" 链接)。 */
  actions?: React.ReactNode;
}

export function BrandHeader({
  title = "BALTHASAR",
  subtitle = "10 秒记账,每天坚持。",
  actions,
}: BrandHeaderProps) {
  return (
    <div className="space-y-3 pb-6 pt-8 text-center">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {subtitle && (
        <p className="text-sm text-muted">{subtitle}</p>
      )}
      {actions && <div className="pt-2">{actions}</div>}
    </div>
  );
}
