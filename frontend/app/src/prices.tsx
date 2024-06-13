"use client";

import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { BOLD_PRICE, ETH_PRICE, LQTY_PRICE } from "@/src/demo-data";
import * as dn from "dnum";
import { createContext, useContext, useEffect, useState } from "react";

type PriceToken = "ETH" | "LQTY" | "BOLD";

const PriceContext = createContext<Record<PriceToken, Dnum>>({
  ETH: ETH_PRICE,
  LQTY: LQTY_PRICE,
  BOLD: BOLD_PRICE,
});

export function Prices({
  children,
}: {
  children: ReactNode;
}) {
  const [prices, setPrices] = useState({
    ETH: ETH_PRICE,
    LQTY: LQTY_PRICE,
    BOLD: BOLD_PRICE,
  });

  // simulate a 0.5% deviation from the demo prices every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const variation = dn.from((Math.random() - 0.5) * 0.005, 18);
      setPrices({
        ETH: dn.add(ETH_PRICE, dn.mul(ETH_PRICE, variation)),
        LQTY: dn.add(LQTY_PRICE, dn.mul(LQTY_PRICE, variation)),
        BOLD: dn.add(BOLD_PRICE, dn.mul(BOLD_PRICE, variation)),
      });
    }, 10_000);

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
