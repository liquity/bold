"use client";

import type { ReactNode } from "react";

import { BLOCKING_LIST, BLOCKING_VPNAPI, BLOCKING_VPNDETECTION } from "@/src/env";
import type { Address } from "@/src/types";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { useQuery } from "@tanstack/react-query";
import * as v from "valibot";
import { useReadContract } from "wagmi";

export function Blocking({
  children,
}: {
  children: ReactNode;
}) {
  const account = useAccount();
  const accountInBlockingList = useIsAccountInBlockingList(account.address ?? null);
  const accountVpnapi = useVpnapiBlock();
  const accountVpndetection = useVpndetectionBlock();
  const vpnChecks = [accountVpnapi.data, accountVpndetection.data];
  const countryBlocked = vpnChecks.find((check) => check?.isCountryBlocked);

  let blocked: {
    title: string;
    message: string;
  } | null = null;

  if (accountInBlockingList.data) {
    blocked = {
      title: "Account blocked",
      message: "This app cannot be accessed from this account.",
    };
  }

  if (vpnChecks.some((check) => check?.isRouted)) {
    blocked = {
      title: "Routed connection detected (VPN or similar)",
      message: "This app cannot be accessed from a routed connection.",
    };
  }

  if (countryBlocked) {
    blocked = {
      title: "Blocked country",
      message: `This app cannot be accessed from this country (${countryBlocked.country}).`,
    };
  }

  if (!blocked) {
    return children;
  }

  return (
    <main
      className={css({
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "background",
      })}
    >
      <p
        className={css({
          display: "flex",
          flexDirection: "column",
          width: "100%",
          maxWidth: 600,
          padding: 16,
          color: "negativeSurfaceContent",
          textAlign: "center",
          background: "negativeSurface",
          border: "1px solid token(colors.negativeSurfaceBorder)",
          borderRadius: 8,
        })}
      >
        {blocked.message}
      </p>
    </main>
  );
}

// blocking list contract
export function useIsAccountInBlockingList(account: Address | null) {
  return useReadContract({
    address: BLOCKING_LIST ?? undefined,
    abi: [{
      "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
      "name": "isBlacklisted",
      "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
      "stateMutability": "view",
      "type": "function",
    }],
    functionName: "isBlacklisted",
    args: [account ?? "0x"],
    query: {
      enabled: Boolean(account && BLOCKING_LIST),
      retry: false,
      refetchInterval: false,
    },
  });
}

// vpnapi.io blocking
const VpnapiResponseSchema = v.pipe(
  v.object({
    ip: v.string(),
    security: v.object({
      vpn: v.boolean(),
      proxy: v.boolean(),
      tor: v.boolean(),
      relay: v.boolean(),
    }),
    location: v.object({
      country_code: v.string(),
    }),
  }),
  v.transform((value) => ({
    isRouted: Object.values(value.security).some((is) => is),
    country: value.location.country_code,
  })),
);
export function useVpnapiBlock() {
  return useQuery({
    queryKey: ["vpnapi", BLOCKING_VPNAPI],
    queryFn: async () => {
      if (!BLOCKING_VPNAPI) {
        return null;
      }
      const response = await fetch(
        `https://vpnapi.io/api/?key=${BLOCKING_VPNAPI.apiKey}`,
      );
      const result = await response.json();
      const { isRouted, country } = v.parse(VpnapiResponseSchema, result);
      return {
        country,
        isCountryBlocked: BLOCKING_VPNAPI.countries.includes(country),
        isRouted,
      };
    },
    enabled: BLOCKING_VPNAPI !== null,
    retry: false,
    refetchInterval: false,
  });
}

// vpndetection.io blocking (no API key needed)
const VpndetectionResponseSchema = v.pipe(
  v.object({
    is_vpn: v.boolean(),
    is_tor: v.boolean(),
    is_relay: v.boolean(),
    location: v.optional(
      v.object({
        country: v.optional(v.string(), ""),
      }),
      {},
    ),
  }),
  v.transform((value) => ({
    isRouted: value.is_vpn || value.is_tor || value.is_relay,
    country: value.location.country,
  })),
);
export function useVpndetectionBlock() {
  return useQuery({
    queryKey: ["vpndetection", BLOCKING_VPNDETECTION],
    queryFn: async () => {
      if (!BLOCKING_VPNDETECTION) {
        return null;
      }
      const response = await fetch("https://api.vpndetection.io/myip");
      const result = await response.json();
      const { isRouted, country } = v.parse(VpndetectionResponseSchema, result);
      return {
        country,
        isCountryBlocked: BLOCKING_VPNDETECTION.countries.includes(country),
        isRouted,
      };
    },
    enabled: BLOCKING_VPNDETECTION !== null,
    retry: false,
    refetchInterval: false,
  });
}
