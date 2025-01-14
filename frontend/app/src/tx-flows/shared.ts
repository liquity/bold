import type { CollIndex } from "@/src/types";
import type { Config as WagmiConfig } from "wagmi";

import { SAFE_API_URL } from "@/src/env";
import { getPrefixedTroveId } from "@/src/liquity-utils";
import { graphQuery, TroveByIdQuery } from "@/src/subgraph-queries";
import { sleep } from "@/src/utils";
import { vAddress } from "@/src/valibot-utils";
import * as v from "valibot";
import { waitForTransactionReceipt } from "wagmi/actions";

export function createRequestSchema<
  Id extends string,
  SchemaEntries extends Parameters<typeof v.object>[0],
>(id: Id, entries: SchemaEntries) {
  return v.object({
    flowId: v.literal(id),
    backLink: v.union([
      v.null(),
      v.tuple([
        v.string(), // path
        v.string(), // label
      ]),
    ]),
    successLink: v.tuple([
      v.string(), // path
      v.string(), // label
    ]),
    successMessage: v.string(),
    ...entries,
  });
}

const SafeTransactionSchema = v.object({
  confirmations: v.array(v.object({ owner: vAddress() })),
  confirmationsRequired: v.number(),
  isExecuted: v.union([v.null(), v.boolean()]),
  isSuccessful: v.union([v.null(), v.boolean()]),
  transactionHash: v.union([v.null(), v.string()]),
});

async function getSafeTransaction(safeTxHash: string): Promise<
  v.InferOutput<typeof SafeTransactionSchema>
> {
  if (!SAFE_API_URL) {
    throw new Error("SAFE_API_URL is not set");
  }

  const response = await fetch(
    `${SAFE_API_URL}/v1/multisig-transactions/${safeTxHash}/`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  return v.parse(SafeTransactionSchema, await response.json());
}

async function waitForSafeTransaction(safeTxHash: string): Promise<`0x${string}`> {
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

export async function verifyTransaction(
  wagmiConfig: WagmiConfig,
  hash: string,
) {
  return Promise.race([
    // safe tx
    waitForSafeTransaction(hash).then((txHash) => (
      // still get the receipt to return the same thing
      waitForTransactionReceipt(wagmiConfig, {
        hash: txHash as `0x${string}`,
      })
    )),
    // normal tx
    waitForTransactionReceipt(wagmiConfig, {
      hash: hash as `0x${string}`,
    }),
  ]);
}

export async function verifyTroveUpdate(
  wagmiConfig: WagmiConfig,
  hash: string,
  collIndex: CollIndex,
  lastUpdate: number,
) {
  const receipt = await waitForTransactionReceipt(wagmiConfig, {
    hash: hash as `0x${string}`,
  });
  const prefixedTroveId = getPrefixedTroveId(collIndex, receipt.transactionHash);
  while (true) {
    // wait for the trove to be updated in the subgraph
    const { trove } = await graphQuery(TroveByIdQuery, { id: prefixedTroveId });
    if (trove && Number(trove.updatedAt) * 1000 !== lastUpdate) {
      break;
    }
    await sleep(1000);
  }
}
