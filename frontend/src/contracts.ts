import type { Address } from "@/src/types";

import { BorrowerOperations } from "@/src/abi/BorrowerOperations";
import { ERC20Faucet } from "@/src/abi/ERC20Faucet";
import { StabilityPool } from "@/src/abi/StabilityPool";
import { TroveManager } from "@/src/abi/TroveManager";
import {
  CONTRACT_BOLD_TOKEN,
  CONTRACT_BORROWER_OPERATIONS,
  CONTRACT_COLL_TOKEN,
  CONTRACT_STABILITY_POOL,
  CONTRACT_TROVE_MANAGER,
} from "@/src/env";
import { erc20Abi } from "viem";

type Contract<Abi> = {
  abi: Abi;
  address: Address;
};

export const TroveManagerContract: Contract<typeof TroveManager> = {
  abi: TroveManager,
  address: CONTRACT_TROVE_MANAGER,
};

export const BoldTokenContract: Contract<typeof erc20Abi> = {
  abi: erc20Abi,
  address: CONTRACT_BOLD_TOKEN,
};

export const CollTokenContract: Contract<typeof ERC20Faucet> = {
  abi: ERC20Faucet,
  address: CONTRACT_COLL_TOKEN,
};

export const BorrowerOperationsContract: Contract<typeof BorrowerOperations> = {
  abi: BorrowerOperations,
  address: CONTRACT_BORROWER_OPERATIONS,
};

export const StabilityPoolContract: Contract<typeof StabilityPool> = {
  abi: StabilityPool,
  address: CONTRACT_STABILITY_POOL,
};
