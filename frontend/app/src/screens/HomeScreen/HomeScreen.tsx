"use client";

import type { CollateralSymbol } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { Positions } from "@/src/comps/Positions/Positions";
import { useBreakpointName } from "@/src/breakpoints";
import content from "@/src/content";
import { MAX_DEBT_LIMITS } from "@/src/constants";
import { WHITE_LABEL_CONFIG } from "@/src/white-label.config";
import { DNUM_1 } from "@/src/dnum-utils";
import {
  getBranch,
  getBranches,
  getCollToken,
  getToken,
  useAverageInterestRate,
  useBranchDebt,
  useEarnPool,
} from "@/src/liquity-utils";
import { getAvailableEarnPools } from "@/src/white-label.config";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { TokenIcon, Button, IconExternal } from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";

export function HomeScreen() {
  const account = useAccount();

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        width: "100%",
      })}
    >
      {/* Hero Section */}
      <div
        className={css({
          position: "relative",
          width: "100%",
          marginTop: -96,
          paddingTop: 96,
          marginBottom: -180,
        })}
      >
        <div
          className={`hero-background ${css({
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100vw",
            height: "100%",
            zIndex: -1,
            backgroundPosition: "center top",
            _after: {
              content: '""',
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "50%",
              background: "linear-gradient(to bottom, transparent, black)",
            },
          })}`}
        />
        
        <div
          className={css({
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 0 80px",
            minHeight: "420px",
            maxWidth: "1200px",
            margin: "0 auto",
            width: "100%",
          })}
        >
          <h1
            className={`font-audiowide ${css({
              color: "white",
              fontSize: { base: "32px", medium: "48px", large: "48px" },
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 0,
            })}`}
          >
            {content.home.openPositionTitle}
          </h1>
        </div>
      </div>

      {/* Positions Component */}
      <div
        className={css({
          position: "relative",
          zIndex: 5,
        })}
      >
        <Positions 
          address={account.address ?? null} 
          title={(mode) => mode === "positions" ? content.home.myPositionsTitle : null}
        />
      </div>

      {/* Borrow and Earn Sections Side by Side */}
      <div
        className={css({
          display: "grid",
          gridTemplateColumns: { base: "1fr", large: "repeat(2, 1fr)" },
          gap: 32,
          marginTop: 48,
          width: "100%",
        })}
      >
        {/* Borrow Section */}
        <div
          className={css({
            background: "rgba(0, 0, 0, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 16,
            padding: 20,
          })}
        >
          <div
            className={css({
              marginBottom: 24,
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              paddingBottom: 20,
            })}
          >
            <h2
              className={`font-audiowide ${css({
                color: "white",
                fontSize: { base: "18px", medium: "20px" },
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 8,
              })}`}
            >
              Borrow {WHITE_LABEL_CONFIG.tokens.mainToken.symbol} against multiple collaterals
            </h2>
            <p
              className={css({
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: "14px",
              })}
            >
              You can adjust your loans, including your interest rate, at any time
            </p>
          </div>
          
          <table
            className={css({
              width: "100%",
              borderSpacing: "0 6px",
              borderCollapse: "separate",
              tableLayout: "fixed",
            })}
          >
            <thead>
              <tr>
                <th
                  className={css({
                    textAlign: "left",
                    padding: "4px 8px",
                    color: "rgba(255, 255, 255, 0.5)",
                    fontSize: "12px",
                    fontWeight: 500,
                    width: "100px",
                  })}
                >
                  Collateral
                </th>
                <th
                  className={css({
                    textAlign: "center",
                    padding: "4px 8px",
                    color: "rgba(255, 255, 255, 0.5)",
                    fontSize: "12px",
                    fontWeight: 500,
                  })}
                >
                  AVG Rate, P.A.
                </th>
                <th
                  className={css({
                    textAlign: "center",
                    padding: "4px 8px",
                    color: "rgba(255, 255, 255, 0.5)",
                    fontSize: "12px",
                    fontWeight: 500,
                  })}
                >
                  Max LTV
                </th>
                <th
                  className={css({
                    textAlign: "center",
                    padding: "4px 8px",
                    color: "rgba(255, 255, 255, 0.5)",
                    fontSize: "12px",
                    fontWeight: 500,
                    width: "140px",
                    display: { base: "none", medium: "table-cell" },
                  })}
                >
                  Debt Issued
                </th>
                <th
                  className={css({
                    padding: "4px 8px",
                    textAlign: "right",
                  })}
                ></th>
              </tr>
            </thead>
            <tbody>
              {getBranches()
                // .filter((branch) => branch.symbol.toLowerCase() !== "tbtc") // TODO: remove this once tBTC is supported
                .map(({ symbol }) => (
                <BorrowRow
                  key={symbol}
                  symbol={symbol}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Earn Section */}
        <div
          className={css({
            background: "rgba(0, 0, 0, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 16,
            padding: 20,
          })}
        >
          <div
            className={css({
              marginBottom: 24,
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              paddingBottom: 20,
            })}
          >
            <h2
              className={`font-audiowide ${css({
                color: "white",
                fontSize: { base: "18px", medium: "20px" },
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 8,
              })}`}
            >
              Earn rewards with {WHITE_LABEL_CONFIG.tokens.mainToken.name}
            </h2>
            <p
              className={css({
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: "14px",
              })}
            >
              Earn {WHITE_LABEL_CONFIG.tokens.mainToken.symbol} & (staked) ETH rewards by depositing your {WHITE_LABEL_CONFIG.tokens.mainToken.symbol} in a stability pool
            </p>
          </div>

          <table
            className={css({
              width: "100%",
              borderSpacing: "0 6px",
              borderCollapse: "separate",
              tableLayout: "fixed",
            })}
          >
            <thead>
              <tr>
                <th
                  className={css({
                    textAlign: "left",
                    padding: "4px 8px",
                    color: "rgba(255, 255, 255, 0.5)",
                    fontSize: "12px",
                    fontWeight: 500,
                    width: "100px",
                  })}
                >
                  Pool
                </th>
                <th
                  className={css({
                    textAlign: "center",
                    padding: "4px 8px",
                    color: "rgba(255, 255, 255, 0.5)",
                    fontSize: "12px",
                    fontWeight: 500,
                  })}
                >
                  APR
                </th>
                <th
                  className={css({
                    textAlign: "center",
                    padding: "4px 8px",
                    color: "rgba(255, 255, 255, 0.5)",
                    fontSize: "12px",
                    fontWeight: 500,
                  })}
                >
                  7d APR
                </th>
                <th
                  className={css({
                    textAlign: "center",
                    padding: "4px 8px",
                    color: "rgba(255, 255, 255, 0.5)",
                    fontSize: "12px",
                    fontWeight: 500,
                  })}
                >
                  Pool Size
                </th>
                <th
                  className={css({
                    padding: "4px 8px",
                    textAlign: "right",
                  })}
                ></th>
              </tr>
            </thead>
            <tbody>
              {getAvailableEarnPools()
                .filter(pool => pool.type !== 'staked')
                .map((pool) => {
                  const symbol = pool.symbol.toUpperCase();
                  return (
                    <EarnRow
                      key={pool.symbol}
                      symbol={symbol as CollateralSymbol}
                    />
                  );
                })}
            </tbody>
          </table>

        </div>
      </div>
    </div>
  );
}

