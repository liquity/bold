import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { MAX_UPFRONT_FEE } from "@/src/constants";
import { dnum18 } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import {
  getLeverDownTroveParams,
  getLeverUpTroveParams,
} from "@/src/liquity-leverage";
import {
  getCollToken,
  getPrefixedTroveId,
  usePredictAdjustTroveUpfrontFee,
} from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { usePrice } from "@/src/services/Prices";
import { graphQuery, TroveByIdQuery } from "@/src/subgraph-queries";
import { isTroveId } from "@/src/types";
import { vDnum, vPositionLoanCommited } from "@/src/valibot-utils";
import { ADDRESS_ZERO } from "@liquity2/uikit";
import * as dn from "dnum";
import { match, P } from "ts-pattern";
import * as v from "valibot";
import { readContract } from "wagmi/actions";

const FlowIdSchema = v.literal("updateLeveragePosition");

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

  // set to null to indicate no deposit change
  depositChange: v.union([v.null(), vDnum()]),

  // set to null to indicate no leverage change
  leverageFactorChange: v.union([
    v.null(),
    v.tuple([
      v.number(), // prev leverage
      v.number(), // new leverage
    ]),
  ]),

  prevLoan: vPositionLoanCommited(),
  loan: vPositionLoanCommited(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step =
  | "approveLst"
  | "decreaseDeposit"
  | "increaseDeposit"
  | "leverDownTrove"
  | "leverUpTrove";

const stepNames: Record<Step, string> = {
  approveLst: "Approve {tokenName}",
  decreaseDeposit: "Decrease Deposit",
  increaseDeposit: "Increase Deposit",
  leverDownTrove: "Decrease Leverage",
  leverUpTrove: "Increase Leverage",
};

export const updateLeveragePosition: FlowDeclaration<Request, Step> = {
  title: "Review & Send Transaction",

  Summary({ flow }) {
    const { request } = flow;
    const { loan, prevLoan } = request;

    const collateral = getCollToken(loan.collIndex);
    if (!collateral) {
      throw new Error(`Invalid collateral index: ${loan.collIndex}`);
    }

    const upfrontFeeData = useUpfrontFeeData(loan, prevLoan);

    const loadingState = match(upfrontFeeData)
      .returnType<LoadingState>()
      .with({ status: "error" }, () => "error")
      .with({ status: "pending" }, () => "loading")
      .with({ data: null }, () => "not-found")
      .with({ data: P.nonNullable }, () => "success")
      .otherwise(() => "error");

    const borrowedWithFee = dn.add(
      loan.borrowed,
      upfrontFeeData.data?.upfrontFee ?? dn.from(0, 18)
    );

    return (
      <LoanCard
        leverageMode={true}
        loadingState={loadingState}
        loan={{ ...loan, borrowed: borrowedWithFee }}
        prevLoan={prevLoan}
        onRetry={() => {
          upfrontFeeData.refetch();
        }}
        txPreviewMode
      />
    );
  },

  Details({ flow }) {
    const { request } = flow;
    const { loan, prevLoan, depositChange, leverageFactorChange } = request;

    const collateral = getCollToken(loan.collIndex);
    if (!collateral) {
      throw new Error(`Invalid collateral index: ${loan.collIndex}`);
    }

    const collPrice = usePrice(collateral?.symbol ?? null);
    const upfrontFeeData = useUpfrontFeeData(loan, prevLoan);

    const debtChangeWithFee = upfrontFeeData.data?.debtChangeWithFee;
    const isBorrowing = upfrontFeeData.data?.isBorrowing;

    return (
      <>
        {depositChange !== null && (
          <TransactionDetailsRow
            label='Deposit change'
            value={[
              <Amount
                key='start'
                fallback='…'
                value={depositChange}
                suffix={` ${collateral.name}`}
                format={{
                  digits: 2,
                  signDisplay: "exceptZero",
                }}
              />,
              <Amount
                key='end'
                fallback='…'
                value={collPrice && dn.mul(depositChange, collPrice)}
                prefix='$'
              />,
            ]}
          />
        )}
        {leverageFactorChange && (
          <TransactionDetailsRow
            label={isBorrowing ? "Leverage increase" : "Leverage decrease"}
            value={[
              <div key='start'>
                {fmtnum(leverageFactorChange[1] - leverageFactorChange[0], {
                  digits: 2,
                  signDisplay: "exceptZero",
                })}
                x
              </div>,
              <div key='end'>
                {fmtnum(leverageFactorChange[1], 2)}x leverage
              </div>,
            ]}
          />
        )}
        <TransactionDetailsRow
          label={isBorrowing ? "Additional debt" : "Debt reduction"}
          value={[
            <Amount
              key='start'
              fallback='…'
              value={debtChangeWithFee}
              suffix=' USDN'
            />,
            upfrontFeeData.data?.upfrontFee &&
              dn.gt(upfrontFeeData.data.upfrontFee, 0) && (
                <Amount
                  key='end'
                  fallback='…'
                  prefix='Incl. '
                  value={upfrontFeeData.data.upfrontFee}
                  suffix=' USDN interest rate adjustment fee'
                />
              ),
          ]}
        />
      </>
    );
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  async getSteps({ account, contracts, request, wagmiConfig }) {
    const { depositChange, leverageFactorChange, loan } = request;
    const collateral = contracts.collaterals[loan.collIndex];

    const steps: Step[] = [];

    // only check approval for non-ETH collaterals
    if (
      collateral.symbol !== "ETH" &&
      depositChange &&
      dn.gt(depositChange, 0)
    ) {
      const { LeverageLSTZapper, CollToken } = collateral.contracts;

      const allowance = dnum18(
        await readContract(wagmiConfig, {
          ...CollToken,
          functionName: "allowance",
          args: [account.address ?? ADDRESS_ZERO, LeverageLSTZapper.address],
        })
      );

      if (dn.lt(allowance, depositChange)) {
        steps.push("approveLst");
      }
    }

    if (depositChange) {
      steps.push(
        dn.gt(depositChange, 0) ? "increaseDeposit" : "decreaseDeposit"
      );
    }

    if (leverageFactorChange) {
      const [oldLeverage, newLeverage] = leverageFactorChange;
      steps.push(newLeverage > oldLeverage ? "leverUpTrove" : "leverDownTrove");
    }

    return steps;
  },

  getStepName(stepId, { request }) {
    const token = getCollToken(request.loan.collIndex);
    if (!token) {
      throw new Error(`Invalid collateral index: ${request.loan.collIndex}`);
    }
    return stepNames[stepId].replace(/\{tokenName\}/g, token.name);
  },

  async writeContractParams(
    stepId,
    { account, contracts, request, wagmiConfig }
  ) {
    const { loan, leverageFactorChange } = request;
    const collateral = contracts.collaterals[loan.collIndex];

    const Zapper =
      collateral.symbol === "ETH"
        ? collateral.contracts.LeverageWETHZapper
        : collateral.contracts.LeverageLSTZapper;

    if (!account.address) {
      throw new Error("Account address is required");
    }

    if (stepId === "approveLst") {
      if (!request.depositChange) {
        throw new Error(
          "Invalid step: depositChange is required with approveLst"
        );
      }
      return {
        ...collateral.contracts.CollToken,
        functionName: "approve",
        args: [Zapper.address, request.depositChange[0]],
      };
    }

    if (stepId === "increaseDeposit") {
      if (!request.depositChange) {
        throw new Error(
          "Invalid step: depositChange is required with increaseDeposit"
        );
      }
      return collateral.symbol === "ETH"
        ? {
            ...Zapper,
            functionName: "addCollWithRawETH",
            args: [loan.troveId],
            value: request.depositChange[0],
          }
        : {
            ...Zapper,
            functionName: "addColl",
            args: [loan.troveId, request.depositChange[0]],
          };
    }

    if (stepId === "decreaseDeposit") {
      if (!request.depositChange) {
        throw new Error(
          "Invalid step: depositChange is required with decreaseDeposit"
        );
      }
      return {
        ...Zapper,
        functionName:
          collateral.symbol === "ETH" ? "withdrawCollToRawETH" : "withdrawColl",
        args: [loan.troveId, request.depositChange[0] * -1n],
      };
    }

    if (stepId === "leverUpTrove") {
      if (!leverageFactorChange) {
        throw new Error(
          "Invalid step: leverageFactorChange is required with leverUpTrove"
        );
      }
      const params = await getLeverUpTroveParams(
        loan.collIndex,
        loan.troveId,
        leverageFactorChange[1],
        wagmiConfig
      );
      if (!params) {
        throw new Error("Couldn't fetch trove lever up params");
      }
      return {
        ...Zapper,
        functionName: "leverUpTrove",
        args: [
          {
            troveId: loan.troveId,
            flashLoanAmount: params.flashLoanAmount,
            boldAmount: params.effectiveBoldAmount,
            maxUpfrontFee: MAX_UPFRONT_FEE,
          },
        ],
      };
    }

    if (stepId === "leverDownTrove") {
      if (!leverageFactorChange) {
        throw new Error(
          "Invalid step: leverageFactorChange is required with leverDownTrove"
        );
      }
      const params = await getLeverDownTroveParams(
        loan.collIndex,
        loan.troveId,
        leverageFactorChange[1],
        wagmiConfig
      );
      if (!params) {
        throw new Error("Couldn't fetch trove lever down params");
      }
      return {
        ...Zapper,
        functionName: "leverDownTrove",
        args: [
          {
            troveId: loan.troveId,
            flashLoanAmount: params.flashLoanAmount,
            minBoldAmount: params.minBoldAmount,
          },
        ],
      };
    }

    throw new Error("Invalid step");
  },

  async postFlowCheck({ request, steps }) {
    const lastStep = steps?.at(-1);
    if (
      lastStep?.txStatus !== "post-check" ||
      !isTroveId(lastStep.txReceiptData)
    ) {
      return;
    }

    const lastUpdate = request.loan.updatedAt;

    const prefixedTroveId = getPrefixedTroveId(
      request.loan.collIndex,
      lastStep.txReceiptData
    );

    while (true) {
      const { trove } = await graphQuery(TroveByIdQuery, {
        id: prefixedTroveId,
      });

      // trove found and updated: check done
      if (trove && Number(trove.updatedAt) * 1000 !== lastUpdate) {
        break;
      }
    }
  },
};

function useUpfrontFeeData(
  loan: Request["loan"],
  prevLoan: Request["prevLoan"]
) {
  const debtChange = dn.sub(loan.borrowed, prevLoan.borrowed);
  const isBorrowing = dn.gt(debtChange, 0);

  const upfrontFee = usePredictAdjustTroveUpfrontFee(
    loan.collIndex,
    loan.troveId,
    isBorrowing ? debtChange : [0n, 18]
  );

  return {
    ...upfrontFee,
    data: !upfrontFee.data
      ? null
      : {
          isBorrowing,
          debtChangeWithFee: isBorrowing
            ? dn.add(debtChange, upfrontFee.data)
            : debtChange,
          upfrontFee: upfrontFee.data,
        },
  };
}
