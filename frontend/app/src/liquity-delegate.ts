import type { Address, BranchId } from "@/src/types";
import { DEFAULT_DELEGATES, KNOWN_DELEGATES_URL } from "@/src/env";
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

// branchId could be used for filtering delegates by collateral in the future
function useDelegateGroup(delegateAddress: string | null) {
  const knownDelegatesQuery = useKnownDelegates();

  return useMemo(() => {
    if (!delegateAddress || !knownDelegatesQuery.data) return undefined;

    for (const group of knownDelegatesQuery.data) {
      const strategy = group.strategies.find(
        (s) => s.address.toLowerCase() === delegateAddress.toLowerCase(),
      );
      if (strategy) {
        return { group, strategy };
      }
    }
    return undefined;
  }, [delegateAddress, knownDelegatesQuery.data]);
}

export function useDelegateDisplayName(delegateAddress: string | null) {
  const result = useDelegateGroup(delegateAddress);
  return result
    ? result.strategy.name
      ? `${result.group.name} - ${result.strategy.name}`
      : result.group.name
    : undefined;
}

export function useDelegateGroupName(delegateAddress: string | null) {
  return useDelegateGroup(delegateAddress)?.group.name;
}

export function useDelegateStrategyName(delegateAddress: string | null) {
  return useDelegateGroup(delegateAddress)?.strategy.name || undefined;
}

export type DelegateMode = "manual" | "delegate";

export const HAS_DEFAULT_DELEGATE = Object.keys(DEFAULT_DELEGATES).length > 0;


export function getDefaultDelegateMode(branchId: BranchId, batchManager?: Address | null): DelegateMode {
  if (!batchManager) {
    return DEFAULT_DELEGATES[branchId] ? "delegate" : "manual";
  }
  return "delegate";
}

export function getDefaultDelegate(branchId: BranchId, batchManager?: Address | null): Address | null {
  return batchManager ?? DEFAULT_DELEGATES[branchId] ?? null;
}