function BorrowRow({
  symbol,
}: {
  symbol: CollateralSymbol;
}) {
  const branch = getBranch(symbol);
  const collateral = getCollToken(branch.id);
  const avgInterestRate = useAverageInterestRate(branch.id);
  const branchDebt = useBranchDebt(branch.id);
  const breakpoint = useBreakpointName();
  const isMobile = breakpoint === "small";

  const maxLtv = collateral?.collateralRatio && dn.gt(collateral.collateralRatio, 0)
    ? dn.div(DNUM_1, collateral.collateralRatio)
    : null;

  return (
    <tr
      className={css({
        background: "rgba(255, 255, 255, 0.05)",
        transition: "background 0.2s",
        "&:hover": {
          background: "rgba(255, 255, 255, 0.08)",
        },
        maxWidth: "50px",
      })}
    >
      <td
        className={css({
          padding: "6px 8px",
          borderRadius: "8px 0 0 8px",
        })}
        title={collateral?.name}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 10,
          })}
        >
          <div className={css({ flexShrink: 0 })}>
            <TokenIcon symbol={symbol} size="small" />
          </div>
          <span 
            className="font-audiowide"
            style={{ 
              color: "white", 
              fontWeight: 500, 
              fontSize: "14px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
            }}
          >
            {collateral?.name}
          </span>
        </div>
      </td>
      
      <td
        className={css({
          padding: "6px 8px",
          textAlign: "center",
        })}
      >
        <Amount
          fallback="…"
          percentage
          value={avgInterestRate.data}
        />
      </td>
      
      <td
        className={css({
          padding: "6px 8px",
          textAlign: "center",
        })}
      >
        <Amount
          value={maxLtv}
          percentage
        />
      </td>
      
      <td
        className={css({
          padding: "6px 8px",
          textAlign: "center",
          display: { base: "none", medium: "table-cell" },
        })}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
          })}
        >
          <Amount
            format="compact"
            prefix="$"
            fallback="…"
            value={branchDebt.data}
          />
          <span
            className={css({
              color: "rgba(255, 255, 255, 0.3)",
            })}
          >
            /
          </span>
          <Amount
            format="compact"
            prefix="$"
            value={MAX_DEBT_LIMITS[symbol]}
          />
        </div>
      </td>

      <td
        className={css({
          padding: "6px 8px",
          borderRadius: "0 8px 8px 0",
        })}
      >
        <Link href={`/borrow/${symbol.toLowerCase()}`} className={css({ display: "flex", justifyContent: "flex-end" })}>
          {isMobile ? (
            <button
              className={css({
                background: "#A189AB",
                color: "white",
                height: "32px",
                width: "32px",
                border: "none",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s",
                "&:hover": {
                  background: "#8A7094",
                  transform: "translateY(-1px)",
                },
              })}
            >
              <IconExternal size={16} />
            </button>
          ) : (
            <Button
              label="BORROW"
              className={`font-audiowide ${css({
                background: "#A189AB",
                color: "white!",
                height: "24px!",
                border: "none",
                borderRadius: 16,
                padding: "0px 16px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: "11px!",
                fontWeight: 500,
                transition: "all 0.2s",
                "&:hover": {
                  background: "#8A7094",
                  transform: "translateY(-1px)",
                },
              })}`}
            />
          )}
        </Link>
      </td>
    </tr>
  );
}

