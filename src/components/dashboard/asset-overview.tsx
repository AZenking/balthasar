import Link from "next/link";
import { Wallet } from "lucide-react";
import { Card, Button } from "@heroui/react";

/**
 * AssetOverview (027-mobile-home-revamp US6 FR-020/FR-021)。
 *
 * 资产概览:净资产 / 总资产 / 总负债 + 账户数。
 * 未添加账户(accountCount=0)→ 显示"添加第一个账户"引导(FR-021)。
 *
 * 设计文档 §3.2-8。HeroUI v3:Card 组合式。金额挂 data-amount 走隐私遮蔽。
 *
 * 数据来源:dashboard.summary.assets(AssetsSummary | null)。
 * null = 查询失败降级(SC-008),显示"加载失败 重试"。
 *
 * 025 AP-05:`useRouter`+`onPress` → `<Link>` 包 Button。Server-renderable。
 */
function formatCents(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

type AssetsSummary = {
  totalAssets: number;
  totalLiabilities: number;
  netAssets: number;
  accountCount: number;
};

export function AssetOverview({ assets }: { assets: AssetsSummary | null | undefined }) {
  // null = server 查询失败降级;undefined = IDB placeholder 缺字段(pre-027
  // 旧缓存或写入残缺)。两者均按降级渲染,服务器新鲜响应到达后自动覆盖。
  if (assets == null) {
    return (
      <section aria-label="资产概览" className="pt-4">
        <Card>
          <Card.Content className="p-4">
            <p className="text-sm text-muted">资产加载失败</p>
          </Card.Content>
        </Card>
      </section>
    );
  }

  // 无账户 → 引导(FR-021)
  if (assets.accountCount === 0) {
    return (
      <section aria-label="资产概览" className="pt-4">
        <Card>
          <Card.Content className="flex flex-col items-center gap-3 p-6 text-center">
            <Wallet className="h-8 w-8 text-muted" aria-hidden />
            <div>
              <p className="text-sm font-medium text-foreground">还没有账户</p>
              <p className="text-xs text-muted">
                添加第一个账户,查看资产概览
              </p>
            </div>
            <Link href="/settings">
              <Button variant="outline" size="sm">
                添加第一个账户
              </Button>
            </Link>
          </Card.Content>
        </Card>
      </section>
    );
  }

  const netColor =
    assets.netAssets >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]";

  return (
    <section aria-label="资产概览" className="pt-4">
      <Card>
        <Card.Content className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">资产概览</p>
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                {assets.accountCount} 个账户
              </Button>
            </Link>
          </div>

          <div className="mt-3">
            <p className="text-xs text-muted">净资产</p>
            <p data-amount className={`mt-0.5 text-xl font-medium tabular-nums ${netColor}`}>
              {formatCents(assets.netAssets)}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">总资产</p>
              <p data-amount className="truncate font-medium tabular-nums">
                {formatCents(assets.totalAssets)}
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">总负债</p>
              <p data-amount className="font-medium tabular-nums text-[var(--danger)]">
                {formatCents(assets.totalLiabilities)}
              </p>
            </div>
          </div>
        </Card.Content>
      </Card>
    </section>
  );
}
