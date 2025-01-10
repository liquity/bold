import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { ETH_GAS_COMPENSATION, MAX_UPFRONT_FEE } from "@/src/constants";
import { dnum18 } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import { getOpenLeveragedTroveParams } from "@/src/liquity-leverage";
import { getCollToken, getPrefixedTroveId, usePredictOpenTroveUpfrontFee } from "@/src/liquity-utils";
import { AccountButton } from "@/src/screens/TransactionsScreen/AccountButton";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { TransactionStatus } from "@/src/screens/TransactionsScreen/TransactionStatus";
import { usePrice } from "@/src/services/Prices";
import { graphQuery, TroveByIdQuery } from "@/src/subgraph-queries";
import { noop, sleep } from "@/src/utils";
import { vPositionLoanUncommited } from "@/src/valibot-utils";
import { ADDRESS_ZERO } from "@liquity2/uikit";
import * as dn from "dnum";
import * as v from "valibot";
import { parseEventLogs } from "viem";
import { readContract, writeContract } from "wagmi/actions";
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
    const collToken = getCollToken(loan.collIndex);
    if (!collToken) {
      throw new Error(`Invalid collateral index: ${loan.collIndex}`);
    }

    const collPrice = usePrice(collToken.symbol);
    const upfrontFee = usePredictOpenTroveUpfrontFee(
      loan.collIndex,
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
            collPrice.data && `$${fmtnum(dn.mul(initialDeposit, collPrice.data))}`,
          ]}
        />
        <TransactionDetailsRow
          label="Borrowed"
          value={[
            `${fmtnum(borrowedWithFee)} BOLD`,
            <Amount
              key="end"
              fallback="…"
              prefix="Incl. "
              value={upfrontFee.data}
              suffix=" BOLD interest rate adjustment fee"
            />,
          ]}
        />
        {loan.batchManager
          ? (
            <TransactionDetailsRow
              label="Interest rate delegate"
              value={[
                <AccountButton key="start" address={loan.batchManager} />,
                <div key="end">
                  {fmtnum(loan.interestRate, "full", 100)}% (~{fmtnum(yearlyBoldInterest, 4)} BOLD per year)
                </div>,
              ]}
            />
          )
          : (
            <TransactionDetailsRow
              label="Interest rate"
              value={[
                `${fmtnum(loan.interestRate, 2, 100)}%`,
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
        const collToken = getCollToken(request.loan.collIndex);
        return `Approve ${collToken?.name ?? ""}`;
      },
      Status: TransactionStatus,

      async commit({ contracts, request, wagmiConfig }) {
        const { loan } = request;
        const initialDeposit = dn.div(loan.deposit, request.leverageFactor);
        const collateral = contracts.collaterals[loan.collIndex];
        if (!collateral) {
          throw new Error("Invalid collateral index: " + loan.collIndex);
        }
        const { LeverageLSTZapper, CollToken } = collateral.contracts;

        return writeContract(wagmiConfig, {
          ...CollToken,
          functionName: "approve",
          args: [
            LeverageLSTZapper.address,
            initialDeposit[0],
          ],
        });
      },

      async verify({ wagmiConfig }, hash) {
        await verifyTransaction(wagmiConfig, hash);
      },
    },

    openLeveragedTrove: {
      name: () => "Open Multiply Position",
      Status: TransactionStatus,

      async commit({ contracts, request, wagmiConfig }) {
        const { loan } = request;
        const initialDeposit = dn.div(loan.deposit, request.leverageFactor);
        const collateral = contracts.collaterals[loan.collIndex];
        if (!collateral) {
          throw new Error("Invalid collateral index: " + loan.collIndex);
        }
        const { LeverageLSTZapper, LeverageWETHZapper } = collateral.contracts;

        const openLeveragedParams = await getOpenLeveragedTroveParams(
          loan.collIndex,
          initialDeposit[0],
          request.leverageFactor,
          wagmiConfig,
        );

        const txParams = {
          owner: loan.borrower,
          ownerIndex: BigInt(request.ownerIndex),
          collAmount: initialDeposit[0],
          flashLoanAmount: openLeveragedParams.flashLoanAmount,
          boldAmount: openLeveragedParams.effectiveBoldAmount,
          upperHint: 0n,
          lowerHint: 0n,
          annualInterestRate: loan.batchManager ? 0n : loan.interestRate[0],
          batchManager: loan.batchManager ?? ADDRESS_ZERO,
          maxUpfrontFee: MAX_UPFRONT_FEE,
          addManager: ADDRESS_ZERO,
          removeManager: ADDRESS_ZERO,
          receiver: ADDRESS_ZERO,
        };

        // ETH collateral case
        if (collateral.symbol === "ETH") {
          return writeContract(wagmiConfig, {
            ...LeverageWETHZapper,
            functionName: "openLeveragedTroveWithRawETH",
            args: [txParams],
            value: initialDeposit[0] + ETH_GAS_COMPENSATION[0],
          });
        }

        // LST collateral case
        return writeContract(wagmiConfig, {
          ...LeverageLSTZapper,
          functionName: "openLeveragedTroveWithRawETH",
          args: [txParams],
          value: ETH_GAS_COMPENSATION[0],
        });
      },

      async verify({ contracts, request, wagmiConfig }, hash) {
        const receipt = await verifyTransaction(wagmiConfig, hash);

        // Extract trove ID from logs
        const collToken = getCollToken(request.loan.collIndex);
        if (!collToken) throw new Error("Invalid collateral index");

        const collateral = contracts.collaterals[request.loan.collIndex];
        if (!collateral) {
          throw new Error("Invalid collateral index: " + request.loan.collIndex);
        }

        const [troveOperation] = parseEventLogs({
          abi: collateral.contracts.TroveManager.abi,
          logs: receipt.logs,
          eventName: "TroveOperation",
        });

        if (!troveOperation?.args?._troveId) {
          throw new Error("Failed to extract trove ID from transaction");
        }

        // Wait for trove to appear in subgraph
        const prefixedTroveId = getPrefixedTroveId(
          request.loan.collIndex,
          `0x${troveOperation.args._troveId.toString(16)}`,
        );

        while (true) {
          const { trove } = await graphQuery(TroveByIdQuery, { id: prefixedTroveId });
          if (trove !== null) {
            break;
          }
          await sleep(1000);
        }
      },
    },
  },

  async getSteps({
    account,
    contracts,
    request,
    wagmiConfig,
  }) {
    if (!account) {
      throw new Error("Account address is required");
    }

    const { loan } = request;
    const collToken = getCollToken(loan.collIndex);
    if (!collToken) {
      throw new Error("Invalid collateral index: " + loan.collIndex);
    }

    // ETH doesn't need approval
    if (collToken.symbol === "ETH") {
      return ["openLeveragedTrove"];
    }

    const { collaterals } = contracts;
    const collateral = collaterals[loan.collIndex];
    if (!collateral) {
      throw new Error("Invalid collateral index: " + loan.collIndex);
    }
    const { LeverageLSTZapper, CollToken } = collateral.contracts;

    const allowance = dnum18(
      await readContract(wagmiConfig, {
        ...CollToken,
        functionName: "allowance",
        args: [account, LeverageLSTZapper.address],
      }),
    );

    const steps: string[] = [];

    const initialDeposit = dn.div(loan.deposit, request.leverageFactor);
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
