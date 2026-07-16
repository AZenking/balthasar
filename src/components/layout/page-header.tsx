import { cn } from "@/lib/utils";

/**
 * PageHeader(026-switch 第一期 3:统一 PageHeader)。
 *
 * 统一替代各主页面散落的 `<h1>` + 自定义 padding/header 结构。负责:
 *   - 标题(`title`,必填)+ 描述(`description`,可选)
 *   - 右侧 action 区(PrivacyToggle / MonthSelect / 其他按钮)
 *   - 与 AppShell 配合,自身只负责标题行,不接管整页 padding。
 *
 * 视觉规范:
 *   - 桌面 / 移动共用同一行布局(`flex items-start justify-between`)
 *   - h1 字号 `text-xl font-bold`,描述 `text-sm text-muted`
 *   - actions 与标题之间 `gap-2`,容器 `gap-3`
 *   - leading(可选):标题左侧槽位,常用于返回按钮,与标题正文垂直居中
 */
interface PageHeaderProps {
  title: string;
  /** 副标题/描述:支持字符串或 JSX(dashboard 传 Greeting 组件)。 */
  description?: React.ReactNode;
  /** 标题左侧槽位:返回按钮等。 */
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  leading,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-start justify-between gap-3 pb-3 pt-2",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {leading}
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">{title}</h1>
          {description && (
            <div className="mt-0.5 truncate text-sm text-muted">
              {description}
            </div>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
