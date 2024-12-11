"use client";

import type { TokenSymbol } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { Logo } from "@/src/comps/Logo/Logo";
import { getContracts } from "@/src/contracts";
import { useAccount } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useTotalDeposited } from "@/src/subgraph-hooks";
import { css } from "@/styled-system/css";
import { AnchorTextButton, HFlex, shortenAddress, TokenIcon } from "@liquity2/uikit";
import { blo } from "blo";
import * as dn from "dnum";
import Image from "next/image";

const DISPLAYED_PRICES = ["LQTY", "BOLD", "ETH"] as const;

export function ProtocolStats() {
  const account = useAccount();
  const tvl = useTvl();
  return (
    <div
      className={css({
        display: "flex",
        width: "100%",
      })}
    >
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
          height: 48,
          fontSize: 12,
          borderTop: "1px solid token(colors.tableBorder)",
          userSelect: "none",
        })}
      >
        <HFlex gap={4} alignItems="center">
          <Logo size={16} />
          <span>TVL</span>{" "}
          <span>
            <Amount
              fallback="…"
              format="compact"
              prefix="$"
              value={tvl}
            />
          </span>
        </HFlex>
        <HFlex gap={16}>
          {DISPLAYED_PRICES.map((symbol) => (
            <Price
              key={symbol}
              symbol={symbol}
            />
          ))}
          {account.address && (
            <AnchorTextButton
              id="footer-account-button"
              href={`/account?address=${account.address}`}
              label={
                <HFlex gap={4} alignItems="center">
                  <Image
                    alt=""
                    width={16}
                    height={16}
                    src={blo(account.address)}
                    className={css({
                      borderRadius: "50%",
                    })}
                  />

                  <HFlex gap={8}>
                    <span>{shortenAddress(account.address, 3)}</span>
                  </HFlex>
                </HFlex>
              }
              className={css({
                color: "content",
              })}
            />
          )}
        </HFlex>
      </div>
    </div>
  );
}

function Price({ symbol }: { symbol: TokenSymbol }) {
  const price = usePrice(symbol);
  return (
    <HFlex
      key={symbol}
      gap={4}
    >
      <TokenIcon
        size={16}
        symbol={symbol}
      />
      <HFlex gap={8}>
        <span>{symbol}</span>
        <Amount
          prefix="$"
          fallback="…"
          value={price.data}
          format="2z"
        />
      </HFlex>
    </HFlex>
  );
}

function useTvl() {
  const { collaterals } = getContracts();
  const totalDeposited = useTotalDeposited();
  const collPrices = Object.fromEntries(collaterals.map((collateral) => (
    [collateral.symbol, usePrice(collateral.symbol)] as const
  ))) as Record<TokenSymbol, ReturnType<typeof usePrice>>;

  // make sure all prices and the total deposited have loaded before calculating the TVL
  if (
    !Object.values(collPrices).every((cp) => cp.status === "success")
    || totalDeposited.status !== "success"
  ) {
    return null;
  }

  const tvlByCollateral = collaterals.map((collateral, collIndex) => {
    const price = collPrices[collateral.symbol].data;
    return price && dn.mul(
      price,
      totalDeposited.data[collIndex].totalDeposited,
    );
  });

  let tvl = dn.from(0, 18);
  for (const value of tvlByCollateral ?? []) {
    tvl = value ? dn.add(tvl, value) : tvl;
  }

  return tvl;
}
