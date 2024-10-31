import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { dnum18 } from "@/src/dnum-utils";
import { CHAIN_BLOCK_EXPLORER } from "@/src/env";
import { fmtnum } from "@/src/formatting";
import { parsePrefixedTroveId, usePredictAdjustInterestRateUpfrontFee } from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { useLoanById } from "@/src/subgraph-hooks";
import { vAddress, vCollIndex, vDnum, vPrefixedTroveId } from "@/src/valibot-utils";
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

  prefixedTroveId: vPrefixedTroveId(),
  collIndex: vCollIndex(),
  owner: vAddress(),
  upperHint: vDnum(),
  lowerHint: vDnum(),
  annualInterestRate: vDnum(),
  maxUpfrontFee: vDnum(),
  interestRateDelegate: v.union([
    v.null(),
    v.tuple([
      vAddress(), // delegate
      vDnum(), // min interest rate
      vDnum(), // max interest rate
    ]),
  ]),
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

    const troveId = parsePrefixedTroveId(request.prefixedTroveId).troveId;

    const loan = useLoanById(request.prefixedTroveId);

    const loadingState = match(loan)
      .returnType<LoadingState>()
      .with({ status: "error" }, () => "error")
      .with({ status: "pending" }, () => "loading")
      .with({ data: null }, () => "not-found")
      .with({ data: P.nonNullable }, () => "success")
      .otherwise(() => "error");

    const upfrontFee = usePredictAdjustInterestRateUpfrontFee(
      request.collIndex,
      troveId,
      request.interestRateDelegate?.[0] ?? request.annualInterestRate,
      loan.data?.batchManager !== null,
    );

    const borrowedWithFee = upfrontFee.data && loan.data?.borrowed && dn.add(
      loan.data.borrowed,
      upfrontFee.data,
    );

    return (
      <LoanCard
        leverageMode={false}
        loadingState={loadingState}
        loan={!loan.data ? null : {
          ...loan.data,
          borrowed: borrowedWithFee ?? dnum18(0),
          interestRate: request.annualInterestRate,
          batchManager: request.interestRateDelegate?.[0] ?? null,
        }}
        prevLoan={loan.data}
        onRetry={() => {}}
        txPreviewMode
      />
    );
  },
  Details({ flow }) {
    const { request } = flow;

    const loan = useLoanById(flow.request.prefixedTroveId);
    const boldPerYear = dn.mul(loan.data?.borrowed ?? 0n, request.annualInterestRate);

    return request.interestRateDelegate
      ? (
        <TransactionDetailsRow
          label="Interest rate delegate"
          value={[
            <AnchorTextButton
              key="start"
              label={
                <div
                  title={request.interestRateDelegate[0]}
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
                    src={blo(request.interestRateDelegate[0])}
                    className={css({
                      display: "block",
                      borderRadius: 4,
                    })}
                  />
                  {shortenAddress(request.interestRateDelegate[0], 4).toLowerCase()}
                </div>
              }
              href={`${CHAIN_BLOCK_EXPLORER?.url}address/${request.interestRateDelegate[0]}`}
              external
            />,
            <div key="end">
              {fmtnum(request.annualInterestRate, "full", 100)}% (~{fmtnum(boldPerYear, 4)} BOLD per year)
            </div>,
          ]}
        />
      )
      : (
        <TransactionDetailsRow
          label="Interest rate"
          value={[
            <div key="start">
              {fmtnum(request.annualInterestRate, "full", 100)}%
            </div>,
            <div
              key="end"
              title={`${fmtnum(boldPerYear, "full")} BOLD per year`}
            >
              ~{fmtnum(boldPerYear, 4)} BOLD per year
            </div>,
          ]}
        />
      );
  },
  async getSteps({ request, contracts, wagmiConfig }) {
    const collateral = contracts.collaterals[request.collIndex];
    const { troveId } = parsePrefixedTroveId(request.prefixedTroveId);

    if (request.interestRateDelegate) {
      return ["setInterestBatchManager"];
    }

    const isInBatch = (await readContract(wagmiConfig, {
      ...collateral.contracts.BorrowerOperations,
      functionName: "interestBatchManagerOf",
      args: [BigInt(troveId)],
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
    const collateral = contracts.collaterals[request.collIndex];
    const { BorrowerOperations } = collateral.contracts;

    if (!BorrowerOperations) {
      throw new Error(`Collateral ${collateral.symbol} not supported`);
    }

    const { troveId } = parsePrefixedTroveId(request.prefixedTroveId);

    if (stepId === "adjustInterestRate") {
      return {
        ...BorrowerOperations,
        functionName: "adjustTroveInterestRate" as const,
        args: [
          troveId,
          request.annualInterestRate[0],
          request.upperHint[0],
          request.lowerHint[0],
          request.maxUpfrontFee[0],
        ],
      };
    }

    if (stepId === "unsetInterestBatchManager") {
      return {
        ...BorrowerOperations,
        functionName: "removeFromBatch" as const,
        args: [
          troveId,
          request.annualInterestRate[0],
          request.upperHint[0],
          request.lowerHint[0],
          maxUint256,
        ],
      };
    }

    if (stepId === "setInterestBatchManager") {
      if (!request.interestRateDelegate) {
        throw new Error("Invalid state");
      }

      return {
        ...BorrowerOperations,
        functionName: "setInterestBatchManager" as const,
        args: [
          BigInt(troveId),
          request.interestRateDelegate[0],
          request.interestRateDelegate[1][0],
          request.interestRateDelegate[2][0],
          maxUint256,
        ],
      };
    }

    return null;
  },
};
