import type { LoadingState } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { ETH_GAS_COMPENSATION } from "@/src/constants";
import { ADDRESS_ZERO } from "@/src/eth-utils";
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

  boldChange: vDnum(),
  collChange: vDnum(),
  collIndex: vCollIndex(),
  maxUpfrontFee: vDnum(),
  owner: vAddress(),
  prefixedTroveId: vPrefixedTroveId(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step = "approve" | "adjustTrove";

const stepNames: Record<Step, string> = {
  approve: "Approve",
  adjustTrove: "Update Position",
};

export const updateLoanPosition: FlowDeclaration<Request, Step> = {
  title: "Review & Send Transaction",
  subtitle: "Please review the changes of your borrow position before confirming",
  Summary({ flow }) {
    const { symbol } = useCollateral(flow.request.collIndex);
    const loan = useLoanById(flow.request.prefixedTroveId);
    const { troveId } = parsePrefixedTroveId(flow.request.prefixedTroveId);
    const loadingState = match(loan)
      .returnType<LoadingState>()
      .with({ status: "error" }, () => "error")
      .with({ status: "pending" }, () => "loading")
      .with({ data: null }, () => "not-found")
      .with({ data: P.nonNullable }, () => "success")
      .otherwise(() => "error");

    const newDeposit = dn.add(loan.data?.deposit ?? 0n, flow.request.collChange);
    const newBorrowed = dn.add(loan.data?.borrowed ?? 0n, flow.request.boldChange);

    const newLoan = !loan.data ? null : {
      troveId,
      borrowed: newBorrowed,
      collIndex: flow.request.collIndex,
      collateral: symbol,
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
    const collPrice = usePrice(collateral.symbol);
    const boldPrice = usePrice("BOLD");

    const collChangeUnsigned = dn.abs(request.collChange);
    const boldChangeUnsigned = dn.abs(request.boldChange);

    return (
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
          label={dn.gt(request.boldChange, 0n) ? "You borrow" : "You repay"}
          value={[
            <div
              title={`${fmtnum(boldChangeUnsigned, "full")} BOLD`}
              style={{
                color: dn.eq(boldChangeUnsigned, 0n)
                  ? "var(--colors-content-alt2)"
                  : undefined,
              }}
            >
              {fmtnum(boldChangeUnsigned)} BOLD
            </div>,
            boldPrice && (
              <div title={fmtnum(dn.mul(boldChangeUnsigned, boldPrice))}>
                ${fmtnum(dn.mul(boldChangeUnsigned, boldPrice))}
              </div>
            ),
          ]}
        />
      </>
    );
  },

  getStepName(stepId) {
    return stepNames[stepId];
  },

  async getSteps({
    account,
    contracts,
    request,
    wagmiConfig,
  }) {
    // no need for approval if collateral change is negative
    if (!dn.gt(request.collChange, 0)) {
      return ["adjustTrove"];
    }

    const collateral = contracts.collaterals[request.collIndex];
    const { BorrowerOperations, Token } = collateral.contracts;

    if (!BorrowerOperations || !Token) {
      throw new Error(`Collateral ${collateral.symbol} not supported`);
    }

    const allowance = await readContract(wagmiConfig, {
      ...Token,
      functionName: "allowance",
      args: [
        account.address ?? ADDRESS_ZERO,
        BorrowerOperations.address,
      ],
    });

    const isApproved = !dn.gt(
      dn.add(request.collChange, ETH_GAS_COMPENSATION),
      [allowance ?? 0n, 18],
    );

    return isApproved ? ["adjustTrove"] : ["approve", "adjustTrove"];
  },
  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },
  async writeContractParams({ contracts, request, stepId }) {
    const collateral = contracts.collaterals[request.collIndex];
    const { BorrowerOperations, Token } = collateral.contracts;

    if (!BorrowerOperations || !Token) {
      throw new Error(`Collateral ${collateral.symbol} not supported`);
    }

    if (stepId === "approve") {
      const amount = dn.add(request.collChange, ETH_GAS_COMPENSATION);
      return {
        ...Token,
        functionName: "approve" as const,
        args: [
          BorrowerOperations.address,
          amount[0],
        ],
      };
    }

    if (stepId === "adjustTrove") {
      const { troveId } = parsePrefixedTroveId(request.prefixedTroveId);
      return {
        ...BorrowerOperations,
        functionName: "adjustTrove" as const,
        args: [
          troveId,
          dn.abs(request.collChange)[0],
          !dn.lt(request.collChange, 0n),
          dn.abs(request.boldChange)[0],
          !dn.lt(request.boldChange, 0n),
          request.maxUpfrontFee[0],
        ],
      };
    }
    return null;
  },
};
