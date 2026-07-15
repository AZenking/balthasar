import "server-only";
import { db } from "@/server/db/client";
import { sql } from "drizzle-orm";

/**
 * Assets aggregation (027-mobile-home-revamp US6, research R5)。
 *
 * 按 accounts.type(asset/debt)分组聚合,返回净资产/总资产/总负债。
 *
 * 余额计算(含 transfer 双向):
 *   account.balance = initialBalance
 *     + SUM(income/expense amount WHERE accountId = 该账户)
 *     - SUM(transfer amount WHERE accountId = 该账户)       -- 转出减
 *     + SUM(transfer amount WHERE toAccountId = 该账户)     -- 转入加
 *
 * 聚合:
 *   totalAssets      = SUM(balance WHERE type='asset')
 *   totalLiabilities = SUM(ABS(balance) WHERE type='debt')  -- 负债展示为正
 *   netAssets        = totalAssets - totalLiabilities
 *
 * 排除归档账户(archived_at IS NULL)。
 * data-model §1.2 / contracts/dashboard-assets.md。
 */
export async function getAssets(opts: {
  familyId: string;
}): Promise<{
  totalAssets: number;
  totalLiabilities: number;
  netAssets: number;
  accountCount: number;
}> {
  const result = await db.execute<{
    total_assets: string;
    total_liabilities: string;
    account_count: string;
  }>(sql`
    WITH account_balances AS (
      SELECT
        a.id,
        a.type,
        a.initial_balance
          + COALESCE((
            SELECT SUM(t.amount) FROM transactions t
            WHERE t.family_id = ${opts.familyId}
              AND t.type IN ('income', 'expense')
              AND t.account_id = a.id
          ), 0)
          - COALESCE((
            SELECT SUM(t.amount) FROM transactions t
            WHERE t.family_id = ${opts.familyId}
              AND t.type = 'transfer'
              AND t.account_id = a.id
          ), 0)
          + COALESCE((
            SELECT SUM(t.amount) FROM transactions t
            WHERE t.family_id = ${opts.familyId}
              AND t.type = 'transfer'
              AND t.to_account_id = a.id
          ), 0)
        AS balance
      FROM accounts a
      WHERE a.family_id = ${opts.familyId}
        AND a.archived_at IS NULL
    )
    SELECT
      COALESCE(SUM(CASE WHEN type = 'asset' THEN balance ELSE 0 END), 0)::text AS total_assets,
      COALESCE(SUM(CASE WHEN type = 'debt' THEN ABS(balance) ELSE 0 END), 0)::text AS total_liabilities,
      COUNT(*)::text AS account_count
    FROM account_balances
  `);

  const r = (result.rows as Array<{ total_assets: string; total_liabilities: string; account_count: string }>)[0];
  const totalAssets = Number(r?.total_assets ?? 0);
  const totalLiabilities = Number(r?.total_liabilities ?? 0);
  return {
    totalAssets,
    totalLiabilities,
    netAssets: totalAssets - totalLiabilities,
    accountCount: Number(r?.account_count ?? 0),
  };
}
