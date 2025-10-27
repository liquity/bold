import { KNOWN_DELEGATES_URL } from "@/src/env";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import type { InferOutput } from "valibot";
import * as v from "valibot";

const KnownDelegatesSchema = v.array(
  v.object({
    name: v.string(),
    url: v.string(),
    strategies: v.array(
      v.object({
        name: v.string(),
        address: v.string(),
        branches: v.array(v.string()),
        hide: v.optional(v.boolean(), false),
      }),
    ),
  }),
);

export type KnownDelegates = InferOutput<typeof KnownDelegatesSchema>;

export function useKnownDelegates(): UseQueryResult<KnownDelegates | null> {
  return useQuery({
    queryKey: ["knownDelegates"],
    queryFn: async () => {
      if (!KNOWN_DELEGATES_URL) return null;

      const response = await fetch(KNOWN_DELEGATES_URL);
      const data = await response.json();
      return v.parse(KnownDelegatesSchema, data);
    },
  });
}

export function useDelegateDisplayName(delegateAddress: string | null) {
  const knownDelegatesQuery = useKnownDelegates();

  return useMemo(() => {
    if (!delegateAddress || !knownDelegatesQuery.data) return undefined;

    // branchId could be used for filtering delegates by collateral in the future
    for (const group of knownDelegatesQuery.data) {
      const strategy = group.strategies.find(
        (s) => s.address.toLowerCase() === delegateAddress.toLowerCase(),
      );
      if (strategy) {
        return strategy.name ? `${group.name} - ${strategy.name}` : group.name;
      }
    }
    return undefined;
  }, [delegateAddress, knownDelegatesQuery.data]);
}
