import type { CollIndex } from "@/src/types";
import type { Config as WagmiConfig } from "wagmi";

import { getPrefixedTroveId } from "@/src/liquity-utils";
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

export async function verifyTroveUpdate(
  wagmiConfig: WagmiConfig,
  hash: `0x${string}`,
  collIndex: CollIndex,
  lastUpdate: number,
) {
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
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
