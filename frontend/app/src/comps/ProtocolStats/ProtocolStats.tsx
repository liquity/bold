"use client";

import { Amount } from "@/src/comps/Amount/Amount";
import { Logo } from "@/src/comps/Logo/Logo";
import { getContracts } from "@/src/contracts";
import { useAllPrices } from "@/src/services/Prices";
import { useTotalDeposited } from "@/src/subgraph-hooks";
import { css } from "@/styled-system/css";
import { HFlex, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";

const DISPLAYED_PRICES = ["LQTY", "BOLD", "ETH"] as const;

export function ProtocolStats() {
  const prices = useAllPrices();
  const totalDeposited = useTotalDeposited();

  const tvl = getContracts()
    .collaterals
    .map((collateral, collIndex) => {
      const price = prices[collateral.symbol];
      const deposited = totalDeposited.data?.[collIndex].totalDeposited;
      return price && deposited && dn.mul(price, deposited);
    })
    .reduce((a, b) => b ? dn.add(a ?? dn.from(0, 18), b) : a, null);

  return (
    <div
      className={css({
        display: "flex",
        width: "100%",
        padding: "0 24px",
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
        <HFlex gap={8} alignItems="center">
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
        <HFlex gap={32}>
          {DISPLAYED_PRICES.map((symbol) => {
            const price = prices[symbol];
            return (
              <HFlex
                key={symbol}
                gap={16}
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
                    value={price}
                    format="2z"
                  />
                </HFlex>
              </HFlex>
            );
          })}
        </HFlex>
      </div>
    </div>
  );
}
