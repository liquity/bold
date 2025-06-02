import type { Address, Dnum, PositionSbold } from "@/src/types";

import { dnum18, DNUM_0 } from "@/src/dnum-utils";
import { SBOLD } from "@/src/env";
import { getBranch, getBranchesCount, useLiquityStats } from "@/src/liquity-utils";
import { isBranchId } from "@/src/types";
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
      "function previewRedeem(uint256 shares) view returns (uint256)",
      "function previewWithdraw(uint256 assets) view returns (uint256)",
      "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
      "function sps(uint256 index) view returns (address sp, uint256 weight)",
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

function calculateSboldApr(spData: {
  weight: Dnum;
  apr: Dnum | null;
}[]) {
  let weightedAprSum = DNUM_0;
  let totalWeight = DNUM_0;
  for (const sp of spData) {
    if (!sp.apr) continue;
    weightedAprSum = dn.add(weightedAprSum, dn.mul(sp.weight, sp.apr));
    totalWeight = dn.add(totalWeight, sp.weight);
  }
  return dn.eq(totalWeight, 0)
    ? DNUM_0
    : dn.div(weightedAprSum, totalWeight);
}

export function useSboldStats() {
  const SBoldContract = getSboldContract();
  const liquityStats = useLiquityStats();

  type SpsCall = typeof SBoldContract & {
    functionName: "sps";
    args: [bigint];
  };

  // max is 9 branches so this should be fine
  type SpsCalls = [
    SpsCall,
    SpsCall,
    SpsCall,
    SpsCall,
    SpsCall,
    SpsCall,
    SpsCall,
    SpsCall,
    SpsCall,
  ];

  return useReadContracts({
    contracts: [
      { ...SBoldContract, functionName: "totalSupply" },
      { ...SBoldContract, functionName: "calcFragments" },
      ...(Array.from({ length: getBranchesCount() }, (_, index) => ({
        ...SBoldContract,
        functionName: "sps",
        args: [BigInt(index)],
      })) as SpsCalls),
    ],
    allowFailure: false,
    query: {
      enabled: Boolean(SBOLD && liquityStats.isSuccess),
      select: ([totalSupply_, [totalBold_], ...sps]) => {
        const totalSupply = dnum18(totalSupply_);
        const totalBold = dnum18(totalBold_);

        const sboldRate = totalSupply_ === 0n
          ? DNUM_0
          : dn.div(totalBold, totalSupply);

        const spAprs = sps.map(([_, weight], index) => {
          if (!isBranchId(index)) {
            throw new Error(`Invalid branch index: ${index}`);
          }
          const branch = getBranch(index);
          const statsBranch = liquityStats.data?.branch[branch.symbol];
          return {
<<<<<<< HEAD
            apr: statsBranch?.spApyAvg1d ?? null,
=======
            apr: statsBranch?.spApyAvg1d,
>>>>>>> 50a68909b27a8e2741518357e7315c52b70a1b85
            weight: dn.div(dn.from(weight, 18), 100_00), // from basis points
          };
        });

        return {
          apr: calculateSboldApr(spAprs),
          sboldRate,
          totalBold,
          weights: spAprs.map((sp) => sp.weight),
        };
      },
    },
  });
}
