import type { CollIndex, TroveId } from "@/src/types";
import type { Config as WagmiConfig } from "wagmi";

import { getPrefixedTroveId } from "@/src/liquity-utils";
import { waitForSafeTransaction } from "@/src/safe-utils";
import { graphQuery, TroveByIdQuery } from "@/src/subgraph-queries";
import { sleep } from "@/src/utils";
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

export async function verifyTransaction(
  wagmiConfig: WagmiConfig,
  hash: string,
  isSafe: boolean,
) {
  // safe tx
  if (isSafe) {
    return waitForSafeTransaction(hash).then((txHash) => (
      // still get the receipt to return the same thing
      waitForTransactionReceipt(wagmiConfig, {
        hash: txHash as `0x${string}`,
      })
    ));
  }

  // normal tx
  return waitForTransactionReceipt(wagmiConfig, {
    hash: hash as `0x${string}`,
  });
}

export async function verifyTroveUpdate(
  wagmiConfig: WagmiConfig,
  hash: string,
  loan: {
    collIndex: CollIndex;
    troveId: TroveId;
    updatedAt: number;
  },
) {
  await waitForTransactionReceipt(wagmiConfig, {
    hash: hash as `0x${string}`,
  });
  const prefixedTroveId = getPrefixedTroveId(loan.collIndex, loan.troveId);
  while (true) {
    // wait for the trove to be updated in the subgraph
    const { trove } = await graphQuery(
      TroveByIdQuery,
      { id: prefixedTroveId },
    );
    if (trove && Number(trove.updatedAt) * 1000 !== loan.updatedAt) {
      break;
    }
    await sleep(1000);
  }
}
