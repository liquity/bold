import type { FlowDeclaration } from "@/src/services/TransactionFlow";

import { ADDRESS_ZERO } from "@/src/eth-utils";
import { vAddress, vDnum } from "@/src/valibot-utils";
import * as dn from "dnum";
import * as v from "valibot";
import { readContract } from "wagmi/actions";

const FlowIdSchema = v.literal("openLoanPosition");

const RequestSchema = v.object({
  flowId: FlowIdSchema,
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
    const allowance = await readContract(wagmiConfig, {
      ...contracts.CollToken,
      functionName: "allowance",
      args: [
        account.address ?? ADDRESS_ZERO,
        contracts.BorrowerOperations.address,
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
    if (stepId === "approve") {
      return {
        ...contracts.CollToken,
        functionName: "approve" as const,
        args: [
          contracts.BorrowerOperations.address,
          request.collAmount[0],
        ],
      };
    }
    if (stepId === "openTrove") {
      return {
        ...contracts.BorrowerOperations,
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
