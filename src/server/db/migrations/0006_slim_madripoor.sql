-- 027-mobile-home-revamp US4:增量迁移(transfer 类型 + to_account_id + seed 转账分类)
-- 注:drizzle-kit generate 误产了全量快照,此处手改为增量 ALTER(避免与
-- 0001-0006_v15 已创建的类型/表冲突)。journal idx 6 指向本文件。

-- 1. transactions.type 枚举增 transfer
ALTER TYPE "transaction_type" ADD VALUE IF NOT EXISTS 'transfer';--> statement-breakpoint

-- 2. transactions 新增 to_account_id 列(transfer 时=转入账户;NULLABLE)
ALTER TABLE "transactions" ADD COLUMN "to_account_id" uuid;--> statement-breakpoint

-- 3. to_account_id FK → accounts(ON DELETE RESTRICT,与 account_id 一致)
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

-- 4. seed 系统内置"转账"分类(M3 决策:transfer 强制引用此 id 满足 NOT NULL)
--    UUID v5 由 "expense:转账" 在 CATEGORY_DNS_NAMESPACE 派生,跨环境稳定。
INSERT INTO categories (id, name, type, icon, sort_order, is_built_in) VALUES ('6206a8ba-b706-51ee-ace0-39299f1e39d5', '转账', 'expense', '🔄', 900, true) ON CONFLICT (id) DO NOTHING;
