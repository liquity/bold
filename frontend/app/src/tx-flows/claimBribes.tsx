import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { BribeInitiative } from "@/src/abi/BribeInitiative";
import { Amount } from "@/src/comps/Amount/Amount";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { vAddress, vDnum } from "@/src/valibot-utils";
import { css } from "@/styled-system/css";
import { TokenIcon } from "@liquity2/uikit";
import * as v from "valibot";
import { encodeFunctionData } from "viem";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "claimBribes",
  {
    bribeTokens: v.array(v.object({
      address: vAddress(),
      symbol: v.string(),
      amount: vDnum(),
    })),
    claimableInitiatives: v.array(
      v.object({
        initiative: vAddress(),
        boldAmount: vDnum(),
        bribeTokenAmount: vDnum(),
        bribeTokenAddress: vAddress(),
        epochs: v.array(v.number()),
        claimData: v.array(v.object({
          epoch: v.number(),
          prevLQTYAllocationEpoch: v.number(),
          prevTotalLQTYAllocationEpoch: v.number(),
        })),
      }),
    ),
    totalBold: vDnum(),
  },
);

export type ClaimBribesRequest = v.InferOutput<typeof RequestSchema>;

export const claimBribes: FlowDeclaration<ClaimBribesRequest> = {
  title: "Review & Send Transaction",

  Summary: () => null,

  Details({ request }) {
    const { claimableInitiatives, totalBold, bribeTokens } = request;
    const totalEpochs = (
      new Set(claimableInitiatives.flatMap((init) => init.epochs))
    ).size;
    return (
      <>
        <div
          className={css({
            padding: "16px 0",
            fontSize: 14,
            lineHeight: 1.5,
            color: "contentAlt",
          })}
        >
          Claiming {bribeTokens.length + 1} types of rewards from {claimableInitiatives.length}{" "}
          initiative{claimableInitiatives.length > 1 ? "s" : ""} over {totalEpochs} epoch{totalEpochs > 1 ? "s" : ""}.
        </div>
        <TransactionDetailsRow
          label="Total BOLD rewards"
          value={[
            <div className={css({ display: "flex", alignItems: "center", gap: 8 })}>
              <Amount value={totalBold} format="2z" />
              <TokenIcon symbol="BOLD" size={16} />
            </div>,
          ]}
        />
        {bribeTokens.map((token) => (
          <TransactionDetailsRow
            key={token.address}
            label={`Total ${token.symbol} rewards`}
            value={[
              <div className={css({ display: "flex", alignItems: "center", gap: 8 })}>
                <Amount value={token.amount} format="2z" />
                <span>{token.symbol}</span>
              </div>,
            ]}
          />
        ))}
      </>
    );
  },

  steps: {
    claimBribes: {
      name: () => "Claim all bribes",
      Status: TransactionStatus,

      async commit(ctx) {
        const { claimableInitiatives } = ctx.request;

        if (claimableInitiatives.length === 0) {
          throw new Error("No claimable initiatives found");
        }

        // single initiative: claim directly
        if (claimableInitiatives.length === 1) {
          const initiative = claimableInitiatives[0];
          if (!initiative) throw new Error(); // should not happen
          return ctx.writeContract({
            abi: BribeInitiative,
            address: initiative.initiative,
            functionName: "claimBribes",
            args: [initiative.claimData.map((data) => ({
              epoch: BigInt(data.epoch),
              prevLQTYAllocationEpoch: BigInt(data.prevLQTYAllocationEpoch),
              prevTotalLQTYAllocationEpoch: BigInt(data.prevTotalLQTYAllocationEpoch),
            }))],
          });
        }

        // multiple initiatives: multicall
        const { Governance } = ctx.contracts;
        const inputs: `0x${string}`[] = [];
        for (const initiative of claimableInitiatives) {
          inputs.push(encodeFunctionData({
            abi: BribeInitiative,
            functionName: "claimBribes",
            args: [initiative.claimData.map((data) => ({
              epoch: BigInt(data.epoch),
              prevLQTYAllocationEpoch: BigInt(data.prevLQTYAllocationEpoch),
              prevTotalLQTYAllocationEpoch: BigInt(data.prevTotalLQTYAllocationEpoch),
            }))],
          }));
        }

        return ctx.writeContract({
          ...Governance,
          functionName: "multiDelegateCall",
          args: [inputs],
        });
      },

      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps() {
    return ["claimBribes"];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
