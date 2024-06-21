"use client";

import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { BOLD_PRICE, ETH_PRICE, LQTY_PRICE, RETH_PRICE, STETH_PRICE } from "@/src/demo-data";
import * as dn from "dnum";
import { createContext, useContext, useEffect, useState } from "react";

type PriceToken = "ETH" | "LQTY" | "BOLD";

const PriceContext = createContext<Record<PriceToken, Dnum>>({
  ETH: ETH_PRICE,
  LQTY: LQTY_PRICE,
  BOLD: BOLD_PRICE,
});

const UPDATE_INTERVAL = 15_000;
const UPDATE_VARIATION = 0.003;

export function Prices({
  children,
}: {
  children: ReactNode;
}) {
  const [prices, setPrices] = useState({
    BOLD: BOLD_PRICE,
    ETH: ETH_PRICE,
    LQTY: LQTY_PRICE,
    RETH: RETH_PRICE,
    STETH: STETH_PRICE,
  });

  // simulate a variation of the demo prices
  useEffect(() => {
    const timer = setInterval(() => {
      const variation = dn.from((Math.random() - 0.5) * UPDATE_VARIATION, 18);
      setPrices({
        BOLD: dn.add(BOLD_PRICE, dn.mul(BOLD_PRICE, variation)),
        ETH: dn.add(ETH_PRICE, dn.mul(ETH_PRICE, variation)),
        LQTY: dn.add(LQTY_PRICE, dn.mul(LQTY_PRICE, variation)),
        RETH: dn.add(RETH_PRICE, dn.mul(RETH_PRICE, variation)),
        STETH: dn.add(STETH_PRICE, dn.mul(STETH_PRICE, variation)),
      });
    }, UPDATE_INTERVAL);

    return () => clearInterval(timer);
  }, []);

  return (
    <PriceContext.Provider value={prices}>
      {children}
    </PriceContext.Provider>
  );
}

export function usePrice(token: PriceToken) {
  return useContext(PriceContext)[token];
}
