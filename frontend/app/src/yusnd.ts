import type { Address, Dnum, PositionYusnd } from "@/src/types";

import { dnum18, DNUM_0 } from "@/src/dnum-utils";
import { CONTRACT_YUSND } from "@/src/env";
import { getBranch, useLiquityStats } from "@/src/liquity-utils";
import { isCollIndex } from "@/src/types";
import { useQuery } from "@tanstack/react-query";
import * as dn from "dnum";
import { erc20Abi, zeroAddress } from "viem";
import { useConfig as useWagmiConfig, useReadContracts } from "wagmi";
import { readContract } from "wagmi/actions";
import { YearnV3Vault } from "./abi/YearnV3Vault";
import { useStabilityPoolWeights } from "./services/LandingPageStats";

// if the fee is below this % of the deposit, we consider it negligible
const NEGLIGIBLE_FEE_THRESHOLD = 0.0001; // 0.01%

// TODO: Replace with YearnV3Vault ABI
export const YusndContract = {
  abi: [
    ...erc20Abi,
    ...YearnV3Vault,
    // ...parseAbi([
    //   "function calcFragments() view returns (uint256, uint256, uint256, uint256)",
    //   "function convertToAssets(uint256 shares) view returns (uint256)",
    //   "function deposit(uint256 assets, address receiver) returns (uint256)",
    //   "function getSBoldRate() view returns (uint256)",
    //   "function maxWithdraw(address owner) view returns (uint256)",
    //   "function previewDeposit(uint256 assets) view returns (uint256)",
    //   "function previewRedeem(uint256 shares) view returns (uint256)",
    //   "function previewWithdraw(uint256 assets) view returns (uint256)",
    //   "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
    //   "function sps(uint256 index) view returns (address sp, uint256 weight)",
    //   "function withdraw(uint256 assets, address receiver, address owner) returns (uint256)",
    // ]),
  ] as const,
  address: CONTRACT_YUSND ?? zeroAddress,
};

export function isYusndEnabled() {
  return Boolean(CONTRACT_YUSND);
}

export function useYusndPosition(address: Address | null) {
  return useReadContracts({
    contracts: [{
      ...YusndContract,
      functionName: "balanceOf",
      args: [address ?? zeroAddress],
    }, {
      ...YusndContract,
      functionName: "maxWithdraw",
      args: [address ?? zeroAddress],
    }],
    query: {
      enabled: Boolean(isYusndEnabled() && address),
      select: ([balance, maxWithdraw]): PositionYusnd => {
        if (!address) {
          throw new Error(); // should never happen (see enabled)
        }
        return {
          type: "yusnd",
          usnd: dnum18(maxWithdraw as bigint),
          owner: address,
          yusnd: dnum18(balance as bigint),
        };
      },
      initialData: [0n, 0n],
    },
    allowFailure: false,
  });
}

export function usePreviewDeposit(bold: Dnum | null) {
  const config = useWagmiConfig();
  return useQuery({
    queryKey: ["yusnd", "previewDeposit", String(bold?.[0])],
    queryFn: async () => {
      if (!bold || bold[0] === 0n) {
        return null;
      }

      const [bold_] = bold;

      const yusndFromDeposit = await readContract(config, {
        ...YusndContract,
        functionName: "previewDeposit",
        args: [bold_],
      }) as bigint;

      const boldMinusFee = await readContract(config, {
        ...YusndContract,
        functionName: "convertToAssets",
        args: [yusndFromDeposit],
      }) as bigint;

      const boldFee = dnum18(bold_ - boldMinusFee);
      const yusnd = dnum18(yusndFromDeposit);
      const isFeeNegligible = dn.lt(
        dn.div(boldFee, bold),
        NEGLIGIBLE_FEE_THRESHOLD,
      );

      return { bold, boldFee, isFeeNegligible, yusnd };
    },
  });
}

export function usePreviewRedeem(yusnd: Dnum | null) {
  const config = useWagmiConfig();
  return useQuery({
    queryKey: ["yusnd", "previewRedeem", String(yusnd?.[0])],
    queryFn: async () => {
      if (!yusnd || yusnd[0] === 0n) {
        return null;
      }
      return dnum18(
        await readContract(config, {
          ...YusndContract,
          functionName: "previewRedeem",
          args: [yusnd[0]],
        }) as bigint,
      );
    },
  });
}

function calculateYusndApr(spData: Array<[apr: Dnum | null, weight: Dnum]>) {
  let weightedAprSum = DNUM_0;
  let totalWeight = DNUM_0;
  for (const [apr, weight] of spData) {
    if (!apr) continue;
    weightedAprSum = dn.add(weightedAprSum, dn.mul(weight, apr));
    totalWeight = dn.add(totalWeight, weight);
  }
  return dn.eq(totalWeight, 0)
    ? DNUM_0
    : dn.div(weightedAprSum, totalWeight);
}

export function useYusndStats() {
  const liquityStats = useLiquityStats();
  const weights = useStabilityPoolWeights();

  // type SpsCall = typeof YusndContract & {
  //   functionName: "sps";
  //   args: [bigint];
  // };

  // max is 9 branches so this should be fine
  // type SpsCalls = [
  //   SpsCall,
  //   SpsCall,
  //   SpsCall,
  //   SpsCall,
  //   SpsCall,
  //   SpsCall,
  //   SpsCall,
  //   SpsCall,
  //   SpsCall,
  // ];

  return useReadContracts({
    contracts: [
      { ...YusndContract, functionName: "totalSupply" },
      // { ...YusndContract, functionName: "calcFragments" },
      { ...YusndContract, functionName: "totalDebt" },
      // ...(Array.from({ length: getCollateralCount() }, (_, index) => ({
      //   ...YusndContract,
      //   functionName: "sps",
      //   args: [BigInt(index)],
      // })) as SpsCalls),
    ],
    allowFailure: false,
    query: {
      enabled: isYusndEnabled() && liquityStats.isSuccess,
      select: ([
        totalSupply_, 
        // [totalBold_], 
        totalUsnd_,
        // ...sps
      ]) => {
        const totalSupply = dnum18(totalSupply_ as bigint);
        const totalUsnd = dnum18(totalUsnd_ as bigint);

        const yusndRate = totalSupply_ === 0n
          ? DNUM_0
          : dn.div(totalUsnd, totalSupply);

        const spAprs = weights.data?.map((weight: Dnum, index: number) => {
          if (!isCollIndex(index)) {
            throw new Error(`Invalid branch index: ${index}`);
          }
          const branch = getBranch(index);
          const statsBranch = liquityStats.data?.branch[branch.symbol];
          return {
            apr: statsBranch?.spApyAvg1d ?? null,
            apr7d: statsBranch?.spApyAvg7d ?? null,
            // weight: dn.div(dn.from(weight, 18), 100_00), // from basis points
            weight: dn.div(weight, 100_00),
          };
        });
        return {
          apr: calculateYusndApr(spAprs?.map((sp) => [sp.apr, sp.weight]) ?? []),
          apr7d: calculateYusndApr(spAprs?.map((sp) => [sp.apr7d, sp.weight]) ?? []),
          yusndRate,
          totalUsnd,
          weights: spAprs?.map((sp) => sp.weight) ?? [],
        };
      },
    },
  });
}
