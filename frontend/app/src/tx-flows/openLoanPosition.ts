import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { ETH_GAS_COMPENSATION } from "@/src/constants";
import { dnum18 } from "@/src/dnum-utils";
import { ADDRESS_ZERO } from "@/src/eth-utils";
import { vAddress, vDnum } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { readContract } from "wagmi/actions";

const FlowIdSchema = v.literal("openLoanPosition");

const RequestSchema = v.object({
  flowId: FlowIdSchema,
  collIndex: v.number(),
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

export const openLoanPosition: FlowDeclaration<Request> = {
  getSteps: async function getSteps({
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

    const steps = ["openTrove"];

    if (!isApproved) {
      steps.unshift("approve");
    }

    if (wethBalance && dn.lt(wethBalance, request.collAmount)) {
      steps.unshift("wrapEth");
    }

    return steps;
  },
  parseRequest: (request): Request => {
    return v.parse(RequestSchema, request);
  },
  writeContractParams: async ({ contracts, request, stepId }) => {
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
