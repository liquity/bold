"use client";

import { Positions } from "@/src/comps/Positions/Positions";
import { BORROW_STATS, EARN_POOLS } from "@/src/demo-mode";
import { css } from "@/styled-system/css";
import { AnchorTextButton, COLLATERALS, IconBorrow, IconEarn, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";
import { HomeProtocolStats } from "./HomeProtocolStats";
import { HomeTable } from "./HomeTable";

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
          display: "grid",
          gap: 24,
          gridTemplateColumns: "1fr 1fr",
        })}
      >
        <HomeTable
          title="Borrow BOLD against ETH and staked ETH"
          subtitle="You can adjust your loans, including your interest rate, at any time"
          icon={<IconBorrow />}
          columns={["Collateral", "Avg rate, p.a.", "Max LTV", null] as const}
          rows={COLLATERALS.map(({ symbol, name }) => {
            const borrowStats = BORROW_STATS[symbol];
            return [
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                })}
              >
                <TokenIcon symbol={symbol} size="mini" />
                <span>{name}</span>
              </div>,
              `${dn.format(dn.mul(borrowStats.borrowRate, 100), { digits: 2, trailingZeros: true })}%`,
              `${dn.format(dn.mul(borrowStats.maxLtv, 100), { digits: 0, trailingZeros: true })}%`,
              <div
                className={css({
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                })}
              >
                <Link
                  href={`/borrow/${symbol.toLowerCase()}`}
                  legacyBehavior
                  passHref
                >
                  <AnchorTextButton
                    label={
                      <div
                        className={css({
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 14,
                        })}
                      >
                        Borrow
                        <TokenIcon symbol="BOLD" size="mini" />
                      </div>
                    }
                    title={`Borrow ${name} from ${symbol}`}
                  />
                </Link>
                <Link
                  href={`/leverage/${symbol.toLowerCase()}`}
                  legacyBehavior
                  passHref
                >
                  <AnchorTextButton
                    label={
                      <div
                        className={css({
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 14,
                        })}
                      >
                        Leverage
                        <TokenIcon symbol={symbol} size="mini" />
                      </div>
                    }
                    title={`Borrow ${name} from ${symbol}`}
                  />
                </Link>
              </div>,
            ];
          })}
        />
        <HomeTable
          title="Earn Rewards with BOLD"
          subtitle="Earn BOLD & (staked) ETH rewards by putting your BOLD in a stability pool"
          icon={<IconEarn />}
          columns={["Pool", "Current APR", "Pool size", null] as const}
          rows={COLLATERALS.map(({ symbol, name }) => {
            const earnPool = EARN_POOLS[symbol];
            return [
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                })}
              >
                <TokenIcon symbol={symbol} size="mini" />
                <span>{name}</span>
              </div>,
              `${dn.format(dn.mul(earnPool.apr, 100), { digits: 2, trailingZeros: true })}%`,
              `$${dn.format(earnPool.boldQty, { compact: true })}`,
              <Link
                href={`/earn/${symbol.toLowerCase()}`}
                legacyBehavior
                passHref
              >
                <AnchorTextButton
                  label={
                    <div
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 14,
                      })}
                    >
                      Earn
                      <TokenIcon.Group size="mini">
                        <TokenIcon symbol="BOLD" />
                        <TokenIcon symbol={symbol} />
                      </TokenIcon.Group>
                    </div>
                  }
                  title={`Earn BOLD with ${name}`}
                />
              </Link>,
            ];
          })}
        />
      </div>
      <div
        className={css({
          paddingTop: 16,
        })}
      >
        <HomeProtocolStats />
      </div>
    </div>
  );
}
