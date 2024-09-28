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
import { dnum18, jsonStringifyWithDnum } from "@/src/dnum-utils";
import { DEMO_MODE } from "@/src/env";
import * as dn from "dnum";
import { createContext, useContext, useEffect, useState } from "react";
import { useRef } from "react";
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
  return useReadContract({
    ...(PriceFeed as NonNullable<typeof PriceFeed>),
    functionName: "lastGoodPrice",
    query: {
      enabled: PriceFeed !== null,
      refetchInterval: 10_000,
    },
  });
}

let useWatchPrices = function useWatchPrices(callback: (prices: Prices) => void): void {
  const ethPrice = useWatchCollateralPrice("ETH");
  const rethPrice = useWatchCollateralPrice("RETH");
  const stethPrice = useWatchCollateralPrice("STETH");

  const prevPrices = useRef<Prices>({
    BOLD: null,
    LQTY: null,
    ETH: null,
    RETH: null,
    STETH: null,
  });

  useEffect(() => {
    const newPrices = {
      // TODO: check BOLD and LQTY prices
      BOLD: dn.from(1, 18),
      LQTY: dn.from(1, 18),

      ETH: ethPrice.data ? dnum18(ethPrice.data) : null,
      RETH: rethPrice.data ? dnum18(rethPrice.data) : null,
      STETH: stethPrice.data ? dnum18(stethPrice.data) : null,
    };

    const hasChanged = jsonStringifyWithDnum(newPrices) !== jsonStringifyWithDnum(prevPrices.current);

    if (hasChanged) {
      callback(newPrices);
      prevPrices.current = newPrices;
    }
  }, [
    callback,
    ethPrice,
    rethPrice,
    stethPrice,
  ]);
};

// in demo mode, simulate a variation of the prices
if (DEMO_MODE) {
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
