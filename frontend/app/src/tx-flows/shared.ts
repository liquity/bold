import type { Config as WagmiConfig } from "wagmi";

import { waitForSafeTransaction } from "@/src/safe-utils";
import { BlockNumberQuery, graphQuery } from "@/src/subgraph-queries";
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
  const tx = await (
    isSafe
      // safe tx
      ? waitForSafeTransaction(hash).then((txHash) => (
        // return the same object than a non-safe tx
        waitForTransactionReceipt(wagmiConfig, { hash: txHash as `0x${string}` })
      ))
      // normal tx
      : waitForTransactionReceipt(wagmiConfig, {
        hash: hash as `0x${string}`,
      })
  );

  // wait for the block number to be indexed by the subgraph
  await verifyBlockNumberIndexation(tx.blockNumber);

  return tx;
}

export async function verifyBlockNumberIndexation(blockNumber: bigint) {
  while (true) {
    const result = await graphQuery(BlockNumberQuery);
    const indexedBlockNumber = BigInt(result._meta?.block.number ?? -1);
    if (indexedBlockNumber >= blockNumber) {
      break;
    }
    await sleep(1000);
  }
}
