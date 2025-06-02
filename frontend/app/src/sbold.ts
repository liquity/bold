import type { Address, Dnum, PositionSbold } from "@/src/types";

import { dnum18, DNUM_0 } from "@/src/dnum-utils";
import { SBOLD } from "@/src/env";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
import { erc20Abi, parseAbi, zeroAddress } from "viem";
import { useConfig as useWagmiConfig, useReadContracts } from "wagmi";
import { readContract } from "wagmi/actions";

// if the fee is below this % of the deposit, we consider it negligible
const NEGLIGIBLE_FEE_THRESHOLD = 0.0001; // 0.01%

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
      "function previewRedeem(uint256 shares) view returns (uint256)",
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
  const config = useWagmiConfig();
  return useQuery({
    queryKey: ["sbold", "previewDeposit", String(bold?.[0])],
    queryFn: async () => {
      if (!bold || bold[0] === 0n) {
        return null;
      }

      const [bold_] = bold;

      const sboldFromDeposit = await readContract(config, {
        ...SboldContract,
        functionName: "previewDeposit",
        args: [bold_],
      });

      const boldMinusFee = await readContract(config, {
        ...SboldContract,
        functionName: "convertToAssets",
        args: [sboldFromDeposit],
      });

      const boldFee = dnum18(bold_ - boldMinusFee);
      const sbold = dnum18(sboldFromDeposit);
      const isFeeNegligible = dn.lt(
        dn.div(boldFee, bold),
        NEGLIGIBLE_FEE_THRESHOLD,
      );

      return { bold, boldFee, isFeeNegligible, sbold };
    },
  });
}

export function usePreviewRedeem(sbold: Dnum | null) {
  const SboldContract = getSboldContract();
  const config = useWagmiConfig();
  return useQuery({
    queryKey: ["sbold", "previewRedeem", String(sbold?.[0])],
    queryFn: async () => {
      if (!sbold || sbold[0] === 0n) {
        return null;
      }
      return dnum18(
        await readContract(config, {
          ...SboldContract,
          functionName: "previewRedeem",
          args: [sbold[0]],
        }),
      );
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
