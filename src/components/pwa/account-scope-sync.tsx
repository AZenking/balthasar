"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { synchronizeAccountScope } from "@/lib/pwa/account-scope";
import { broadcastPwaEvent } from "@/lib/pwa/privacy-lock";
import { createDraftStorage } from "@/lib/pwa/draft-storage";

/**
 * Server-confirmed account identity. Other client code can read this to scope
 * private state (drafts, cache) per the currently-authenticated user.
 */
const AccountScopeContext = createContext<string | null>(null);
export function useAccountScope(): string | null {
  return useContext(AccountScopeContext);
}

/**
 * Receives the server-confirmed user id (or null on auth pages) and clears the
 * prior account's private client state exactly when scope changes A→B / A→null.
 *
 * - Drops the prior user's transaction draft from localStorage.
 * - Clears the React Query cache so no prior account content is rendered.
 * - Broadcasts DRAFT_CLEARED so other tabs mirror the cleanup.
 *
 * Pure first-mount (null→A) does not clear anything — there is nothing to drop.
 */
export function AccountScopeSync({
  confirmedUserId,
  children,
}: {
  confirmedUserId: string | null;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const previousScopeRef = useRef<string | null>(null);

  useEffect(() => {
    const previous = previousScopeRef.current;
    const next = synchronizeAccountScope(previous, confirmedUserId, (scope) => {
      try {
        if (typeof localStorage !== "undefined") {
          createDraftStorage(localStorage).clear();
        }
      } catch {
        // Storage unavailable in private mode; the broadcast still notifies tabs.
      }
      queryClient.clear();
      broadcastPwaEvent({ type: "DRAFT_CLEARED", scope });
    });
    previousScopeRef.current = next;
  }, [confirmedUserId, queryClient]);

  return (
    <AccountScopeContext.Provider value={confirmedUserId}>
      {children}
    </AccountScopeContext.Provider>
  );
}
