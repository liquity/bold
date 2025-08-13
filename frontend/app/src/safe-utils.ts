import type { Address } from "@/src/types";

import { SAFE_API_URL } from "@/src/env";
import { sleep } from "@/src/utils";
import { vAddress } from "@/src/valibot-utils";
import * as v from "valibot";

async function safeApiCall(path: string) {
  if (!SAFE_API_URL) {
    throw new Error("SAFE_API_URL is not set");
  }
  return fetch(`${SAFE_API_URL}/v1${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
}

export const SafeTransactionSchema = v.object({
  confirmations: v.array(v.object({ owner: vAddress() })),
  confirmationsRequired: v.number(),
  isExecuted: v.union([v.null(), v.boolean()]),
  isSuccessful: v.union([v.null(), v.boolean()]),
  transactionHash: v.union([v.null(), v.string()]),
});

export async function getSafeTransaction(safeTxHash: string): Promise<
  v.InferOutput<typeof SafeTransactionSchema>
> {
  const response = await safeApiCall(`/multisig-transactions/${safeTxHash}`);
  if (!response.ok) {
    throw new Error(response.statusText);
  }
  return v.parse(SafeTransactionSchema, await response.json());
}

export const SafeStatusSchema = v.object({
  address: vAddress(),
  threshold: v.number(),
  owners: v.array(vAddress()),
  version: v.string(),
});

export async function getSafeStatus(safeAddress: Address): Promise<
  v.InferOutput<typeof SafeStatusSchema> | null
> {
  const response = await safeApiCall(`/safes/${safeAddress}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  return v.parse(SafeStatusSchema, await response.json());
}

export async function waitForSafeTransaction(safeTxHash: string): Promise<`0x${string}`> {
  while (true) {
    try {
      const safeTransaction = await getSafeTransaction(safeTxHash);
      if (safeTransaction.transactionHash !== null) {
        return safeTransaction.transactionHash as `0x${string}`;
      }
    } catch (_) {}
    await sleep(2000);
  }
}
