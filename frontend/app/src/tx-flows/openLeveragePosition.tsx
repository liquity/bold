import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { ETH_GAS_COMPENSATION, MAX_UPFRONT_FEE } from "@/src/constants";
import { dnum18 } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import { getOpenLeveragedTroveParams } from "@/src/liquity-leverage";
import { getBranch, getCollToken, getTroveOperationHints, usePredictOpenTroveUpfrontFee } from "@/src/liquity-utils";
import { AccountButton } from "@/src/screens/TransactionsScreen/AccountButton";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { getIndexedTroveById } from "@/src/subgraph";
import { noop, sleep } from "@/src/utils";
import { vPositionLoanUncommited } from "@/src/valibot-utils";
import { css } from "@/styled-system/css";
import { ADDRESS_ZERO, InfoTooltip } from "@liquity2/uikit";
import * as dn from "dnum";
import * as v from "valibot";
import { maxUint256, parseEventLogs } from "viem";
import { readContract } from "wagmi/actions";
import { createRequestSchema, verifyTransaction } from "./shared";

const RequestSchema = createRequestSchema(
  "openLeveragePosition",
  {
    ownerIndex: v.number(),
    leverageFactor: v.number(),
    loan: vPositionLoanUncommited(),
  },
);

export type OpenLeveragePositionRequest = v.InferOutput<typeof RequestSchema>;

