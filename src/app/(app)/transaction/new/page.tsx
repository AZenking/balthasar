"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TransactionForm } from "@/components/transaction/transaction-form";

function NewTransactionPageInner() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("id") ?? undefined;
  return <TransactionForm editId={editId} />;
}

export default function NewTransactionPage() {
  return (
    <Suspense fallback={null}>
      <NewTransactionPageInner />
    </Suspense>
  );
}
