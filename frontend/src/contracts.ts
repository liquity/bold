import type { Address } from "@/src/types";

import { BoldToken } from "@/src/abi/BoldToken";
import { BorrowerOperations } from "@/src/abi/BorrowerOperations";
import { StabilityPool } from "@/src/abi/StabilityPool";
import { TroveManager } from "@/src/abi/TroveManager";
import {
  CONTRACT_BOLD_TOKEN,
  CONTRACT_BORROWER_OPERATIONS,
  CONTRACT_STABILITY_POOL,
  CONTRACT_TROVE_MANAGER,
} from "@/src/env";

type Contract<Abi> = {
  abi: Abi;
  address: Address;
};

export const TroveManagerContract: Contract<typeof TroveManager> = {
  abi: TroveManager,
  address: CONTRACT_TROVE_MANAGER,
};

export const BoldTokenContract: Contract<typeof BoldToken> = {
  abi: BoldToken,
  address: CONTRACT_BOLD_TOKEN,
};

export const BorrowerOperationsContract: Contract<typeof BorrowerOperations> = {
  abi: BorrowerOperations,
  address: CONTRACT_BORROWER_OPERATIONS,
};

export const StabilityPoolContract: Contract<typeof StabilityPool> = {
  abi: StabilityPool,
  address: CONTRACT_STABILITY_POOL,
};
