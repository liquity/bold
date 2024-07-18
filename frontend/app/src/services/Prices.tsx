"use client";

import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import {
  BOLD_PRICE as DEMO_BOLD_PRICE,
  ETH_PRICE as DEMO_ETH_PRICE,
  LQTY_PRICE as DEMO_LQTY_PRICE,
  PRICE_UPDATE_INTERVAL as DEMO_PRICE_UPDATE_INTERVAL,
  PRICE_UPDATE_VARIATION as DEMO_PRICE_UPDATE_VARIATION,
  RETH_PRICE as DEMO_RETH_PRICE,
  STETH_PRICE as DEMO_STETH_PRICE,
} from "@/src/demo-mode";
import { DEMO_MODE } from "@/src/env";
import * as dn from "dnum";
import { createContext, useContext, useEffect, useState } from "react";

type PriceToken = "ETH" | "LQTY" | "BOLD" | "RETH" | "STETH";

type Prices = Record<PriceToken, Dnum | null>;

const initialPrices: Prices = {
  BOLD: null,
  ETH: null,
  LQTY: null,
  RETH: null,
  STETH: null,
};

// TODO: implement a price watcher
let useWatchPrices = function useWatchPrices(): Prices {
  return initialPrices;
};

if (DEMO_MODE) {
  // in demo mode, simulate a variation of the prices
  useWatchPrices = () => {
    const [prices, setPrices] = useState<Prices>(initialPrices);

    useEffect(() => {
      const update = () => {
        const variation = () => dn.from((Math.random() - 0.5) * DEMO_PRICE_UPDATE_VARIATION, 18);
        setPrices({
          BOLD: dn.add(DEMO_BOLD_PRICE, dn.mul(DEMO_BOLD_PRICE, variation())),
          ETH: dn.add(DEMO_ETH_PRICE, dn.mul(DEMO_ETH_PRICE, variation())),
          LQTY: dn.add(DEMO_LQTY_PRICE, dn.mul(DEMO_LQTY_PRICE, variation())),
          RETH: dn.add(DEMO_RETH_PRICE, dn.mul(DEMO_RETH_PRICE, variation())),
          STETH: dn.add(DEMO_STETH_PRICE, dn.mul(DEMO_STETH_PRICE, variation())),
        });
      };

      const timer = setInterval(update, DEMO_PRICE_UPDATE_INTERVAL);
      update();

      return () => clearInterval(timer);
    }, []);

    return prices;
  };
}

const PriceContext = createContext<Prices>(initialPrices);

export function Prices({ children }: { children: ReactNode }) {
  const prices = useWatchPrices();
  return (
    <PriceContext.Provider value={prices}>
      {children}
    </PriceContext.Provider>
  );
}

export function usePrice(token: PriceToken) {
  return useContext(PriceContext)[token];
}
