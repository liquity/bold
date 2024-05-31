"use client";

import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { POOLS } from "@/src/demo-data";
import { css, cx } from "@/styled-system/css";
import { IconArrowRight, TokenIcon } from "@liquity2/uikit";
import Link from "next/link";

export function EarnPoolsListScreen() {
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
                ...POOLS.map(({ symbol }) => symbol),
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
            <th>APY</th>
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
          {POOLS.map(({ boldQty, symbol, token, apy, deposit, rewards }) => (
            <tr key={token}>
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
                    <div>{token}</div>
                    <div
                      className={css({
                        color: "contentAlt",
                        whiteSpace: "nowrap",
                      })}
                    >
                      {boldQty}
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
                  {apy}
                </div>
              </td>
              <td>
                <Link href={`/earn/${symbol.toLowerCase()}`} passHref legacyBehavior>
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
                      {deposit ? <div>{deposit}</div> : (
                        <div
                          className={css({
                            color: "contentAlt",
                          })}
                        >
                          −
                        </div>
                      )}
                      {rewards && (
                        <div
                          className={css({
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 14,
                            color: "positive",
                          })}
                        >
                          {rewards.bold} BOLD
                          <div
                            className={css({
                              display: "flex",
                              width: 4,
                              height: 4,
                              borderRadius: "50%",
                              backgroundColor: "dimmed",
                            })}
                          />
                          {rewards.eth} ETH
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
          ))}
        </tbody>
      </table>
    </Screen>
  );
}
