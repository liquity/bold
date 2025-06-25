import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { BribeInitiative } from "@/src/abi/BribeInitiative";
import { Amount } from "@/src/comps/Amount/Amount";
import { CHAIN_ID } from "@/src/env";
import { fmtnum } from "@/src/formatting";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { tokenIconUrl } from "@/src/utils";
import { vAddress, vDnum } from "@/src/valibot-utils";
import { css } from "@/styled-system/css";
import { TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import * as v from "valibot";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "claimBribes",
  {
    initiative: vAddress(),
    initiativeName: v.optional(v.string()),
    boldAmount: vDnum(),
    bribeTokenAmount: vDnum(),
    bribeTokenAddress: vAddress(),
    bribeTokenSymbol: v.string(),
    claimData: v.array(v.object({
      epoch: v.number(),
      prevLQTYAllocationEpoch: v.number(),
      prevTotalLQTYAllocationEpoch: v.number(),
    })),
  },
);

export type ClaimBribesRequest = v.InferOutput<typeof RequestSchema>;

export const claimBribes: FlowDeclaration<ClaimBribesRequest> = {
  title: "Review & Send Transaction",

  Summary: () => null,

  Details({ request }) {
    const {
      initiativeName,
      initiative,
      boldAmount,
      bribeTokenAmount,
      bribeTokenAddress,
      bribeTokenSymbol,
      claimData,
    } = request;
    const totalEpochs = claimData.length;
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
          Claiming rewards from <span title={initiative}>{initiativeName ?? initiative}</span> over {totalEpochs}{" "}
          epoch{totalEpochs > 1 ? "s" : ""}.
        </div>
        <TransactionDetailsRow
          label="BOLD rewards"
          value={[
            <div
              key="bold"
              title={`${fmtnum(boldAmount)} BOLD`}
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 8,
                userSelect: "none",
              })}
            >
              <Amount
                format={2}
                title={null}
                value={boldAmount}
              />
              <TokenIcon
                size={16}
                symbol="BOLD"
                title={null}
              />
            </div>,
          ]}
        />
        {dn.gt(bribeTokenAmount, 0) && (
          <TransactionDetailsRow
            label={`${bribeTokenSymbol} rewards`}
            value={[
              <div
                key="bribe"
                title={`${fmtnum(bribeTokenAmount)} ${bribeTokenSymbol}`}
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  userSelect: "none",
                })}
              >
                <Amount
                  format={2}
                  title={null}
                  value={bribeTokenAmount}
                />
                <TokenIcon
                  size={16}
                  title={null}
                  token={{
                    icon: tokenIconUrl(CHAIN_ID, bribeTokenAddress),
                    name: bribeTokenSymbol,
                    symbol: bribeTokenSymbol,
                  }}
                />
              </div>,
            ]}
          />
        )}
      </>
    );
  },

  steps: {
    claimBribes: {
      name: () => "Claim bribes",
      Status: TransactionStatus,

      async commit(ctx) {
        const { initiative, claimData } = ctx.request;
        return ctx.writeContract({
          abi: BribeInitiative,
          address: initiative,
          functionName: "claimBribes",
          args: [
            [...claimData]
              // sort claimData by epoch (oldest to newest) as required (see IBribeInitiative.sol)
              .sort((a, b) => a.epoch - b.epoch)
              .map((data) => ({
                epoch: BigInt(data.epoch),
                prevLQTYAllocationEpoch: BigInt(data.prevLQTYAllocationEpoch),
                prevTotalLQTYAllocationEpoch: BigInt(data.prevTotalLQTYAllocationEpoch),
              })),
          ],
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
