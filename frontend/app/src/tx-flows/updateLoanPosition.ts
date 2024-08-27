import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { ETH_GAS_COMPENSATION } from "@/src/constants";
import { getCollateralContracts } from "@/src/contracts";
import { ADDRESS_ZERO } from "@/src/eth-utils";
import { getTroveId } from "@/src/liquity-utils";
import { vAddress, vDnum } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { readContract } from "wagmi/actions";

const FlowIdSchema = v.literal("updateLoanPosition");

const RequestSchema = v.object({
  flowId: FlowIdSchema,
  collIndex: v.number(),
  owner: vAddress(),
  ownerIndex: v.number(),
  collChange: vDnum(),
  boldChange: vDnum(),
  maxUpfrontFee: vDnum(),
});

export type Request = v.InferOutput<typeof RequestSchema>;

export const updateLoanPosition: FlowDeclaration<Request> = {
  getSteps: async function getSteps({
    account,
    contracts,
    request,
    wagmiConfig,
  }) {
    // no need for approval if collateral change is negative
    if (!dn.gt(request.collChange, 0)) {
      return ["adjustTrove"];
    }

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
      dn.add(request.collChange, ETH_GAS_COMPENSATION),
      [allowance ?? 0n, 18],
    );

    return isApproved ? ["adjustTrove"] : ["approve", "adjustTrove"];
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
      const troveId = getTroveId(request.owner, request.ownerIndex);
      return {
        ...BorrowerOperations,
        functionName: "adjustTrove" as const,
        args: [
          troveId,
          request.collChange[0],
          !dn.lt(request.collChange, 0n),
          request.boldChange[0],
          !dn.lt(request.boldChange, 0n),
          request.maxUpfrontFee[0],
        ],
      };
    }
    return null;
  },
};
