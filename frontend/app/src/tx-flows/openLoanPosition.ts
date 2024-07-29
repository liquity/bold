import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { ETH_GAS_COMPENSATION } from "@/src/constants";
import { getCollateralContracts } from "@/src/contracts";
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
    const collSymbol = contracts.collaterals[request.collIndex][0];
    const { BorrowerOperations, Token } = getCollateralContracts(collSymbol, contracts.collaterals) ?? {};

    if (!BorrowerOperations || !Token) {
      throw new Error(`Collateral ${collSymbol} not supported`);
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
      dn.add(request.collAmount, ETH_GAS_COMPENSATION),
      [allowance ?? 0n, 18],
    );

    return isApproved ? ["openTrove"] : ["approve", "openTrove"];
  },
  parseRequest: (request): Request => {
    return v.parse(RequestSchema, request);
  },
  writeContractParams: async ({ contracts, request, stepId }) => {
    const collSymbol = contracts.collaterals[request.collIndex][0];
    const { BorrowerOperations, Token } = getCollateralContracts(collSymbol, contracts.collaterals) ?? {};

    if (!BorrowerOperations || !Token) {
      throw new Error(`Collateral ${collSymbol} not supported`);
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
        ],
      };
    }
    return null;
  },
};
