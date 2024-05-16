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
          name={content.home.products.borrow.title}
          icon={<IconBorrow />}
          description={content.home.products.borrow.description}
          summary={{
            label: content.home.products.borrow.total,
            value: dn.format([1_255_520_871n, 0], 0) + " $",
          }}
        >
          {(Object.entries(BORROW_FROM) as Entries<typeof BORROW_FROM>)
            .map(([symbol, { avgIr, maxTvl }]) => (
              <ProductCard
                key={symbol}
                hint={content.home.products.borrow.hint}
                icon={<TokenIcon symbol={symbol} />}
                path={`/borrow/${symbol.toLowerCase()}`}
                title={symbol}
              >
                <ProductCard.Info
                  label={content.home.products.borrow.avgIr}
                  value={avgIr}
                />
                <ProductCard.Info
                  label={content.home.products.borrow.maxLtv}
                  value={maxTvl}
                />
              </ProductCard>
            ))}
        </ProductCard.Group>
        <ProductCard.Group
          name={content.home.products.leverage.title}
          icon={<IconLeverage />}
          description={content.home.products.leverage.description}
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
                <ProductCard.Info
                  label={content.home.products.leverage.avgIr}
                  value={avgIr}
                />
                <ProductCard.Info
                  label={content.home.products.leverage.avgLeverage}
                  value={avgLeverage}
                />
              </ProductCard>
            ))}
        </ProductCard.Group>
        <ProductCard.Group
          name={content.home.products.earn.title}
          icon={<IconEarn />}
          description={content.home.products.earn.description}
          summary={{
            label: content.home.products.earn.total,
            value: dn.format([174_509_871n, 0], 0) + " $",
          }}
        >
          {(Object.entries(EARN_POOLS) as Entries<typeof EARN_POOLS>)
            .map(([symbol, { apy, boldQty }]) => (
              <ProductCard
                key={symbol}
                hint={content.home.products.earn.hint}
                icon={<TokenIcon symbol={symbol} />}
                path={`/earn/${symbol.toLowerCase()}`}
                title={symbol}
              >
                <ProductCard.Info
                  label={content.home.products.earn.apy}
                  value={`${dn.format(apy, 2)}%`}
                />
                <ProductCard.Info
                  label={content.home.products.earn.tvl}
                  value={`$${dn.format(boldQty, { compact: true })}`}
                />
              </ProductCard>
            ))}
        </ProductCard.Group>
      </div>
    </div>
  );
}
