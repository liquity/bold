"use client";

import { CollateralSymbol } from "@/src/types";
import type { Dnum } from "dnum";
import type { Dispatch, ReactNode, SetStateAction } from "react";

import { useCollateralContract } from "@/src/contracts";
import {
  BOLD_PRICE as DEMO_BOLD_PRICE,
  ETH_PRICE as DEMO_ETH_PRICE,
  LQTY_PRICE as DEMO_LQTY_PRICE,
  PRICE_UPDATE_INTERVAL as DEMO_PRICE_UPDATE_INTERVAL,
  PRICE_UPDATE_MANUAL as DEMO_PRICE_UPDATE_MANUAL,
  PRICE_UPDATE_VARIATION as DEMO_PRICE_UPDATE_VARIATION,
  RETH_PRICE as DEMO_RETH_PRICE,
  STETH_PRICE as DEMO_STETH_PRICE,
} from "@/src/demo-mode";
import { DEMO_MODE } from "@/src/env";
import * as dn from "dnum";
import { createContext, useContext, useEffect, useState } from "react";
import { useReadContract } from "wagmi";

type PriceToken = "LQTY" | "BOLD" | CollateralSymbol;

type Prices = Record<PriceToken, Dnum | null>;

const initialPrices: Prices = {
  BOLD: dn.from(1, 18),
  LQTY: null,

  // collaterals
  ETH: null,
  RETH: null,
  STETH: null,
};

function useWatchCollateralPrice(collateral: CollateralSymbol) {
  const PriceFeed = useCollateralContract(collateral, "PriceFeed");
  const price = useReadContract(
    PriceFeed
      ? { ...PriceFeed, functionName: "lastGoodPrice" }
      : {},
  );
  return PriceFeed && price.data ? price : { data: null, loading: false };
}

let useWatchPrices = function useWatchPrices(callback: (prices: Prices) => void): void {
  const ethPrice = useWatchCollateralPrice("ETH");
  const rethPrice = useWatchCollateralPrice("RETH");
  const stethPrice = useWatchCollateralPrice("STETH");

  useEffect(() => {
    callback({
      // TODO: fetch prices for LQTY & BOLD
      ...initialPrices,
      ETH: ethPrice.data ? [ethPrice.data, 18] : null,
      RETH: rethPrice.data ? [rethPrice.data, 18] : null,
      STETH: stethPrice.data ? [stethPrice.data, 18] : null,
    });
  }, [
    callback,
    ethPrice,
    rethPrice,
    stethPrice,
  ]);
};

// if (DEMO_MODE) {
if (true) { // TODO: fix useWatchPrices above so we only use this if DEMO_MODE=true
  // in demo mode, simulate a variation of the prices
  useWatchPrices = (callback) => {
    useEffect(() => {
      const update = () => {
        const variation = () => dn.from((Math.random() - 0.5) * DEMO_PRICE_UPDATE_VARIATION, 18);
        callback({
          BOLD: dn.add(DEMO_BOLD_PRICE, dn.mul(DEMO_BOLD_PRICE, variation())),
          ETH: dn.add(DEMO_ETH_PRICE, dn.mul(DEMO_ETH_PRICE, variation())),
          LQTY: dn.add(DEMO_LQTY_PRICE, dn.mul(DEMO_LQTY_PRICE, variation())),
          RETH: dn.add(DEMO_RETH_PRICE, dn.mul(DEMO_RETH_PRICE, variation())),
          STETH: dn.add(DEMO_STETH_PRICE, dn.mul(DEMO_STETH_PRICE, variation())),
        });
      };

      const timer = DEMO_PRICE_UPDATE_MANUAL
        ? undefined
        : setInterval(update, DEMO_PRICE_UPDATE_INTERVAL);

      update();

      return () => clearInterval(timer);
    }, []);
  };
}

const PriceContext = createContext<{
  prices: Prices;
  setPrices: Dispatch<SetStateAction<Prices>>;
}>({
  prices: initialPrices,
  setPrices: () => {},
});

export function Prices({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<Prices>(initialPrices);

  useWatchPrices(setPrices);

  return (
    <PriceContext.Provider value={{ prices, setPrices }}>
      {children}
    </PriceContext.Provider>
  );
}

export function usePrice(token: PriceToken | null) {
  const { prices } = useContext(PriceContext);
  return token ? prices[token] : null;
}

export function useUpdatePrice() {
  const { setPrices } = useContext(PriceContext);
  return (token: PriceToken, price: Dnum | null) => {
    setPrices((prices) => ({ ...prices, [token]: price }));
  };
}
