import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";
import type { Address } from "@/src/types";

import { MAX_ANNUAL_INTEREST_RATE, MIN_ANNUAL_INTEREST_RATE } from "@/src/constants";
import { dnum18 } from "@/src/dnum-utils";
import { CHAIN_BLOCK_EXPLORER } from "@/src/env";
import { fmtnum } from "@/src/formatting";
import { usePredictAdjustInterestRateUpfrontFee } from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { vPositionLoan } from "@/src/valibot-utils";
import { css } from "@/styled-system/css";
import { ADDRESS_ZERO, AnchorTextButton, shortenAddress } from "@liquity2/uikit";
import { blo } from "blo";
import * as dn from "dnum";
import Image from "next/image";
import { match, P } from "ts-pattern";
import * as v from "valibot";
import { maxUint256 } from "viem";
import { readContract } from "wagmi/actions";

const FlowIdSchema = v.literal("updateLoanInterestRate");

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

  prevLoanPosition: vPositionLoan(),
  loanPosition: vPositionLoan(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step =
  | "adjustInterestRate"
  | "setInterestBatchManager"
  | "unsetInterestBatchManager";

export const updateLoanInterestRate: FlowDeclaration<Request, Step> = {
  title: "Review & Confirm",
  Summary({ flow }) {
    const { request } = flow;
    const loan = request.loanPosition;
    const prevLoan = request.prevLoanPosition;

    const upfrontFee = usePredictAdjustInterestRateUpfrontFee(
      loan.collIndex,
      loan.troveId,
      loan.batchManager ?? loan.interestRate,
      prevLoan.batchManager !== null,
    );

    const borrowedWithFee = upfrontFee.data && dn.add(loan.borrowed, upfrontFee.data);

    const loadingState = match(upfrontFee)
      .returnType<LoadingState>()
      .with({ status: "error" }, () => "error")
      .with({ status: "pending" }, () => "loading")
      .with({ data: P.nonNullable }, () => "success")
      .exhaustive();

    return (
      <LoanCard
        leverageMode={false}
        loadingState={loadingState}
        loan={{
          ...loan,
          borrowed: borrowedWithFee ?? dnum18(0),
        }}
        prevLoan={prevLoan}
        onRetry={() => {
          upfrontFee.refetch();
        }}
        txPreviewMode
      />
    );
  },
  Details({ flow }) {
    const { request } = flow;
    const loan = request.loanPosition;
    const prevLoanPosition = request.prevLoanPosition;

    const boldPerYear = dn.mul(loan.borrowed, loan.interestRate);

    return loan.batchManager
      ? (
        <TransactionDetailsRow
          label="Interest rate delegate"
          value={[
            <AccountPreview key="start" address={loan.batchManager} />,
            <div key="end">
              {fmtnum(loan.interestRate, "full", 100)}% (~{fmtnum(boldPerYear, 4)} BOLD per year)
            </div>,
          ]}
        />
      )
      : (
        <>
          <TransactionDetailsRow
            label="Set interest rate"
            value={[
              <div key="start">
                {fmtnum(loan.interestRate, "full", 100)}%
              </div>,
              <div
                key="end"
                title={`${fmtnum(boldPerYear, "full")} BOLD per year`}
              >
                ~{fmtnum(boldPerYear, 4)} BOLD per year
              </div>,
            ]}
          />
          {prevLoanPosition.batchManager && (
            <TransactionDetailsRow
              label="Remove interest rate delegate"
              value={[
                <div
                  key="start"
                  className={css({
                    textDecoration: "line-through",
                  })}
                >
                  <AccountPreview address={prevLoanPosition.batchManager} />
                </div>,
                <div
                  key="end"
                  className={css({
                    textDecoration: "line-through",
                  })}
                >
                  {fmtnum(prevLoanPosition.interestRate, "full", 100)}% (~{fmtnum(
                    dn.mul(prevLoanPosition.borrowed, prevLoanPosition.interestRate),
                    4,
                  )} BOLD per year)
                </div>,
              ]}
            />
          )}
        </>
      );
  },
  async getSteps({ request, contracts, wagmiConfig }) {
    const loan = request.loanPosition;

    const collateral = contracts.collaterals[loan.collIndex];

    if (loan.batchManager) {
      return ["setInterestBatchManager"];
    }

    const isInBatch = (await readContract(wagmiConfig, {
      ...collateral.contracts.BorrowerOperations,
      functionName: "interestBatchManagerOf",
      args: [BigInt(loan.troveId)],
    })) !== ADDRESS_ZERO;

    return isInBatch ? ["unsetInterestBatchManager"] : ["adjustInterestRate"];
  },

  getStepName(stepId) {
    return match(stepId)
      .with("adjustInterestRate", () => "Update interest rate")
      .with("setInterestBatchManager", () => "Set interest rate delegate")
      .with("unsetInterestBatchManager", () => "Update interest rate")
      .exhaustive();
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  async writeContractParams(stepId, { contracts, request }) {
    const loan = request.loanPosition;

    const { BorrowerOperations } = contracts.collaterals[loan.collIndex].contracts;

    if (stepId === "adjustInterestRate") {
      return {
        ...BorrowerOperations,
        functionName: "adjustTroveInterestRate" as const,
        args: [
          BigInt(loan.troveId),
          loan.interestRate[0],
          0n,
          0n,
          maxUint256,
        ],
      };
    }

    if (stepId === "unsetInterestBatchManager") {
      return {
        ...BorrowerOperations,
        functionName: "removeFromBatch" as const,
        args: [
          BigInt(loan.troveId),
          loan.interestRate[0],
          0n,
          0n,
          maxUint256,
        ],
      };
    }

    if (stepId === "setInterestBatchManager") {
      return {
        ...BorrowerOperations,
        functionName: "setInterestBatchManager" as const,
        args: [
          BigInt(loan.troveId),
          loan.batchManager,
          MIN_ANNUAL_INTEREST_RATE[0],
          MAX_ANNUAL_INTEREST_RATE[0],
          maxUint256,
        ],
      };
    }

    return null;
  },
};

function AccountPreview({
  address,
}: {
  address: Address;
}) {
  return (
    <AnchorTextButton
      key="start"
      label={
        <div
          title={address}
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 4,
          })}
        >
          <Image
            alt=""
            width={16}
            height={16}
            src={blo(address)}
            className={css({
              display: "block",
              borderRadius: 4,
            })}
          />
          {shortenAddress(address, 4).toLowerCase()}
        </div>
      }
      href={`${CHAIN_BLOCK_EXPLORER?.url}address/${address}`}
      external
    />
  );
}
