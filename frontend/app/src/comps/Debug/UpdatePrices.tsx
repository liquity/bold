"use client";

import { PRICE_UPDATE_MANUAL } from "@/src/demo-mode";
import { usePrice, useUpdatePrice } from "@/src/services/Prices";
import { css } from "@/styled-system/css";
import * as dn from "dnum";

const ETH_RANGE = [200, 5000];
const RETH_RANGE = [220, 5500];
const WSTETH_RANGE = [200, 5000];

export function UpdatePrices() {
  const updatePrice = useUpdatePrice();

  const ethPrice = usePrice("ETH");
  const rethPrice = usePrice("RETH");
  const wstethPrice = usePrice("WSTETH");

  return PRICE_UPDATE_MANUAL && (
    <div
      className={css({
        height: 40,
      })}
    >
      <div
        className={css({
          position: "fixed",
          zIndex: 1,
          inset: "auto 0 0",
          display: "flex",
          gap: 16,
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          height: 40,
          padding: "0 32px",
          fontSize: 14,
          background: "background",
          borderTop: "1px solid token(colors.border)",
        })}
      >
        <div
          className={css({
            color: "contentAlt",
          })}
        >
          simulate prices
        </div>{" "}
        <div
          className={css({
            display: "flex",
            gap: 32,
          })}
        >
          {([
            ["ETH", ethPrice, ETH_RANGE],
            ["RETH", rethPrice, RETH_RANGE],
            ["WSTETH", wstethPrice, WSTETH_RANGE],
          ] as const).map(([token, price, range]) => (
            <div
              key={token}
              className={css({
                display: "flex",
                gap: 8,
                fontVariantNumeric: "tabular-nums",
              })}
            >
              {token}: ${price && dn.format(price, { digits: 2, trailingZeros: true })}
              <input
                type="range"
                min={range[0] * 100}
                max={range[1] * 100}
                step={100}
                value={price ? dn.toNumber(price) * 100 : 0}
                onChange={(e) => updatePrice(token, dn.div(dn.from(e.target.value, 18), 100))}
                className={css({
                  width: 100,
                })}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
