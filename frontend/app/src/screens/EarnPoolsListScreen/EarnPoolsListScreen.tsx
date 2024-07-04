"use client";

import type { Entries, PositionEarn } from "@/src/types";
import type { CollateralSymbol } from "@liquity2/uikit";

import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { ACCOUNT_POSITIONS, EARN_POOLS, useDemoMode } from "@/src/demo-mode";
import { formatAmountCompact } from "@/src/dnum-utils";
import { useAccount } from "@/src/eth/Ethereum";
import { css, cx } from "@/styled-system/css";
import { IconArrowRight, TokenIcon, TOKENS_BY_SYMBOL } from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";

export function EarnPoolsListScreen() {
  const demoMode = useDemoMode();
  const account = useAccount();

  const earnPositions = new Map<CollateralSymbol, PositionEarn>();

  if (account.isConnected && demoMode.enabled) {
    for (const position of ACCOUNT_POSITIONS) {
      if (position.type === "earn") {
        earnPositions.set(position.collateral, position);
      }
    }
  }

  return (
    <Screen
      subtitle={content.earnHome.subheading}
      title={
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          })}
        >
          {content.earnHome.headline(
            <TokenIcon.Group>
              {[
                "BOLD" as const,
                ...Object.keys(EARN_POOLS) as (keyof typeof EARN_POOLS)[],
              ].map((symbol) => (
                <TokenIcon
                  key={symbol}
                  symbol={symbol}
                />
              ))}
            </TokenIcon.Group>,
            <TokenIcon symbol="BOLD" />,
          )}
        </div>
      }
      width={720}
    >
      <table
        className={css({
          borderCollapse: "separate",
          borderSpacing: 0,
          width: 720,
          border: "1px solid token(colors.border)",
          borderRadius: 8,
          "& th": {
            padding: 24,
            textAlign: "left",
            textTransform: "uppercase",
            fontSize: 12,
            fontWeight: 500,
            color: "contentAlt",
          },
          "& td": {
            verticalAlign: "top",
            borderTop: "1px solid token(colors.border)",
          },
        })}
      >
        <thead>
          <tr>
            <th>Pool</th>
            <th>APR</th>
            <th
              className={css({
                paddingRight: "88px!",
                textAlign: "right!",
              })}
            >
              {content.earnHome.poolsColumns.myDepositAndRewards}
            </th>
          </tr>
        </thead>
        <tbody>
          {(Object.entries(EARN_POOLS) as Entries<typeof EARN_POOLS>).map(
            ([symbol, { boldQty, apr }]) => {
              const token = TOKENS_BY_SYMBOL[symbol];

              const earnPosition = earnPositions.get(symbol);

              // const rewards: null | {
              //   bold: string;
              //   eth: string;
              // } = null;

              // const deposit: null | {
              //   bold: string;
              //   eth: string;
              // } = null;

              return (
                <tr key={symbol}>
                  <td
                    className={css({
                      padding: "24px 48px 24px 24px",
                    })}
                  >
                    <div
                      className={css({
                        display: "flex",
                        gap: 24,
                      })}
                    >
                      <div
                        className={css({
                          display: "flex",
                          alignItems: "center",
                          flexShrink: 0,
                        })}
                      >
                        <TokenIcon.Group size="large">
                          <TokenIcon symbol="BOLD" />
                          <TokenIcon symbol={symbol} />
                        </TokenIcon.Group>
                      </div>
                      <div
                        className={css({
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                        })}
                      >
                        <div>{token.name}</div>
                        <div
                          className={css({
                            color: "contentAlt",
                            whiteSpace: "nowrap",
                          })}
                        >
                          {formatAmountCompact(boldQty)} BOLD
                        </div>
                      </div>
                    </div>
                  </td>
                  <td
                    className={css({
                      padding: 24,
                    })}
                  >
                    <div
                      className={css({
                        display: "flex",
                        height: "100%",
                      })}
                    >
                      {dn.format(dn.mul(apr, 100), 2)}%
                    </div>
                  </td>
                  <td>
                    <Link
                      href={`/earn/${symbol.toLowerCase()}`}
                      passHref
                      legacyBehavior
                    >
                      <a
                        className={cx(
                          "group",
                          css({
                            display: "flex",
                            justifyContent: "flex-end",
                            alignItems: "center",
                            height: 102,
                            padding: "24px 0 24px 24px",
                            textAlign: "right",
                            _focusVisible: {
                              outline: "2px solid token(colors.focused)",
                              borderRadius: 4,
                            },
                            _active: {
                              background: "backgroundActive",
                            },
                          }),
                        )}
                      >
                        <div
                          className={css({
                            display: "flex",
                            alignItems: "flex-end",
                            flexDirection: "column",
                            gap: 8,
                          })}
                        >
                          {earnPosition
                            ? (
                              <div>
                                {dn.format(earnPosition.deposit, 2)} BOLD
                              </div>
                            )
                            : (
                              <div
                                className={css({
                                  color: "contentAlt",
                                })}
                              >
                                −
                              </div>
                            )}
                          {earnPosition && (
                            <div
                              className={css({
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                fontSize: 14,
                                color: "positive",
                              })}
                            >
                              {dn.format(earnPosition.rewards.bold, 2)} BOLD
                              <div
                                className={css({
                                  display: "flex",
                                  width: 4,
                                  height: 4,
                                  borderRadius: "50%",
                                  backgroundColor: "dimmed",
                                })}
                              />
                              {dn.format(earnPosition.rewards.eth, 2)} ETH
                            </div>
                          )}
                        </div>
                        <div
                          className={css({
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            height: "100%",
                            color: "accent",
                            width: "88px!",
                            paddingRight: 28,
                            transition: "transform 100ms",
                            _groupHover: {
                              transform: "translate3d(4px, 0, 0)",
                            },
                            _groupFocus: {
                              transform: "translate3d(4px, 0, 0)",
                            },
                          })}
                        >
                          <IconArrowRight />
                        </div>
                      </a>
                    </Link>
                  </td>
                </tr>
              );
            },
          )}
        </tbody>
      </table>
    </Screen>
  );
}
