// see https://eips.ethereum.org/EIPS/eip-2612

import type { Address } from "@/src/types";
import type { Config as WagmiConfig } from "wagmi";

import Erc2612 from "@/src/abi/Erc2612";
import { CHAIN_ID } from "@/src/env";
import { slice } from "viem";
import { getBlock, readContract, signTypedData } from "wagmi/actions";

export async function signPermit({
  account,
  expiresAfter = 60n * 60n * 24n, // 1 day
  spender,
  token,
  value,
  wagmiConfig,
}: {
  account: Address;
  expiresAfter?: bigint;
  spender: Address;
  token: Address;
  value: bigint;
  wagmiConfig: WagmiConfig;
}) {
  const [block, nonce, name] = await Promise.all([
    getBlock(wagmiConfig),
    readContract(wagmiConfig, {
      address: token,
      abi: Erc2612,
      functionName: "nonces",
      args: [account],
    }),
    readContract(wagmiConfig, {
      address: token,
      abi: Erc2612,
      functionName: "name",
    }),
  ]);

  const deadline = block.timestamp + expiresAfter;

  const signature = await signTypedData(wagmiConfig, {
    domain: {
      name,
      version: "1",
      chainId: CHAIN_ID,
      verifyingContract: token,
    },
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    message: {
      owner: account,
      spender,
      value,
      nonce,
      deadline,
    },
  });

  return getPermitParamsFromSignature(signature, deadline);
}

export type PermitParams = {
  deadline: bigint;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
};

// Split signature into r, s, v + attach deadline
function getPermitParamsFromSignature(
  signature: `0x${string}`,
  deadline: bigint,
): PermitParams {
  return {
    deadline,
    v: parseInt(slice(signature, 64, 65), 16),
    r: slice(signature, 0, 32),
    s: slice(signature, 32, 64),
  };
}
