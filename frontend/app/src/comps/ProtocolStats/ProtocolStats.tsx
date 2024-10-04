"use client";

import { Logo } from "@/src/comps/Logo/Logo";
import { BORROW_STATS } from "@/src/demo-mode";
import { usePrice } from "@/src/services/Prices";
import { css } from "@/styled-system/css";
import { HFlex, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";

export function ProtocolStats() {
  const prices = [
    ["LQTY", usePrice("LQTY")],
    ["BOLD", usePrice("BOLD")],
    ["ETH", usePrice("ETH")],
  ] as const;

  const totalTvl = Object.values(BORROW_STATS).reduce(
    (acc, { tvl }) => dn.add(acc, tvl),
    dn.from(0, 18),
  );

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
        })}
      >
        <HFlex gap={8} alignItems="center">
          <Logo size={16} />
          <span>TVL</span>{" "}
          <span>
            ${dn.format(totalTvl, { compact: true })}
          </span>
        </HFlex>
        <HFlex gap={32}>
          {prices.map(([symbol, price]) => {
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
                  <span>
                    ${price && dn.format(price, {
                      digits: 2,
                      trailingZeros: true,
                    })}
                  </span>
                </HFlex>
              </HFlex>
            );
          })}
        </HFlex>
      </div>
    </div>
  );
}
