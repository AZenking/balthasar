import { z } from "zod";

export const DRAFT_STORAGE_KEY = "balthasar.pwa.transaction-draft.v1";
const TTL_MS = 24 * 60 * 60 * 1000;

const draftFormSchema = z.object({
  type: z.enum(["income", "expense", "transfer"]),
  accountId: z.string(),
  toAccountId: z.string(),
  categoryId: z.string(),
  amount: z.string(),
  remark: z.string().max(200),
  occurredAt: z.string(),
});
const envelopeSchema = z.object({
  schemaVersion: z.literal(1),
  draftId: z.string(),
  userScope: z.string(),
  form: draftFormSchema,
  status: z.enum(["editing", "uncertain"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string(),
  attemptedAt: z.string().nullable(),
});

export type DraftForm = z.infer<typeof draftFormSchema>;
export type TransactionDraft = z.infer<typeof envelopeSchema>;
export type DraftRead =
  | { kind: "valid"; draft: TransactionDraft }
  | { kind: "absent" | "expired" | "scope-mismatch" | "corrupt" };

/**
 * 判断一个草稿表单是否"空"(无实质用户输入)。
 *
 * 修复 bug:表单挂载时用 defaultValues(type:"expense", amount:"", remark:"",
 * occurredAt: 今天)初始化,React Hook Form 的 watch() 在挂载瞬间就 emit 一次,
 * auto-save 因此把"全是默认值"的草稿写入 localStorage。下一次打开 Drawer 时
 * read() 返回 valid → 弹"恢复草稿"窗,但里面其实没有任何用户输入。
 *
 * "空"的定义:金额与备注都空白 —— 这两样是用户必填/可选的真实输入;
 * type / accountId / categoryId / occurredAt 都有合理默认,不能作为"有输入"的判据。
 *
 * 用途:auto-save 跳过空草稿(不写);recovery 检查跳过空草稿(不弹窗)。
 */
export function isEmptyDraft(form: DraftForm): boolean {
  const amountEmpty = !form.amount || form.amount.trim() === "";
  const remarkEmpty = !form.remark || form.remark.trim() === "";
  return amountEmpty && remarkEmpty;
}

function draftId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createDraftStorage(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">, now = () => new Date()) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { userScope: string; form: DraftForm } | null = null;

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
    try { storage.removeItem(DRAFT_STORAGE_KEY); } catch { /* safe degradation */ }
  };

  const read = (userScope: string): DraftRead => {
    let raw: string | null;
    try { raw = storage.getItem(DRAFT_STORAGE_KEY); } catch { return { kind: "absent" }; }
    if (!raw) return { kind: "absent" };
    try {
      const parsed = envelopeSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) { clear(); return { kind: "corrupt" }; }
      const draft = parsed.data;
      if (new Date(draft.expiresAt).getTime() <= now().getTime()) { clear(); return { kind: "expired" }; }
      if (draft.userScope !== userScope) { clear(); return { kind: "scope-mismatch" }; }
      return { kind: "valid", draft };
    } catch { clear(); return { kind: "corrupt" }; }
  };

  const saveNow = (userScope: string, form: DraftForm) => {
    const timestamp = now();
    const existing = read(userScope);
    const envelope: TransactionDraft = {
      schemaVersion: 1,
      draftId: existing.kind === "valid" ? existing.draft.draftId : draftId(),
      userScope,
      form,
      status: "editing",
      createdAt: existing.kind === "valid" ? existing.draft.createdAt : timestamp.toISOString(),
      updatedAt: timestamp.toISOString(),
      expiresAt: new Date(timestamp.getTime() + TTL_MS).toISOString(),
      attemptedAt: null,
    };
    try { storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(envelope)); return { kind: "saved" as const }; }
    catch { return { kind: "failed" as const }; }
  };

  const flush = () => {
    if (!pending) return { kind: "idle" as const };
    const next = pending;
    pending = null;
    if (timer) clearTimeout(timer);
    timer = null;
    return saveNow(next.userScope, next.form);
  };

  const schedule = (userScope: string, form: DraftForm) => {
    pending = { userScope, form };
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 300);
  };

  /**
   * Marks the current draft as "uncertain": preserves all fields, flips status
   * and records the attempt timestamp. Used when a submit returned without a
   * definitive success/failure so the controller can disable auto-retry while
   * the user checks the transaction list.
   */
  const markUncertain = (userScope: string):
    | { kind: "marked" }
    | { kind: "absent" }
    | { kind: "scope-mismatch" }
    | { kind: "expired" }
    | { kind: "corrupt" }
    | { kind: "failed" } => {
    const existing = read(userScope);
    if (existing.kind !== "valid") return existing;
    const timestamp = now();
    const updated: TransactionDraft = {
      ...existing.draft,
      status: "uncertain",
      attemptedAt: timestamp.toISOString(),
      updatedAt: timestamp.toISOString(),
    };
    try {
      storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(updated));
      return { kind: "marked" as const };
    } catch {
      return { kind: "failed" as const };
    }
  };

  return { read, saveNow, schedule, flush, clear, markUncertain };
}
