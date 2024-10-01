import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { ADDRESS_ZERO } from "@/src/eth-utils";
import { fmtnum } from "@/src/formatting";
import { useCollateral } from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { usePrice } from "@/src/services/Prices";
import { vAddress, vCollIndex, vDnum } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";

const FlowIdSchema = v.literal("openLoanPosition");

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
  ownerIndex: v.number(),
  collAmount: vDnum(),
  boldAmount: vDnum(),
  upperHint: vDnum(),
  lowerHint: vDnum(),
  annualInterestRate: vDnum(),
  maxUpfrontFee: vDnum(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

type Step = "openTrove";

const stepNames: Record<Step, string> = {
  openTrove: "Open Position",
};

export const openLoanPosition: FlowDeclaration<Request, Step> = {
  title: "Review & Send Transaction",
  subtitle: "Please review your borrow position before confirming",

  Summary({ flow }) {
    const collateral = useCollateral(flow.request.collIndex);
    return collateral && (
      <LoanCard
        leverageMode={false}
        loadingState="success"
        loan={{
          troveId: "0x",
          borrowed: flow.request.boldAmount,
          collIndex: flow.request.collIndex,
          collateral: collateral.symbol,
          deposit: flow.request.collAmount,
          interestRate: flow.request.annualInterestRate,
          type: "borrow",
        }}
        onRetry={() => {}}
      />
    );
  },

  Details({ flow }) {
    const { request } = flow;
    const collateral = useCollateral(flow.request.collIndex);
    const collPrice = usePrice(collateral?.symbol ?? null);
    const boldPrice = usePrice("BOLD");
    return collateral && (
      <>
        <TransactionDetailsRow
          label="You deposit"
          value={[
            `${fmtnum(request.collAmount)} ${collateral.name}`,
            collPrice && `$${fmtnum(dn.mul(request.collAmount, collPrice))}`,
          ]}
        />
        <TransactionDetailsRow
          label="You borrow"
          value={[
            `${fmtnum(request.boldAmount)} BOLD`,
            boldPrice && `$${fmtnum(dn.mul(request.boldAmount, boldPrice))}`,
          ]}
        />
        <TransactionDetailsRow
          label="Interest rate"
          value={[
            `${fmtnum(request.annualInterestRate, 2, 100)}%`,
            `${fmtnum(dn.mul(request.boldAmount, request.annualInterestRate))} BOLD per year`,
          ]}
        />
      </>
    );
  },

  async getSteps() {
    return ["openTrove"];
  },

  getStepName(stepId) {
    return stepNames[stepId];
  },

  parseRequest(request) {
    return v.parse(RequestSchema, request);
  },

  async writeContractParams(stepId, { contracts, request }) {
    const collateral = contracts.collaterals[request.collIndex];

    // WETHZapper mode
    if (collateral.symbol === "ETH" && stepId === "openTrove") {
      return {
        ...collateral.contracts.WETHZapper,
        functionName: "openTroveWithRawETH" as const,
        args: [{
          owner: request.owner ?? ADDRESS_ZERO,
          ownerIndex: BigInt(request.ownerIndex),
          boldAmount: request.boldAmount[0],
          upperHint: request.upperHint[0],
          lowerHint: request.lowerHint[0],
          annualInterestRate: request.annualInterestRate[0],
          maxUpfrontFee: request.maxUpfrontFee[0],
          addManager: ADDRESS_ZERO,
          removeManager: ADDRESS_ZERO,
          receiver: ADDRESS_ZERO,
        }],
        value: request.collAmount[0],
      };
    }

    throw new Error("Not implemented");
  },
};
