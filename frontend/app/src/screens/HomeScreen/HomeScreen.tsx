"use client";

import { Positions } from "@/src/comps/Positions/Positions";
import { BORROW_STATS, EARN_POOLS } from "@/src/demo-data";
import { css } from "@/styled-system/css";
import { AnchorButton, COLLATERALS, HFlex, IconBorrow, IconEarn, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";
// import content from "@/src/content";

export function HomeScreen() {
  return (
    <div
      className={css({
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        gap: 64,
        width: "100%",
      })}
    >
      <Positions />
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 80,
        })}
      >
        <table
          className={css({
            fontSize: 14,
            "& th": {
              fontWeight: "inherit",
              whiteSpace: "nowrap",
              textAlign: "left",
            },
            "& thead tr:first-of-type th": {
              paddingBottom: 32,
              textTransform: "uppercase",
              fontSize: 12,
            },
            "& thead tr + tr th": {
              padding: "0 0 12px",
              color: "contentAlt2",
              borderBottom: "1px solid token(colors.tableBorder)",
            },
            "& tbody td": {
              padding: "12px 0",
            },
            "& tbody tr:first-of-type td": {
              paddingTop: 20,
            },
          })}
        >
          <thead>
            <tr>
              <th>
                <HFlex gap={12} justifyContent="flex-start">
                  <TokenIcon symbol="LQTY" />
                  <div>Markets</div>
                </HFlex>
              </th>
              <th colSpan={3}>
                <HFlex gap={12} justifyContent="flex-start">
                  <IconBorrow />
                  <div>Borrow BOLD</div>
                </HFlex>
              </th>
              <th colSpan={3}>
                <HFlex gap={12} justifyContent="flex-start">
                  <IconEarn />
                  <div>
                    Earn pools
                  </div>
                </HFlex>
              </th>
            </tr>
            <tr>
              <th>Token</th>
              <th title="Borrow rate average">Avg. borrow rate</th>
              <th
                colSpan={2}
                title="Total Value Locked (collateral)"
              >
                TVL
              </th>
              <th
                colSpan={2}
                title="Annual Percentage Yield (earn pools)"
              >
                Earn APY
              </th>
              <th title="Total Value Locked (earn pools)">TVL</th>
            </tr>
          </thead>
          <tbody>
            {COLLATERALS.map(({ symbol, name }) => {
              const borrowStats = BORROW_STATS[symbol];
              const earnPool = EARN_POOLS[symbol];
              return (
                <tr key={symbol}>
                  <td>
                    <HFlex gap={12} justifyContent="flex-start">
                      <TokenIcon symbol={symbol} />
                      <div>{name}</div>
                    </HFlex>
                  </td>
                  <td>
                    {dn.format(
                      dn.mul(borrowStats.borrowRate, 100),
                      { digits: 2, trailingZeros: true },
                    )}%
                  </td>
                  <td>
                    ${dn.format(borrowStats.tvl, { compact: true })}
                  </td>
                  <td>
                    <Link
                      href={`/borrow/${symbol.toLowerCase()}`}
                      legacyBehavior
                      passHref
                    >
                      <AnchorButton
                        label="Borrow"
                        size="mini"
                        title={`Borrow ${name}`}
                      />
                    </Link>
                  </td>
                  <td>
                    {dn.format(
                      dn.mul(earnPool.apy, 100),
                      { digits: 2, trailingZeros: true },
                    )}%
                  </td>
                  <td>
                    ${dn.format(earnPool.boldQty, { compact: true })}
                  </td>
                  <td>
                    <Link
                      href={`/earn/${symbol.toLowerCase()}`}
                      legacyBehavior
                      passHref
                    >
                      <AnchorButton
                        title="Earn with bold"
                        label="Earn"
                        size="mini"
                      />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
