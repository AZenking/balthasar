"use client";

/**
 * offline IDB 基础设施 — 033 Phase 2 Foundational(R1 / FR-014)。
 *
 * 033 research R1:用 `idb`(~3KB Promise 封装)。单 DB `balthasar-offline`,
 * 4 个 object store:
 *   - transactions         (缓存交易,近期 30 天)keyPath: id
 *   - dashboard_summaries  (缓存月摘要)         keyPath: familyId+year+month
 *   - pending_queue        (待同步队列)         keyPath: clientRequestId
 *   - meta                 (版本号/配置 singleton)keyPath: id
 *
 * SSR 安全:IndexedDB 仅客户端存在。本模块所有 IDB 操作走 `ensureDB()`,
 * 它先 `typeof indexedDB !== "undefined"` 守卫 + 动态 import `idb`。
 * 绝不在模块顶层 import idb(Server Component 会炸)。
 *
 * FR-014 / 契约 C5:schemaVersion 不匹配时 deleteDatabase 重建(不迁移,YAGNI)。
 */

export const OFFLINE_DB_NAME = "balthasar-offline";
export const OFFLINE_DB_VERSION = 1;

export type StoreName =
  | "transactions"
  | "dashboard_summaries"
  | "pending_queue"
  | "meta";

/** meta store 里的 singleton key。 */
export const META_SINGLETON_ID = "meta";

export interface OfflineMeta {
  id: typeof META_SINGLETON_ID;
  schemaVersion: number;
  lastSyncedAt: number | null;
  retentionDays: number;
}

/**
 * 纯函数:是否需要丢弃重建(FR-014)。
 *
 * @param storedVersion  meta store 里记录的版本(可能 null = 首次/损坏)
 * @param currentVersion 当前代码的 OFFLINE_DB_VERSION
 * @returns true = 删除整个 DB 重建;false = 复用
 */
export function shouldRebuild(
  storedVersion: number | null | undefined,
  currentVersion: number,
): boolean {
  if (storedVersion == null) return true; // 首次 / 损坏
  return storedVersion !== currentVersion; // 不匹配(老/新)都重建
}

// === IDB 类型(存入 store 的行 shape,运行时宽松,字段由读写方负责)===
export type CachedTransactionRow = {
  id: string;
  familyId: string;
  cachedAt: number;
  [key: string]: unknown;
};

export type CachedSummaryRow = {
  /** 复合 key:"familyId|year|month" */
  key: string;
  familyId: string;
  year: number;
  month: number;
  cachedAt: number;
  [key: string]: unknown;
};

export type PendingQueueRow = {
  clientRequestId: string;
  familyId: string;
  createdAt: number;
  status: "pending" | "syncing" | "failed";
  retryCount: number;
  lastError?: string;
  [key: string]: unknown;
};

type OfflineDBSchema = {
  transactions: CachedTransactionRow;
  dashboard_summaries: CachedSummaryRow;
  pending_queue: PendingQueueRow;
  meta: OfflineMeta;
};

/**
 * 缓存的 IDB 连接(单例,懒加载)。模块级变量,但只在客户端赋值。
 * 切勿在模块顶层访问 —— 走 ensureDB()。
 */
let dbPromise: Promise<unknown> | null = null;

/**
 * 打开(必要时重建)离线 DB。SSR 安全 —— 服务端调用抛清晰错误而非崩。
 *
 * 重建逻辑(FR-014):打开后读 meta.schemaVersion,若 shouldRebuild 则
 * deleteDatabase 后重新 ensureDB(递归一次)。
 */
export async function ensureDB(): Promise<import("idb").IDBPDatabase<OfflineDBSchema>> {
  if (typeof indexedDB === "undefined") {
    throw new Error(
      "ensureDB() called in non-browser environment (IndexedDB unavailable). " +
        "Guard callers with typeof indexedDB !== 'undefined'.",
    );
  }
  if (!dbPromise) {
    dbPromise = openWithRebuild();
  }
  return (await dbPromise) as import("idb").IDBPDatabase<OfflineDBSchema>;
}

async function openWithRebuild(): Promise<import("idb").IDBPDatabase<OfflineDBSchema>> {
  const { openDB, deleteDB } = await import("idb");

  const firstOpen = await openDB<OfflineDBSchema>(OFFLINE_DB_NAME, OFFLINE_DB_VERSION, {
    upgrade(db, _oldVersion, _newVersion, transaction) {
      // 建所有 store(若不存在)。idb 的 upgrade 在版本跳变时调用;
      // 我们用 OFFLINE_DB_VERSION=1 起步,首次打开时 _oldVersion=0 建全部。
      if (!db.objectStoreNames.contains("transactions")) {
        const s = db.createObjectStore("transactions", { keyPath: "id" });
        s.createIndex("familyId_occurredAt", ["familyId", "occurredAt"]);
        s.createIndex("familyId", "familyId");
      }
      if (!db.objectStoreNames.contains("dashboard_summaries")) {
        db.createObjectStore("dashboard_summaries", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("pending_queue")) {
        const s = db.createObjectStore("pending_queue", {
          keyPath: "clientRequestId",
        });
        s.createIndex("status_createdAt", ["status", "createdAt"]);
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "id" });
      }
      // transaction 可能 undefined(oldVersion 已有时),不强制写入
      void transaction;
    },
  });

  // FR-014:检查 meta.schemaVersion,不匹配则丢弃重建
  const meta = (await firstOpen.get("meta", META_SINGLETON_ID)) as
    | OfflineMeta
    | undefined;
  if (shouldRebuild(meta?.schemaVersion, OFFLINE_DB_VERSION)) {
    firstOpen.close();
    await deleteDB(OFFLINE_DB_NAME);
    // 递归一次:第二次打开会建空 store,meta 不存在 → 由首次写入方创建
    const secondOpen = await openDB<OfflineDBSchema>(
      OFFLINE_DB_NAME,
      OFFLINE_DB_VERSION,
      {
        upgrade(db) {
          if (!db.objectStoreNames.contains("transactions")) {
            const s = db.createObjectStore("transactions", { keyPath: "id" });
            s.createIndex("familyId_occurredAt", ["familyId", "occurredAt"]);
            s.createIndex("familyId", "familyId");
          }
          if (!db.objectStoreNames.contains("dashboard_summaries")) {
            db.createObjectStore("dashboard_summaries", { keyPath: "key" });
          }
          if (!db.objectStoreNames.contains("pending_queue")) {
            const s = db.createObjectStore("pending_queue", {
              keyPath: "clientRequestId",
            });
            s.createIndex("status_createdAt", ["status", "createdAt"]);
          }
          if (!db.objectStoreNames.contains("meta")) {
            db.createObjectStore("meta", { keyPath: "id" });
          }
        },
      },
    );
    return secondOpen;
  }

  return firstOpen;
}

/**
 * 写入/更新 meta singleton(首次打开或配置变更时调用)。
 */
export async function writeMeta(patch: Partial<Omit<OfflineMeta, "id">>): Promise<void> {
  const db = await ensureDB();
  const existing = (await db.get("meta", META_SINGLETON_ID)) as OfflineMeta | undefined;
  const next: OfflineMeta = {
    id: META_SINGLETON_ID,
    schemaVersion: OFFLINE_DB_VERSION,
    lastSyncedAt: null,
    retentionDays: 30,
    ...existing,
    ...patch,
  };
  await db.put("meta", next);
}

/**
 * 测试/调试用:关闭并清空内存连接(下次 ensureDB 重开)。
 * 不删 DB 数据(那是 deleteDB 的事)。
 */
export function resetDBConnectionForTests(): void {
  dbPromise = null;
}
