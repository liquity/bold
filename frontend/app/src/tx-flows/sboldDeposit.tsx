import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { SboldPositionSummary } from "@/src/comps/EarnPositionSummary/SboldPositionSummary";
import { SboldContract } from "@/src/sbold";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { vDnum, vPositionSbold } from "@/src/valibot-utils";
import { css } from "@/styled-system/css";
import { InfoTooltip } from "@liquity2/uikit";
import * as dn from "dnum";
import * as v from "valibot";
import { maxUint256 } from "viem";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "sboldDeposit",
  {
    depositFee: vDnum(),
    prevSboldPosition: vPositionSbold(),
    sboldPosition: vPositionSbold(),
  },
);

export type SboldDepositRequest = v.InferOutput<typeof RequestSchema>;

export const sboldDeposit: FlowDeclaration<SboldDepositRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    const { prevSboldPosition, sboldPosition } = request;
    return (
      <SboldPositionSummary
        prevSboldPosition={prevSboldPosition}
        sboldPosition={sboldPosition}
        txPreviewMode
      />
    );
  },

  Details({ request }) {
    const { sboldPosition, prevSboldPosition, depositFee } = request;
    const depositChange = dn.sub(
      sboldPosition.bold,
      prevSboldPosition.bold,
    );

    const sboldPosition_ = { ...sboldPosition };
    if (dn.lt(depositFee, 0.0001)) {
      sboldPosition_.bold = dn.add(
        sboldPosition.bold,
        depositFee,
      );
    }

    return (
      <>
        <TransactionDetailsRow
          label="You deposit"
          value={[
            <Amount
              key="start"
              suffix=" BOLD"
              value={depositChange}
            />,
            dn.gt(depositFee, 0) && (
              <div
                key="end"
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  whiteSpace: "nowrap",
                })}
              >
                <Amount
                  fallback="…"
                  title={{
                    prefix: "Accounting for ",
                    suffix: " BOLD (Entry Fee)",
                  }}
                  value={depositFee}
                  suffix=" BOLD Entry Fee"
                />
                <InfoTooltip heading="sBOLD Entry Fee">
                  This fee is charged when you deposit BOLD for sBOLD shares, and has been deducted from the deposit
                  amount.
                </InfoTooltip>
              </div>
            ),
          ]}
        />
        <TransactionDetailsRow
          label="You receive"
          value={[
            <Amount
              key="start"
              prefix="~"
              suffix=" sBOLD"
              value={dn.abs(dn.sub(sboldPosition.sbold, prevSboldPosition.sbold))}
            />,
            <div
              key="end"
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 4,
                whiteSpace: "nowrap",
              })}
            >
              Will be slightly less due to yield accrual
              <InfoTooltip heading="Final sBOLD Amount">
                The final amount of sBOLD you receive will be slightly less than this, due to the yield that keeps
                accruing until the transaction is confirmed.
              </InfoTooltip>
            </div>,
          ]}
        />
      </>
    );
  },

  steps: {
    approveBold: {
      name: () => "Approve BOLD",
      Status: (props) => (
        <TransactionStatus
          {...props}
          approval="approve-only"
        />
      ),
      async commit(ctx) {
        const depositChange = dn.sub(
          ctx.request.sboldPosition.bold,
          ctx.request.prevSboldPosition.bold,
        );
        return ctx.writeContract({
          ...ctx.contracts.BoldToken,
          functionName: "approve",
          args: [
            SboldContract.address,
            ctx.preferredApproveMethod === "approve-infinite"
              ? maxUint256 // infinite approval
              : dn.abs(depositChange)[0], // exact amount
          ],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe, false);
      },
    },
    deposit: {
      name: () => "Deposit",
      Status: TransactionStatus,
      async commit({ request, writeContract, account }) {
        const { sboldPosition, prevSboldPosition } = request;
        const boldChange = sboldPosition.bold[0] - prevSboldPosition.bold[0];
        return writeContract({
          ...SboldContract,
          functionName: "deposit",
          args: [boldChange, account],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe, false);
      },
    },
  },

  async getSteps(ctx) {
    const { prevSboldPosition, sboldPosition } = ctx.request;

    const depositChange = sboldPosition.bold[0] - prevSboldPosition.bold[0];

    const allowance = await ctx.readContract({
      ...ctx.contracts.BoldToken,
      functionName: "allowance",
      args: [ctx.account, SboldContract.address],
    });

    return allowance >= depositChange
      ? ["deposit"]
      : ["approveBold", "deposit"];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
