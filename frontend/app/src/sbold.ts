import type { Address, Dnum, PositionSbold } from "@/src/types";

import { dnum18, DNUM_0 } from "@/src/dnum-utils";
import { SBOLD } from "@/src/env";
import * as dn from "dnum";
import { erc20Abi, parseAbi, zeroAddress } from "viem";
import { useReadContract, useReadContracts } from "wagmi";

const SboldContract = !SBOLD ? null : {
  abi: [
    ...erc20Abi,
    ...parseAbi([
      "function calcFragments() view returns (uint256, uint256, uint256, uint256)",
      "function convertToAssets(uint256 shares) view returns (uint256)",
      "function deposit(uint256 assets, address receiver) returns (uint256)",
      "function getSBoldRate() view returns (uint256)",
      "function maxWithdraw(address owner) view returns (uint256)",
      "function previewDeposit(uint256 assets) view returns (uint256)",
      "function previewWithdraw(uint256 assets) view returns (uint256)",
      "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
      "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
    ]),
  ] as const,
  address: SBOLD,
};

export function getSboldContract() {
  if (!SboldContract) {
    throw new Error("SBOLD contract address is not defined");
  }
  return SboldContract;
}

export function isSboldEnabled() {
  return Boolean(SBOLD);
}

export function useSboldPosition(address: Address | null) {
  const SboldContract = getSboldContract();
  return useReadContracts({
    contracts: [{
      ...SboldContract,
      functionName: "balanceOf",
      args: [address ?? zeroAddress],
    }, {
      ...SboldContract,
      functionName: "maxWithdraw",
      args: [address ?? zeroAddress],
    }],
    query: {
      enabled: Boolean(SBOLD && address),
      select: ([balance, maxWithdraw]): PositionSbold => {
        if (!address) {
          throw new Error(); // should never happen (see enabled)
        }
        return {
          type: "sbold",
          bold: dnum18(maxWithdraw),
          owner: address,
          sbold: dnum18(balance),
        };
      },
    },
    allowFailure: false,
  });
}

export function usePreviewDeposit(bold: Dnum | null) {
  const SboldContract = getSboldContract();

  const sboldFromDeposit = useReadContract({
    ...SboldContract,
    functionName: "previewDeposit",
    args: [bold?.[0] ?? 0n],
    query: {
      enabled: Boolean(bold),
    },
  });

  return useReadContract({
    ...SboldContract,
    functionName: "convertToAssets",
    args: [sboldFromDeposit.data ?? 0n],
    query: {
      enabled: Boolean(bold) && sboldFromDeposit.data !== undefined,
      select: (boldMinusFee_) => {
        if (!bold || sboldFromDeposit.data === undefined) {
          return undefined;
        }
        return {
          boldFee: dnum18(bold[0] - boldMinusFee_),
          boldMinusFee: dnum18(boldMinusFee_),
          sbold: dnum18(sboldFromDeposit.data),
        };
      },
    },
  });
}

export function usePreviewWithdrawal(bold: Dnum | null) {
  const SboldContract = getSboldContract();
  const sboldFromWithdraw = useReadContract({
    ...SboldContract,
    functionName: "previewWithdraw",
    args: [bold?.[0] ?? 0n],
    query: {
      enabled: Boolean(bold),
    },
  });
  return useReadContract({
    ...SboldContract,
    functionName: "convertToAssets",
    args: [sboldFromWithdraw.data ?? 0n],
    query: {
      enabled: Boolean(bold) && sboldFromWithdraw.data !== undefined,
      select: (boldFromShares_) => {
        if (!bold || sboldFromWithdraw.data === undefined) {
          return undefined;
        }
        const boldFromShares = dnum18(boldFromShares_);
        return {
          boldFee: DNUM_0, // no fees on withdrawal
          boldMinusFee: boldFromShares,
          sbold: dnum18(sboldFromWithdraw.data),
        };
      },
    },
  });
}

export function useSboldStats() {
  const SBoldContract = getSboldContract();
  return useReadContracts({
    contracts: [{
      ...SBoldContract,
      functionName: "totalSupply",
    }, {
      ...SBoldContract,
      functionName: "calcFragments",
    }],
    allowFailure: false,
    query: {
      enabled: Boolean(SBOLD),
      select: ([totalSupply_, [totalBold_]]) => {
        const totalSupply = dnum18(totalSupply_);
        const totalBold = dnum18(totalBold_);

        const sboldRate = totalSupply_ === 0n
          ? DNUM_0
          : dn.div(totalBold, totalSupply);

        return {
          sboldRate,
          totalBold,
        };
      },
    },
  });
}
