"use client";

import type { Entries } from "@/src/types";

import { Positions } from "@/src/comps/Positions/Positions";
import { ProductCard } from "@/src/comps/ProductCard/ProductCard";
import { ProtocolStats } from "@/src/comps/ProtocolStats/ProtocolStats";
import content from "@/src/content";
import { css } from "@/styled-system/css";
import { IconBorrow, IconEarn, IconLeverage, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import { BORROW_FROM, EARN_POOLS, LEVERAGE_FROM } from "../demo-data";

export default function Home() {
  return (
    <div
      className={css({
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        gap: 48,
        width: "100%",
      })}
    >

      <Positions />

      <ProtocolStats />

      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 80,
          paddingTop: 16,
        })}
      >
        <ProductCard.Group
          name="Borrow BOLD"
          icon={<IconBorrow />}
          description="Set your own interest rate and borrow BOLD against ETH and staked ETH"
          summary={{
            label: "Total borrowed",
            value: dn.format([1_255_520_871n, 0], 0) + " $",
          }}
        >
          {(Object.entries(BORROW_FROM) as Entries<typeof BORROW_FROM>)
            .map(([symbol, { avgIr, maxTvl }]) => (
              <ProductCard
                key={symbol}
                hint="Borrow BOLD"
                icon={<TokenIcon symbol={symbol} />}
                path={`/borrow/${symbol.toLowerCase()}`}
                title={symbol}
              >
                <ProductCard.Info label="Avg IR" value={avgIr} />
                <ProductCard.Info label="Max LTV" value={maxTvl} />
              </ProductCard>
            ))}
        </ProductCard.Group>

        <ProductCard.Group
          name="Leverage ETH"
          icon={<IconLeverage />}
          description="Increase your exposure to ETH and staked ETH"
        >
          {(Object.entries(LEVERAGE_FROM) as Entries<typeof LEVERAGE_FROM>)
            .map(([symbol, { avgIr, avgLeverage, maxLeverage }]) => (
              <ProductCard
                key={symbol}
                hint="Leverage"
                icon={<TokenIcon symbol={symbol} />}
                path={`/leverage/${symbol.toLowerCase()}`}
                title={symbol}
                tag={`Max ${maxLeverage}`}
              >
                <ProductCard.Info label="Avg IR" value={avgIr} />
                <ProductCard.Info label="Avg leverage" value={avgLeverage} />
              </ProductCard>
            ))}
        </ProductCard.Group>

        <ProductCard.Group
          name="Earn with pools"
          icon={<IconEarn />}
          description="Earn defi-native yield from your BOLD"
          summary={{
            label: "In earn pools",
            value: dn.format([174_509_871n, 0], 0) + " $",
          }}
        >
          {(Object.entries(EARN_POOLS) as Entries<typeof EARN_POOLS>)
            .map(([symbol, { apy, boldQty }]) => (
              <ProductCard
                key={symbol}
                hint="Earn"
                icon={<TokenIcon symbol={symbol} />}
                path={`/earn/${symbol.toLowerCase()}`}
                title={symbol}
              >
                <ProductCard.Info label="APY" value={`${dn.format(apy, 2)}%`} />
                <ProductCard.Info label="TVL" value={`$${dn.format(boldQty, { compact: true })}`} />
              </ProductCard>
            ))}
        </ProductCard.Group>
      </div>
    </div>
  );
}
