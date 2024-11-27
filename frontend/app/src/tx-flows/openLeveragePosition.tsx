import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { ETH_GAS_COMPENSATION, MAX_UPFRONT_FEE } from "@/src/constants";
import { dnum18 } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import { getOpenLeveragedTroveParams } from "@/src/liquity-leverage";
import {
  getCollToken,
  getPrefixedTroveId,
  usePredictOpenTroveUpfrontFee,
} from "@/src/liquity-utils";
import { AccountButton } from "@/src/screens/TransactionsScreen/AccountButton";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { usePrice } from "@/src/services/Prices";
import { graphQuery, TroveByIdQuery } from "@/src/subgraph-queries";
import { isTroveId } from "@/src/types";
import { noop } from "@/src/utils";
import { vPositionLoanUncommited } from "@/src/valibot-utils";
import { ADDRESS_ZERO } from "@liquity2/uikit";
import * as dn from "dnum";
import * as v from "valibot";
import { parseEventLogs } from "viem";
import { readContract } from "wagmi/actions";

const FlowIdSchema = v.literal("openLeveragePosition");

const RequestSchema = v.object({
  flowId: FlowIdSchema,
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

  ownerIndex: v.number(),
  leverageFactor: v.number(),
  loan: vPositionLoanUncommited(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step = "approveLst" | "openLeveragedTrove";

export const openLeveragePosition: FlowDeclaration<Request, Step> = {
  title: "Review & Send Transaction",
  Summary({ flow }) {
    const { request } = flow;
    const { loan } = request;

    const collateral = getCollToken(loan.collIndex);

    if (!collateral) {
      throw new Error("Invalid collateral index");
    }

    return (
      <LoanCard
        leverageMode={true}
        loadingState='success'
        loan={loan}
        onRetry={noop}
        txPreviewMode
      />
    );
  },
  Details({ flow }) {
    const { request } = flow;
    const { loan } = request;

    const collateral = getCollToken(loan.collIndex);
    const collPrice = usePrice(collateral?.symbol ?? null);

    const initialDeposit = dn.div(loan.deposit, request.leverageFactor);

    const yearlyBoldInterest = dn.mul(loan.borrowed, loan.interestRate);

    const upfrontFee = usePredictOpenTroveUpfrontFee(
      loan.collIndex,
      loan.borrowed,
      loan.interestRate
    );
    const borrowedWithFee =
      upfrontFee.data && dn.add(loan.borrowed, upfrontFee.data);

    return (
      collateral && (
        <>
          <TransactionDetailsRow
            label='Initial deposit'
            value={[
              `${fmtnum(initialDeposit)} ${collateral.name}`,
              collPrice && `$${fmtnum(dn.mul(initialDeposit, collPrice))}`,
            ]}
          />
          <TransactionDetailsRow
            label='Borrowed'
            value={[
              `${fmtnum(borrowedWithFee)} USDN`,
              <Amount
                key='end'
                fallback='…'
                prefix='Incl. '
                value={upfrontFee.data}
                suffix=' USDN interest rate adjustment fee'
              />,
            ]}
          />
          {loan.batchManager ? (
            <TransactionDetailsRow
              label='Interest rate delegate'
              value={[
                <AccountButton key='start' address={loan.batchManager} />,
                <div key='end'>
                  {fmtnum(loan.interestRate, "full", 100)}% (~
                  {fmtnum(yearlyBoldInterest, 4)} USDN per year)
                </div>,
              ]}
            />
          ) : (
            <TransactionDetailsRow
              label='Interest rate'
              value={[
                `${fmtnum(loan.interestRate, 2, 100)}%`,
                `${fmtnum(
                  dn.mul(loan.borrowed, loan.interestRate)
                )} USDN per year`,
              ]}
            />
          )}
          <TransactionDetailsRow
            label='Refundable gas deposit'
            value={[
              <div
                key='start'
                title={`${fmtnum(ETH_GAS_COMPENSATION, "full")} ETH`}
              >
                {fmtnum(ETH_GAS_COMPENSATION, 4)} ETH
              </div>,
              "Only used in case of liquidation",
            ]}
          />
        </>
      )
    );
  },

  async getSteps({ account, contracts, request, wagmiConfig }) {
    const { loan } = request;
    const collateral = contracts.collaterals[loan.collIndex];

    if (collateral.symbol === "ETH") {
      return ["openLeveragedTrove"];
    }

    const { LeverageLSTZapper, CollToken } = collateral.contracts;

    const allowance = dnum18(
      await readContract(wagmiConfig, {
        ...CollToken,
        functionName: "allowance",
        args: [account.address ?? ADDRESS_ZERO, LeverageLSTZapper.address],
      })
    );

    const initialDeposit = dn.div(loan.deposit, request.leverageFactor);

    const isApproved = dn.gte(allowance, initialDeposit);

    const steps: Step[] = [];

    if (!isApproved) {
      steps.push("approveLst");
    }

    steps.push("openLeveragedTrove");

    return steps;
  },

  getStepName(stepId, { request }) {
    const { loan } = request;
    const collateral = getCollToken(loan.collIndex);
    if (!collateral) {
      throw new Error("Invalid collateral index: " + loan.collIndex);
    }
    if (stepId === "approveLst") {
      return `Approve ${collateral.name ?? ""}`;
    }
    return "Open Leveraged Position";
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  parseReceipt(stepId, receipt, { request, contracts }): string | null {
    const { loan } = request;
    const collateral = contracts.collaterals[loan.collIndex];
    if (stepId === "openLeveragedTrove") {
      const [troveOperation] = parseEventLogs({
        abi: collateral.contracts.TroveManager.abi,
        logs: receipt.logs,
        eventName: "TroveOperation",
      });
      if (troveOperation) {
        return "0x" + troveOperation.args._troveId.toString(16);
      }
    }
    return null;
  },

  async writeContractParams(stepId, { contracts, request, wagmiConfig }) {
    const { loan } = request;
    const collateral = contracts.collaterals[loan.collIndex];
    const initialDeposit = dn.div(loan.deposit, request.leverageFactor);

    const { LeverageLSTZapper, CollToken, LeverageWETHZapper } =
      collateral.contracts;

    // Approve LST
    if (stepId === "approveLst") {
      return {
        ...CollToken,
        functionName: "approve" as const,
        args: [LeverageLSTZapper.address, initialDeposit[0]],
      };
    }

    // LeverageWETHZapper
    if (collateral.symbol === "ETH" && stepId === "openLeveragedTrove") {
      const params = await getOpenLeveragedTroveParams(
        loan.collIndex,
        initialDeposit[0],
        request.leverageFactor,
        wagmiConfig
      );
      return {
        ...LeverageWETHZapper,
        functionName: "openLeveragedTroveWithRawETH" as const,
        args: [
          {
            owner: loan.borrower,
            ownerIndex: BigInt(request.ownerIndex),
            collAmount: initialDeposit[0],
            flashLoanAmount: params.flashLoanAmount,
            boldAmount: params.effectiveBoldAmount,
            upperHint: 0n,
            lowerHint: 0n,
            annualInterestRate: loan.batchManager ? 0n : loan.interestRate[0],
            batchManager: loan.batchManager ?? ADDRESS_ZERO,
            maxUpfrontFee: MAX_UPFRONT_FEE,
            addManager: ADDRESS_ZERO,
            removeManager: ADDRESS_ZERO,
            receiver: ADDRESS_ZERO,
          },
        ],
        value: initialDeposit[0] + ETH_GAS_COMPENSATION[0],
      };
    }

    // LeverageLSTZapper
    if (stepId === "openLeveragedTrove") {
      const params = await getOpenLeveragedTroveParams(
        loan.collIndex,
        initialDeposit[0],
        request.leverageFactor,
        wagmiConfig
      );
      return {
        ...LeverageLSTZapper,
        functionName: "openLeveragedTroveWithRawETH" as const,
        args: [
          {
            owner: loan.borrower,
            ownerIndex: BigInt(request.ownerIndex),
            collAmount: initialDeposit[0],
            flashLoanAmount: params.flashLoanAmount,
            boldAmount: params.effectiveBoldAmount,
            upperHint: 0n,
            lowerHint: 0n,
            annualInterestRate: loan.batchManager ? 0n : loan.interestRate[0],
            batchManager: loan.batchManager ?? ADDRESS_ZERO,
            maxUpfrontFee: MAX_UPFRONT_FEE,
            addManager: ADDRESS_ZERO,
            removeManager: ADDRESS_ZERO,
            receiver: ADDRESS_ZERO,
          },
        ],
        value: ETH_GAS_COMPENSATION[0],
      };
    }

    throw new Error("Not implemented");
  },

  async postFlowCheck({ request, steps, storedState }) {
    const lastStep = steps?.at(-1);

    if (
      lastStep?.txStatus !== "post-check" ||
      !isTroveId(lastStep.txReceiptData)
    ) {
      return;
    }

    const prefixedTroveId = getPrefixedTroveId(
      request.loan.collIndex,
      lastStep.txReceiptData
    );
    while (true) {
      const { trove } = await graphQuery(TroveByIdQuery, {
        id: prefixedTroveId,
      });
      if (trove !== null) {
        storedState.setState(({ loanModes }) => {
          return {
            loanModes: {
              ...loanModes,
              [prefixedTroveId]: "leverage",
            },
          };
        });
        return;
      }
    }
  },
};
