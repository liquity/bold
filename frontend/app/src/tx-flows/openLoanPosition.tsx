import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { ETH_GAS_COMPENSATION } from "@/src/constants";
import { dnum18 } from "@/src/dnum-utils";
import { ADDRESS_ZERO } from "@/src/eth-utils";
import { fmtnum } from "@/src/formatting";
import { useCollateral } from "@/src/liquity-utils";
import { LoanCard } from "@/src/screens/TransactionsScreen/LoanCard";
import { TransactionDetailsRow } from "@/src/screens/TransactionsScreen/TransactionsScreen";
import { usePrice } from "@/src/services/Prices";
import { vAddress, vCollIndex, vDnum } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { readContract } from "wagmi/actions";

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

type Step = "wrapEth" | "approve" | "openTrove";

const stepNames: Record<Step, string> = {
  wrapEth: "Wrap ETH",
  approve: "Approve",
  openTrove: "Open Position",
};

export const openLoanPosition: FlowDeclaration<Request, Step> = {
  title: "Review & Send Transaction",
  subtitle: "Please review your borrow position before confirming",

  Summary({ flow }) {
    const { symbol } = useCollateral(flow.request.collIndex);
    return (
      <LoanCard
        leverageMode={false}
        loadingState="success"
        loan={{
          troveId: "0x",
          borrowed: flow.request.boldAmount,
          collIndex: flow.request.collIndex,
          collateral: symbol,
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
    const collPrice = usePrice(collateral.symbol);
    const boldPrice = usePrice("BOLD");
    return (
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

  async getSteps({
    account,
    contracts,
    request,
    wagmiConfig,
  }) {
    const collateral = contracts.collaterals[request.collIndex];
    const { BorrowerOperations, Token } = collateral.contracts;

    if (!BorrowerOperations || !Token) {
      throw new Error(`Collateral ${collateral.symbol} not supported`);
    }

    const allowance = dnum18(
      await readContract(wagmiConfig, {
        ...Token,
        functionName: "allowance",
        args: [
          account.address ?? ADDRESS_ZERO,
          BorrowerOperations.address,
        ],
      }),
    );

    const wethBalance = collateral.symbol !== "ETH" ? null : dnum18(
      await readContract(wagmiConfig, {
        ...Token,
        functionName: "balanceOf",
        args: [account.address ?? ADDRESS_ZERO],
      }),
    );

    const isApproved = !dn.gt(
      dn.add(request.collAmount, ETH_GAS_COMPENSATION),
      allowance,
    );

    const steps: Step[] = [];

    if (wethBalance && dn.lt(wethBalance, request.collAmount)) {
      steps.push("wrapEth");
    }

    if (!isApproved) {
      steps.push("approve");
    }

    return [...steps, "openTrove"];
  },

  getStepName(stepId) {
    return stepNames[stepId];
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

    if (stepId === "wrapEth") {
      return {
        ...contracts.WETH,
        functionName: "deposit" as const,
        args: [],
        value: request.collAmount[0],
      };
    }

    if (stepId === "approve") {
      const amount = dn.add(request.collAmount, ETH_GAS_COMPENSATION);
      return {
        ...Token,
        functionName: "approve" as const,
        args: [
          BorrowerOperations.address,
          amount[0],
        ],
      };
    }

    if (stepId === "openTrove") {
      return {
        ...BorrowerOperations,
        functionName: "openTrove" as const,
        args: [
          request.owner ?? ADDRESS_ZERO,
          request.ownerIndex,
          request.collAmount[0],
          request.boldAmount[0],
          request.upperHint[0],
          request.lowerHint[0],
          request.annualInterestRate[0],
          request.maxUpfrontFee[0],
          ADDRESS_ZERO,
          ADDRESS_ZERO,
          ADDRESS_ZERO,
        ],
      };
    }
    return null;
  },
};
