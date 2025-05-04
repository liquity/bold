"use client";

import { DATA_REFRESH_INTERVAL, DATA_STALE_TIME } from "@/src/constants";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: DATA_REFRESH_INTERVAL,
      refetchOnWindowFocus: false,
      staleTime: DATA_STALE_TIME,
    },
  },
});

export function ReactQuery({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
