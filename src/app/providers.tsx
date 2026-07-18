"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { trpc } from "@/lib/trpc/client";
import superjson from "superjson";
import { reportRequestOutcome, requestOutcomeFromError } from "@/lib/pwa/service-reachability";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onSuccess: () => reportRequestOutcome({ kind: "success" }),
          onError: (error) => reportRequestOutcome(requestOutcomeFromError(error)),
        }),
        mutationCache: new MutationCache({
          onSuccess: () => reportRequestOutcome({ kind: "success" }),
          onError: (error) => reportRequestOutcome(requestOutcomeFromError(error)),
        }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <PwaProvider>{children}</PwaProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