export const openLeveragePosition: FlowDeclaration<OpenLeveragePositionRequest> = {
  title: "Review & Send Transaction",

  Summary({ request }) {
    return (
      <LoanCard
        leverageMode={true}
        loadingState="success"
        loan={request.loan}
        onRetry={noop}
        txPreviewMode
      />
    );
  },

  Details({ request }) {
    const { loan } = request;
    const collToken = getCollToken(loan.branchId);
    if (!collToken) {
      throw new Error(`Invalid branch: ${loan.branchId}`);
    }

    const collPrice = usePrice(collToken.symbol);
    const upfrontFee = usePredictOpenTroveUpfrontFee(
      loan.branchId,
      loan.borrowed,
      loan.interestRate,
    );

    const initialDeposit = dn.div(loan.deposit, request.leverageFactor);
    const yearlyBoldInterest = dn.mul(loan.borrowed, loan.interestRate);
    const borrowedWithFee = upfrontFee.data && dn.add(loan.borrowed, upfrontFee.data);

    return (
      <>
        <TransactionDetailsRow
          label="Initial deposit"
          value={[
            `${fmtnum(initialDeposit)} ${collToken.name}`,
            collPrice.data && fmtnum(
              dn.mul(initialDeposit, collPrice.data),
              { preset: "2z", prefix: "$" },
            ),
          ]}
        />
        <TransactionDetailsRow
          label="Borrowed"
          value={[
            `${fmtnum(borrowedWithFee)} BOLD`,
            <div
              key="end"
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 4,
              })}
            >
              <Amount
                key="end"
                fallback="…"
                prefix="Incl. "
                value={upfrontFee.data}
                suffix=" BOLD creation fee"
              />
              <InfoTooltip heading="BOLD Creation Fee">
                This fee is charged when you open a new loan or increase your debt. It corresponds to 7 days of average
                interest for the respective collateral asset.
              </InfoTooltip>
            </div>,
          ]}
        />
        {loan.batchManager
          ? (
            <TransactionDetailsRow
              label="Interest rate delegate"
              value={[
                <AccountButton key="start" address={loan.batchManager} />,
                <div key="end">
                  {fmtnum(loan.interestRate, "pctfull")}% ({fmtnum(yearlyBoldInterest, {
                    digits: 4,
                    dust: false,
                    prefix: "~",
                  })} BOLD per year)
                </div>,
              ]}
            />
          )
          : (
            <TransactionDetailsRow
              label="Interest rate"
              value={[
                `${fmtnum(loan.interestRate, "pct2")}%`,
                `${fmtnum(dn.mul(loan.borrowed, loan.interestRate))} BOLD per year`,
              ]}
            />
          )}
        <TransactionDetailsRow
          label="Refundable gas deposit"
          value={[
            <div
              key="start"
              title={`${fmtnum(ETH_GAS_COMPENSATION, "full")} ETH`}
            >
              {fmtnum(ETH_GAS_COMPENSATION, 4)} ETH
            </div>,
            "Only used in case of liquidation",
          ]}
        />
      </>
    );
  },

  steps: {
    approveLst: {
      name: ({ request }) => {
        const collToken = getCollToken(request.loan.branchId);
        return `Approve ${collToken?.name ?? ""}`;
      },
      Status: (props) => (
        <TransactionStatus
          {...props}
          approval="approve-only"
        />
      ),
      async commit(ctx) {
        const { loan } = ctx.request;
        const initialDeposit = dn.div(loan.deposit, ctx.request.leverageFactor);
        const branch = getBranch(loan.branchId);
        const { LeverageLSTZapper, CollToken } = branch.contracts;
        return ctx.writeContract({
          ...CollToken,
          functionName: "approve",
          args: [
            LeverageLSTZapper.address,
            ctx.preferredApproveMethod === "approve-infinite"
              ? maxUint256 // infinite approval
              : initialDeposit[0], // exact amount
          ],
        });
      },
      async verify(ctx, hash) {
        await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);
      },
    },

    openLeveragedTrove: {
      name: () => "Open Multiply Position",
      Status: TransactionStatus,

      async commit(ctx) {
        const { loan } = ctx.request;
        const initialDeposit = dn.div(loan.deposit, ctx.request.leverageFactor);
        const branch = getBranch(loan.branchId);
        const { LeverageLSTZapper, LeverageWETHZapper } = branch.contracts;

        const openLeveragedParams = await getOpenLeveragedTroveParams(
          loan.branchId,
          initialDeposit[0],
          ctx.request.leverageFactor,
          ctx.wagmiConfig,
        );

        const { upperHint, lowerHint } = await getTroveOperationHints({
          wagmiConfig: ctx.wagmiConfig,
          contracts: ctx.contracts,
          branchId: loan.branchId,
          interestRate: loan.interestRate[0],
        });

        const txParams = {
          owner: loan.borrower,
          ownerIndex: BigInt(ctx.request.ownerIndex),
          collAmount: initialDeposit[0],
          flashLoanAmount: openLeveragedParams.flashLoanAmount,
          boldAmount: openLeveragedParams.effectiveBoldAmount,
          upperHint,
          lowerHint,
          annualInterestRate: loan.batchManager ? 0n : loan.interestRate[0],
          batchManager: loan.batchManager ?? ADDRESS_ZERO,
          maxUpfrontFee: MAX_UPFRONT_FEE,
          addManager: ADDRESS_ZERO,
          removeManager: ADDRESS_ZERO,
          receiver: ADDRESS_ZERO,
        };

        // ETH collateral case
        if (branch.symbol === "ETH") {
          return ctx.writeContract({
            ...LeverageWETHZapper,
            functionName: "openLeveragedTroveWithRawETH",
            args: [txParams],
            value: initialDeposit[0] + ETH_GAS_COMPENSATION[0],
          });
        }

        // LST collateral case
        return ctx.writeContract({
          ...LeverageLSTZapper,
          functionName: "openLeveragedTroveWithRawETH",
          args: [txParams],
          value: ETH_GAS_COMPENSATION[0],
        });
      },

      async verify(ctx, hash) {
        const receipt = await verifyTransaction(ctx.wagmiConfig, hash, ctx.isSafe);

        // Extract trove ID from logs
        const collToken = getCollToken(ctx.request.loan.branchId);
        if (!collToken) throw new Error("Invalid branch");

        const branch = getBranch(ctx.request.loan.branchId);
        const [troveOperation] = parseEventLogs({
          abi: branch.contracts.TroveManager.abi,
          logs: receipt.logs,
          eventName: "TroveOperation",
        });

        if (!troveOperation?.args?._troveId) {
          throw new Error("Failed to extract trove ID from transaction");
        }

        // Wait for trove to appear in subgraph
        while (true) {
          const trove = await getIndexedTroveById(
            branch.branchId,
            `0x${troveOperation.args._troveId.toString(16)}`,
          );
          if (trove !== null) {
            break;
          }
          await sleep(1000);
        }
      },
    },
  },

  async getSteps(ctx) {
    const { loan } = ctx.request;
    const collToken = getCollToken(loan.branchId);
    if (!collToken) {
      throw new Error("Invalid branch: " + loan.branchId);
    }

    // ETH doesn't need approval
    if (collToken.symbol === "ETH") {
      return ["openLeveragedTrove"];
    }

    const branch = getBranch(loan.branchId);
    const { LeverageLSTZapper, CollToken } = branch.contracts;

    const allowance = dnum18(
      await readContract(ctx.wagmiConfig, {
        ...CollToken,
        functionName: "allowance",
        args: [ctx.account, LeverageLSTZapper.address],
      }),
    );

    const steps: string[] = [];

    const initialDeposit = dn.div(loan.deposit, ctx.request.leverageFactor);
    if (dn.lt(allowance, initialDeposit)) {
      steps.push("approveLst");
    }

    steps.push("openLeveragedTrove");

    return steps;
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
};
