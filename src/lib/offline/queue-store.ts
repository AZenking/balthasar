"use client";

/**
 * queue-store — 033 US2 / FR-004 / FR-006 / FR-007:待同步队列 IDB CRUD。
 *
 * 契约 sync-queue C1:pending_queue store,keyPath clientRequestId,
 * index status+createdAt(查 pending 按 createdAt 升序)。
 *
 * 入队生成 clientRequestId(每次 retry 复用同一值,见 idempotency.md)。
 * 语义区分:与 031 draft-storage 草稿(未提交)不同 —— 本队列是
 * "已点提交但断网未达服务器"。
 */
import { uuidv7 } from "uuidv7";

import { ensureDB, type PendingQueueRow } from "./db";

export type { PendingItem } from "./queue-state";

/** 表单 payload shape(与 transaction.create input 对齐)。 */
export interface FormPayload {
  type: "income" | "expense" | "transfer";
  accountId: string;
  categoryId?: string;
  toAccountId?: string;
  amount: string;
  remark: string;
  occurredAt: string;
  isRefund?: boolean;
}

/**
 * 生成新 pending 项(入队)。clientRequestId 由调用方传入或这里生成。
 */
export function buildPendingItem(args: {
  clientRequestId?: string;
  familyId: string;
  formPayload: FormPayload;
  now: number;
}): PendingQueueRow {
  return {
    clientRequestId: args.clientRequestId ?? uuidv7(),
    familyId: args.familyId,
    formPayload: args.formPayload,
    createdAt: args.now,
    status: "pending",
    retryCount: 0,
  };
}

/** 生成新 clientRequestId(UUIDv7,时间有序便于排查)。 */
export function newClientRequestId(): string {
  return uuidv7();
}

/**
 * 入队一条 pending 项。返回 clientRequestId(调用方用于幂等键)。
 */
export async function enqueue(
  familyId: string,
  formPayload: FormPayload,
  clientRequestId?: string,
): Promise<string> {
  if (typeof indexedDB === "undefined") {
    throw new Error("enqueue() requires IndexedDB (browser-only)");
  }
  const crid = clientRequestId ?? newClientRequestId();
  const item = buildPendingItem({
    clientRequestId: crid,
    familyId,
    formPayload,
    now: Date.now(),
  });
  const db = await ensureDB();
  await db.put("pending_queue", item);
  return crid;
}

/**
 * 取所有 pending/syncing 项(按 createdAt 升序,契约 FR-006 顺序提交)。
 */
export async function getActiveQueue(familyId: string): Promise<PendingQueueRow[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await ensureDB();
  const all = (await db.getAll("pending_queue")) as PendingQueueRow[];
  return all
    .filter((r) => r.familyId === familyId && r.status !== "failed")
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** 取 failed 项(供 badge 展示)。 */
export async function getFailedQueue(familyId: string): Promise<PendingQueueRow[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await ensureDB();
  const all = (await db.getAll("pending_queue")) as PendingQueueRow[];
  return all.filter((r) => r.familyId === familyId && r.status === "failed");
}

/** 标记 syncing / pending / failed(更新整行)。 */
export async function updateItem(item: PendingQueueRow): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await ensureDB();
  await db.put("pending_queue", item);
}

/** 出队(同步成功或永久 drop)。 */
export async function deleteItem(clientRequestId: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await ensureDB();
  await db.delete("pending_queue", clientRequestId);
}

/** 判定队列是否有活跃项(pending/syncing)。用于 badge/提示。 */
export function hasPending(items: PendingQueueRow[]): boolean {
  return items.some((i) => i.status === "pending" || i.status === "syncing");
}

/** 安全序列化(去 payload,用于日志/badge)。 */
export function serializeForLog(item: PendingQueueRow): Omit<PendingQueueRow, "formPayload"> {
  const { formPayload: _f, ...rest } = item;
  return rest;
}
