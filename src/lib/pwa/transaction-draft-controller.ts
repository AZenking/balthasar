import type { DraftForm } from "@/lib/pwa/draft-storage";

export function normalizeDraftForm(form: DraftForm): DraftForm {
  if (form.type === "transfer") return { ...form, categoryId: "" };
  return { ...form, toAccountId: "" };
}

export function createDraftController({
  save,
  clear,
}: {
  save: (scope: string, form: DraftForm) => void;
  clear: () => void;
}) {
  return {
    save(scope: string, form: DraftForm) {
      save(scope, normalizeDraftForm(form));
    },
    onSuccess() {
      clear();
    },
    onUncertain() {
      return { status: "uncertain" as const, autoRetry: false };
    },
  };
}
