import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { YusndPositionSummary } from "@/src/comps/EarnPositionSummary/YusndPositionSummary";
import { NEGLIGIBLE_FEE_THRESHOLD, YusndContract } from "@/src/yusnd";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { vDnum, vPositionYusnd } from "@/src/valibot-utils";
import { css } from "@/styled-system/css";
import { InfoTooltip } from "@liquity2/uikit";
import * as dn from "dnum";
import * as v from "valibot";
import { maxUint256 } from "viem";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "yusndDeposit",
  {
    depositFee: vDnum(),
    prevYusndPosition: vPositionYusnd(),
    yusndPosition: vPositionYusnd(),
  },
);

export type YusndDepositRequest = v.InferOutput<typeof RequestSchema>;

export const yusndDeposit: FlowDeclaration<YusndDepositRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    const { prevYusndPosition, yusndPosition } = request;
    return (
      <YusndPositionSummary
        prevYusndPosition={prevYusndPosition}
        yusndPosition={yusndPosition}
        txPreviewMode
      />
    );
  },

  Details({ request }) {
    const { yusndPosition, prevYusndPosition, depositFee } = request;
    const depositChange = dn.sub(
      yusndPosition.usnd,
      prevYusndPosition.usnd,
    );

    const yusndPosition_ = { ...yusndPosition };
    if (dn.lt(depositFee, NEGLIGIBLE_FEE_THRESHOLD)) {
      yusndPosition_.usnd = dn.add(
        yusndPosition.usnd,
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
              suffix=" USND"
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
                    suffix: " USND (Entry Fee)",
                  }}
                  value={depositFee}
                  suffix=" USND Entry Fee"
                />
                <InfoTooltip heading="yUSND Entry Fee">
                  This fee is charged when you deposit USND for yUSND shares, and has been deducted from the deposit
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
              suffix=" yUSND"
              value={dn.abs(dn.sub(yusndPosition.yusnd, prevYusndPosition.yusnd))}
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
              <InfoTooltip heading="Final yUSND Amount">
                The final amount of yUSND you receive will be slightly less than this, due to the yield that keeps
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
      name: () => "Approve USND",
      Status: (props) => (
        <TransactionStatus
          {...props}
          approval="approve-only"
        />
      ),
      async commit(ctx) {
        const depositChange = dn.sub(
          ctx.request.yusndPosition.usnd,
          ctx.request.prevYusndPosition.usnd,
        );
        return ctx.writeContract({
          ...ctx.contracts.BoldToken,
          functionName: "approve",
          args: [
            YusndContract.address,
            ctx.preferredApproveMethod === "approve-infinite"
              ? maxUint256 // infinite approval
              : dn.abs(depositChange)[0], // exact amount
          ],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
    deposit: {
      name: () => "Deposit",
      Status: TransactionStatus,
      async commit({ request, writeContract, account }) {
        const { yusndPosition, prevYusndPosition } = request;
        const usndChange = yusndPosition.usnd[0] - prevYusndPosition.usnd[0];
        return writeContract({
          ...YusndContract,
          functionName: "deposit",
          args: [usndChange, account],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },
  },

  async getSteps(ctx) {
    const { prevYusndPosition, yusndPosition } = ctx.request;

    const depositChange = yusndPosition.usnd[0] - prevYusndPosition.usnd[0];

    const allowance = await ctx.readContract({
      ...ctx.contracts.BoldToken,
      functionName: "allowance",
      args: [ctx.account!, YusndContract.address],
    });

    return allowance >= depositChange
      ? ["deposit"]
      : ["approveBold", "deposit"];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
