import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { Amount } from "@/src/comps/Amount/Amount";
import { fmtnum } from "@/src/formatting";
import { parsePrefixedTroveId } from "@/src/liquity-utils";
import { getCollToken, usePredictAdjustTroveUpfrontFee } from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { usePrice } from "@/src/services/Prices";
import { useLoanById } from "@/src/subgraph-hooks";
import { vAddress, vCollIndex, vDnum, vPrefixedTroveId } from "@/src/valibot-utils";
import * as dn from "dnum";
import { match, P } from "ts-pattern";
import * as v from "valibot";

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

  collIndex: vCollIndex(),
  owner: vAddress(),
  prefixedTroveId: vPrefixedTroveId(),
  collChange: vDnum(),
  debtChange: vDnum(),
  maxUpfrontFee: vDnum(),
  flashLoanAmount: vDnum(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step =
  | "leverUpTrove"
  | "leverDownTrove";

const stepNames: Record<Step, string> = {
  leverUpTrove: "Increase Leverage",
  leverDownTrove: "Decrease Leverage",
};

export const updateLeveragePosition: FlowDeclaration<Request, Step> = {
  title: "Review & Send Transaction",

  Summary({ flow }) {
    const { request } = flow;
    const { troveId } = parsePrefixedTroveId(request.prefixedTroveId);

    const collateral = getCollToken(request.collIndex);
    const loan = useLoanById(request.prefixedTroveId);
    const { debtChangeWithFee } = useUpfrontFee(request);

    const loadingState = match(loan)
      .returnType<LoadingState>()
      .with({ status: "error" }, () => "error")
      .with({ status: "pending" }, () => "loading")
      .with({ data: null }, () => "not-found")
      .with({ data: P.nonNullable }, () => "success")
      .otherwise(() => "error");

    if (!collateral || !loan.data || !debtChangeWithFee) {
      return null;
    }

    const newDeposit = dn.add(loan.data.deposit, request.collChange);
    const newBorrowed = dn.add(loan.data.borrowed, debtChangeWithFee);

    const newLoan = {
      troveId,
      borrower: loan.data.borrower,
      batchManager: loan.data.batchManager,
      borrowed: newBorrowed,
      collIndex: request.collIndex,
      collateral: collateral.symbol,
      deposit: newDeposit,
      interestRate: loan.data.interestRate,
      type: "borrow" as const,
    };

    const prevLoan = {
      ...newLoan,
      borrowed: loan.data.borrowed,
      deposit: loan.data.deposit,
    };

    return (
      <LoanCard
        leverageMode={true}
        loadingState={loadingState}
        loan={newLoan}
        prevLoan={prevLoan}
        onRetry={() => {}}
        txPreviewMode
      />
    );
  },

  Details({ flow }) {
    const { request } = flow;
    const collateral = getCollToken(request.collIndex);
    const collPrice = usePrice(collateral?.symbol ?? null);

    const totalCollateralChange = dn.add(request.collChange, request.flashLoanAmount);
    const { isBorrowing, debtChangeWithFee, upfrontFee } = useUpfrontFee(request);

    return collateral && (
      <>
        <TransactionDetailsRow
          label={isBorrowing ? "Leverage increase" : "Leverage decrease"}
          value={[
            <div key="start">
              {fmtnum(totalCollateralChange)} {collateral.name}
            </div>,
            <Amount
              key="end"
              fallback="…"
              prefix="$"
              value={collPrice && dn.mul(totalCollateralChange, collPrice)}
            />,
          ]}
        />
        <TransactionDetailsRow
          label={isBorrowing ? "Additional debt" : "Debt reduction"}
          value={[
            <Amount
              key="start"
              fallback="…"
              value={debtChangeWithFee}
              suffix=" BOLD"
            />,
            <Amount
              key="end"
              fallback="…"
              prefix="Incl. "
              value={upfrontFee.data}
              suffix=" BOLD upfront fee"
            />,
          ]}
        />
      </>
    );
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  async getSteps({ request }) {
    if (dn.gt(request.collChange, 0) && dn.gt(request.debtChange, 0)) {
      return ["leverUpTrove"];
    }
    if (dn.lt(request.collChange, 0) && dn.lt(request.debtChange, 0)) {
      return ["leverDownTrove"];
    }
    throw new Error("Invalid leverage change request");
  },

  getStepName(stepId) {
    return stepNames[stepId];
  },

  async writeContractParams(stepId, { account, contracts, request }) {
    const { collIndex, debtChange, maxUpfrontFee, flashLoanAmount } = request;
    const collateral = contracts.collaterals[collIndex];
    const { troveId } = parsePrefixedTroveId(request.prefixedTroveId);

    const Controller = collateral.symbol === "ETH"
      ? collateral.contracts.LeverageWETHZapper
      : collateral.contracts.LeverageLSTZapper;

    if (!account.address) {
      throw new Error("Account address is required");
    }

    if (stepId === "leverUpTrove") {
      return {
        ...Controller,
        functionName: "leverUpTrove",
        args: [{
          troveId,
          flashLoanAmount: flashLoanAmount[0],
          boldAmount: debtChange[0],
          maxUpfrontFee: maxUpfrontFee[0],
        }],
      };
    }

    if (stepId === "leverDownTrove") {
      return {
        ...Controller,
        functionName: "leverDownTrove",
        args: [{
          troveId,
          flashLoanAmount: dn.abs(flashLoanAmount)[0],
          minBoldAmount: dn.abs(debtChange)[0],
        }],
      };
    }

    throw new Error("Invalid step");
  },
};

function useUpfrontFee(request: Request) {
  const isBorrowing = dn.gt(request.debtChange, 0);
  const { troveId } = parsePrefixedTroveId(request.prefixedTroveId);

  const upfrontFee = usePredictAdjustTroveUpfrontFee(
    request.collIndex,
    troveId,
    isBorrowing ? request.debtChange : [0n, 18],
  );

  const debtChangeWithFee = isBorrowing && upfrontFee.data
    ? dn.add(request.debtChange, upfrontFee.data)
    : request.debtChange;

  return {
    isBorrowing,
    debtChangeWithFee,
    upfrontFee,
  };
}
