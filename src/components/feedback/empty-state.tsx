/**
 * EmptyState(026-switch 第二期 5:统一空状态)。
 *
 * 替换各页面散落的 `<p className="py-8 text-center ...">暂无 XXX</p>`。
 * 一个空状态需要回答三个问题:
 *   1. 没什么?(title:简短事实句)
 *   2. 为什么空? / 接下来能做什么?(description:解释 + 引导)
 *   3. 主要操作是什么?(action:context-aware CTA)
 *
 * 视觉规范:
 *   - min-h-[40vh]:占满中部区域,避免空白破碎感
 *   - 图标用 text-muted/50,避免抢夺主标题视觉重量
 *   - 标题用 text-foreground(默认正文色),描述用 text-muted
 *   - 全部走 HeroUI CSS 变量,自动适配 dark / light
 */
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** 可选 lucide-react 图标组件(如 ReceiptIcon)。 */
  icon?: React.ComponentType<{ className?: string }>;
  /** 简短标题,陈述"没什么"。 */
  title: string;
  /** 解释 + 引导文案。 */
  description?: string;
  /** 上下文 action(如 Button → /transaction/new)。 */
  action?: React.ReactNode;
  /** 覆盖默认 min-height(默认 40vh)。 */
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center",
        className,
      )}
    >
      {Icon && (
        <Icon
          className="h-12 w-12 text-muted/50"
          aria-hidden
        />
      )}
      <div>
        <p className="text-base font-medium text-foreground">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-muted">{description}</p>
        )}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