function EarnRow({
  symbol,
}: {
  symbol: CollateralSymbol;
}) {
  const branch = getBranch(symbol);
  const token = getToken(symbol);
  const earnPool = useEarnPool(branch?.id ?? null);
  const breakpoint = useBreakpointName();
  const isMobile = breakpoint === "small";
  
  return (
    <tr
      className={css({
        background: "rgba(255, 255, 255, 0.05)",
        transition: "background 0.2s",
        "&:hover": {
          background: "rgba(255, 255, 255, 0.08)",
        },
      })}
    >
      <td
        className={css({
          padding: "6px 8px",
          borderRadius: "8px 0 0 8px",
        })}
        title={token?.name}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 10,
          })}
        >
          <div className={css({ flexShrink: 0 })}>
            <TokenIcon symbol={symbol} size="small" />
          </div>
          <span 
            className="font-audiowide"
            style={{ 
              color: "white", 
              fontWeight: 500, 
              fontSize: "14px",
              maxWidth: "120px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
            }}
          >
            {token?.name}
          </span>
        </div>
      </td>
      
      <td
        className={css({
          padding: "6px 8px",
          textAlign: "center",
        })}
      >
        <Amount
          fallback="…"
          percentage
          value={earnPool.data?.apr}
        />
      </td>
      
      <td
        className={css({
          padding: "6px 8px",
          textAlign: "center",
        })}
      >
        <Amount
          fallback="…"
          percentage
          value={earnPool.data?.apr7d}
        />
      </td>
      
      <td
        className={css({
          padding: "6px 8px",
          textAlign: "center",
        })}
      >
        <Amount
          fallback="…"
          format="compact"
          prefix="$"
          value={earnPool.data?.totalDeposited}
        />
      </td>

      <td
        className={css({
          padding: "6px 8px",
          borderRadius: "0 8px 8px 0",
        })}
      >
        <Link href={`/earn/${symbol.toLowerCase()}`} className={css({ display: "flex", justifyContent: "flex-end" })}>
          {isMobile ? (
            <button
              className={css({
                background: "#A189AB",
                color: "white",
                height: "32px",
                width: "32px",
                border: "none",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.2s",
                "&:hover": {
                  background: "#8A7094",
                  transform: "translateY(-1px)",
                },
              })}
            >
              <IconExternal size={16} />
            </button>
          ) : (
            <button
              className={`font-audiowide ${css({
                background: "#A189AB",
                color: "white",
                height: "24px",
                border: "none",
                borderRadius: 16,
                padding: "0px 12px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: "11px",
                fontWeight: 500,
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                "&:hover": {
                  background: "#8A7094",
                  transform: "translateY(-1px)",
                },
              })}`}
            >
              EARN
              <TokenIcon.Group size="mini">
                <TokenIcon symbol={WHITE_LABEL_CONFIG.tokens.mainToken.symbol} />
                <TokenIcon symbol={symbol} />
              </TokenIcon.Group>
            </button>
          )}
        </Link>
      </td>
    </tr>
  );
}