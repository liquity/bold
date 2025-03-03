"use client";

import type { Address } from "@liquity2/uikit";

import { Governance } from "@/src/abi/Governance";
import { StabilityPool } from "@/src/abi/StabilityPool";
import { TroveNFT } from "@/src/abi/TroveNFT";
import { DATA_REFRESH_INTERVAL, LEGACY_CHECK } from "@/src/constants";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { AnchorTextButton, IconChevronSmallUp, IconWarning } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useReadContract, useReadContracts } from "wagmi";

export const LAYOUT_WIDTH = 1092;

export function LegacyPositionsBanner() {
  const account = useAccount();
  const hasAnyLegacyPosition = useHasAnyLegacyPosition(account.address ?? null);

  const showTransition = useTransition(
    hasAnyLegacyPosition.data?.any === true,
    {
      from: { marginTop: -41 },
      enter: { marginTop: 0 },
      leave: { marginTop: -41 },
      config: {
        mass: 1,
        tension: 2000,
        friction: 160,
      },
    },
  );

  return showTransition((style, show) => (
    show && (
      <a.div style={style}>
        <div
          className={css({
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            maxWidth: "100%",
            width: "100%",
            height: 41,
            padding: "0 16px",
            textAlign: "center",
            color: "#fff",
            background: "strongSurface",
            borderBottom: "1px solid #fff",
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              maxWidth: LAYOUT_WIDTH,
              whiteSpace: "nowrap",
              color: "yellow:400",
            })}
          >
            <IconWarning size={16} />
            <div>
              You still have open positions on Liquity V2-Legacy.{" "}
              <Link
                href="https://www.liquity.org/"
                passHref
                legacyBehavior
              >
                <AnchorTextButton
                  external
                  label={
                    <div
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      })}
                    >
                      <div>Go to legacy frontends</div>
                      <div
                        className={css({
                          transformOrigin: "50% 50%",
                          transform: "translateY(1px) rotate(90deg)",
                        })}
                      >
                        <IconChevronSmallUp size={12} />
                      </div>
                    </div>
                  }
                  className={css({
                    color: "yellow:400",
                    textDecoration: "underline",
                  })}
                />
              </Link>
            </div>
          </div>
        </div>
      </a.div>
    )
  ));
}

function useHasAnyLegacyPosition(account: Address | null) {
  const hasAnyLegacyTrove = useReadContracts({
    contracts: LEGACY_CHECK?.TROVE_NFT_CONTRACTS.map((address) => ({
      abi: TroveNFT,
      address,
      functionName: "balanceOf" as const,
      args: [account],
    })),
    allowFailure: false,
    query: {
      enabled: Boolean(account && LEGACY_CHECK),
      refetchInterval: DATA_REFRESH_INTERVAL,
      select: (balances) => balances.some((balance) => balance > 0n),
    },
  });

  const hasAnySpDeposit = useReadContracts({
    contracts: LEGACY_CHECK?.STABILITY_POOL_CONTRACTS.map((address) => ({
      abi: StabilityPool,
      address,
      functionName: "getCompoundedBoldDeposit" as const,
      args: [account],
    })),
    allowFailure: false,
    query: {
      enabled: Boolean(account && LEGACY_CHECK),
      refetchInterval: DATA_REFRESH_INTERVAL,
      select: (deposits) => deposits.some((deposit) => deposit > 0n),
    },
  });

  const hasAnyStakedLqty = useReadContract({
    abi: Governance,
    address: LEGACY_CHECK?.GOVERNANCE_CONTRACT,
    functionName: "userStates" as const,
    args: [account ?? "0x"],
    query: {
      enabled: Boolean(account && LEGACY_CHECK),
      refetchInterval: DATA_REFRESH_INTERVAL,
      select: ([
        unallocatedLQTY,
        _unallocatedOffset,
        allocatedLQTY,
        _allocatedOffset,
      ]) => (
        unallocatedLQTY > 0n || allocatedLQTY > 0n
      ),
    },
  });

  return useQuery({
    queryKey: ["hasAnyLegacyPosition", account],
    queryFn: () => {
      const earn = hasAnySpDeposit.data ?? false;
      const loan = hasAnyLegacyTrove.data ?? false;
      const stake = hasAnyStakedLqty.data ?? false;
      return { earn, loan, stake, any: earn || loan || stake };
    },
    refetchInterval: DATA_REFRESH_INTERVAL,
    enabled: Boolean(
      account
        && LEGACY_CHECK
        && hasAnyLegacyTrove.isSuccess
        && hasAnySpDeposit.isSuccess
        && hasAnyStakedLqty.isSuccess,
    ),
  });
}
