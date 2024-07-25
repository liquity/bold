import type { FlowDeclaration } from "@/src/services/TransactionFlow";

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
  }): Promise<["approve", "openTrove"] | ["openTrove"]> {
    const { BorrowerOperations, Token } = contracts.collaterals[request.collIndex];

    const allowance = await readContract(wagmiConfig, {
      ...Token,
      functionName: "allowance",
      args: [
        account.address ?? ADDRESS_ZERO,
        BorrowerOperations.address,
      ],
    });

    const isApproved = !dn.gt(
      request.collAmount,
      dn.from(allowance ?? 0n, 18),
    );

    return isApproved ? ["openTrove"] : ["approve", "openTrove"];
  },
  parseRequest: (request): Request => {
    return v.parse(RequestSchema, request);
  },
  writeContractParams: async ({ contracts, request, stepId }) => {
    const { BorrowerOperations, Token } = contracts.collaterals[request.collIndex];

    if (stepId === "approve") {
      return {
        ...Token,
        functionName: "approve" as const,
        args: [
          BorrowerOperations.address,
          request.collAmount[0],
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
