import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { fmtnum } from "@/src/formatting";
import { useCollateral } from "@/src/liquity-utils";
import { parsePrefixedTroveId } from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { usePrice } from "@/src/services/Prices";
import { useLoanById } from "@/src/subgraph-hooks";
import { vAddress, vCollIndex, vDnum, vPrefixedTroveId } from "@/src/valibot-utils";
import * as dn from "dnum";
import { match, P } from "ts-pattern";
import * as v from "valibot";
import { readContract } from "wagmi/actions";

const FlowIdSchema = v.literal("updateLoanPosition");

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

  debtChange: vDnum(),
  collChange: vDnum(),
  collIndex: vCollIndex(),
  maxUpfrontFee: vDnum(),
  owner: vAddress(),
  prefixedTroveId: vPrefixedTroveId(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type FinalStep =
  | "adjustTrove" // update both collateral and borrowed
  | "depositBold"
  | "depositColl"
  | "withdrawBold"
  | "withdrawColl";

type Step =
  | FinalStep
  | "approveBold"
  | "approveColl";

const stepNames: Record<Step, string> = {
  approveBold: "Approve BOLD",
  approveColl: "Approve {collSymbol}",
  adjustTrove: "Update Position",
  depositBold: "Update Position",
  depositColl: "Update Position",
  withdrawBold: "Update Position",
  withdrawColl: "Update Position",
};

function getFinalStep(request: Request): FinalStep {
  const { collChange, debtChange } = request;
  if (!dn.eq(collChange, 0) && !dn.eq(debtChange, 0)) {
    return "adjustTrove";
  }
  // coll increases => deposit
  if (dn.gt(collChange, 0)) {
    return "depositColl";
  }
  // coll decreases => withdraw
  if (dn.lt(collChange, 0)) {
    return "withdrawColl";
  }
  // debt increases => withdraw BOLD (borrow)
  if (dn.gt(debtChange, 0)) {
    return "withdrawBold";
  }
  // debt decreases => deposit BOLD (repay)
  if (dn.lt(debtChange, 0)) {
    return "depositBold";
  }
  throw new Error("Invalid request");
}

export const updateLoanPosition: FlowDeclaration<Request, Step> = {
  title: "Review & Send Transaction",
  subtitle: "Please review the changes of your borrow position before confirming",
  Summary({ flow }) {
    const collateral = useCollateral(flow.request.collIndex);
    const loan = useLoanById(flow.request.prefixedTroveId);
    const { troveId } = parsePrefixedTroveId(flow.request.prefixedTroveId);
    const loadingState = match(loan)
      .returnType<LoadingState>()
      .with({ status: "error" }, () => "error")
      .with({ status: "pending" }, () => "loading")
      .with({ data: null }, () => "not-found")
      .with({ data: P.nonNullable }, () => "success")
      .otherwise(() => "error");

    if (!collateral) {
      return null;
    }

    const newDeposit = dn.add(loan.data?.deposit ?? 0n, flow.request.collChange);
    const newBorrowed = dn.add(loan.data?.borrowed ?? 0n, flow.request.debtChange);

    const newLoan = !loan.data ? null : {
      troveId,
      borrowed: newBorrowed,
      collIndex: flow.request.collIndex,
      collateral: collateral.symbol,
      deposit: newDeposit,
      interestRate: loan.data.interestRate,
      type: "borrow" as const,
    };

    const prevLoan = !newLoan || !loan.data ? null : {
      ...newLoan,
      borrowed: loan.data.borrowed,
      deposit: loan.data.deposit,
    };

    return (
      <LoanCard
        leverageMode={false}
        loadingState={loadingState}
        loan={newLoan}
        prevLoan={prevLoan}
        onRetry={() => {}}
      />
    );
  },
  Details({ flow }) {
    const { request } = flow;
    const collateral = useCollateral(flow.request.collIndex);
    const collPrice = usePrice(collateral?.symbol ?? null);
    const boldPrice = usePrice("BOLD");

    const collChangeUnsigned = dn.abs(request.collChange);
    const debtChangeUnsigned = dn.abs(request.debtChange);

    return collateral && (
      <>
        <TransactionDetailsRow
          label={dn.gt(request.collChange, 0n)
            ? "You deposit"
            : "You withdraw"}
          value={[
            <div
              title={`${fmtnum(collChangeUnsigned, "full")} ${collateral.name}`}
              style={{
                color: dn.eq(collChangeUnsigned, 0n)
                  ? "var(--colors-content-alt2)"
                  : undefined,
              }}
            >
              {fmtnum(collChangeUnsigned)} {collateral.name}
            </div>,
            collPrice && (
              <div title={fmtnum(dn.mul(collChangeUnsigned, collPrice))}>
                ${fmtnum(dn.mul(collChangeUnsigned, collPrice))}
              </div>
            ),
          ]}
        />
        <TransactionDetailsRow
          label={dn.gt(request.debtChange, 0n) ? "You borrow" : "You repay"}
          value={[
            <div
              title={`${fmtnum(debtChangeUnsigned, "full")} BOLD`}
              style={{
                color: dn.eq(debtChangeUnsigned, 0n)
                  ? "var(--colors-content-alt2)"
                  : undefined,
              }}
            >
              {fmtnum(debtChangeUnsigned)} BOLD
            </div>,
            boldPrice && (
              <div title={fmtnum(dn.mul(debtChangeUnsigned, boldPrice))}>
                ${fmtnum(dn.mul(debtChangeUnsigned, boldPrice))}
              </div>
            ),
          ]}
        />
      </>
    );
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  getStepName(stepId, { contracts, request }) {
    const name = stepNames[stepId];
    const coll = contracts.collaterals[request.collIndex];
    return name.replace(/\{collSymbol\}/g, coll.symbol);
  },

  async getSteps({ account, contracts, request, wagmiConfig }) {
    const { collIndex, debtChange } = request;
    const coll = contracts.collaterals[collIndex];

    const Controller = coll.symbol === "ETH"
      ? coll.contracts.WETHZapper
      : coll.contracts.BorrowerOperations;

    if (!account.address) {
      throw new Error("Account address is required");
    }

    const isBoldApproved = !dn.lt(debtChange, 0) || !dn.gt(dn.abs(debtChange), [
      await readContract(wagmiConfig, {
        ...contracts.BoldToken,
        functionName: "allowance",
        args: [account.address, Controller.address],
      }) ?? 0n,
      18,
    ]);

    // Collateral token needs to be approved if collChange > 0 and collToken != "ETH" (no WETHZapper)
    const isCollApproved = coll.symbol === "ETH" || !dn.gt(request.collChange, 0) || !dn.gt(request.collChange, [
      await readContract(wagmiConfig, {
        ...coll.contracts.CollToken,
        functionName: "allowance",
        args: [account.address, Controller.address],
      }) ?? 0n,
      18,
    ]);

    return [
      isBoldApproved ? null : "approveBold" as const,
      isCollApproved ? null : "approveColl" as const,
      getFinalStep(request),
    ].filter((step) => step !== null);
  },

  async writeContractParams(stepId, { account, contracts, request }) {
    const { collIndex, collChange, debtChange, maxUpfrontFee } = request;
    const collateral = contracts.collaterals[collIndex];
    const { BorrowerOperations, WETHZapper } = collateral.contracts;

    const Controller = collateral.symbol === "ETH"
      ? WETHZapper
      : BorrowerOperations;

    if (!account.address) {
      throw new Error("Account address is required");
    }

    const { troveId } = parsePrefixedTroveId(request.prefixedTroveId);

    if (stepId === "approveBold") {
      return {
        ...contracts.BoldToken,
        functionName: "approve",
        args: [
          Controller.address,
          dn.abs(debtChange)[0],
        ],
      };
    }

    if (stepId === "approveColl") {
      // TODO
      throw new Error("Not implemented");
    }

    // WETHZapper mode
    if (collateral.symbol === "ETH") {
      return match(stepId)
        .with("adjustTrove", () => ({
          ...WETHZapper,
          functionName: "adjustTroveWithRawETH",
          args: [
            troveId,
            dn.abs(collChange)[0],
            !dn.lt(collChange, 0n),
            dn.abs(debtChange)[0],
            !dn.lt(debtChange, 0n),
            maxUpfrontFee[0],
          ],
          value: collChange[0],
        }))
        .with("depositColl", () => ({
          ...WETHZapper,
          functionName: "addCollWithRawETH",
          args: [troveId],
          value: collChange[0],
        }))
        .with("withdrawColl", () => ({
          ...WETHZapper,
          functionName: "withdrawCollToRawETH",
          args: [troveId, dn.abs(collChange)[0]],
        }))
        .with("depositBold", () => ({
          ...WETHZapper,
          functionName: "repayBold",
          args: [troveId, dn.abs(debtChange)[0]],
        }))
        .with("withdrawBold", () => ({
          ...WETHZapper,
          functionName: "withdrawBold",
          args: [troveId, debtChange[0], maxUpfrontFee[0]],
        }))
        .exhaustive();
    }

    // Normal mode
    throw new Error("Not implemented");
  },
};
