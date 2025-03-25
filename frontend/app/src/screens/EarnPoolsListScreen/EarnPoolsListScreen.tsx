"use client";

import type { BranchId } from "@/src/types";

import { EarnPositionSummary, OpenLink } from "@/src/comps/EarnPositionSummary/EarnPositionSummary";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { getBranches, useEarnPosition } from "@/src/liquity-utils";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { InfoTooltip, TokenIcon } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import { Amount } from "@/src/comps/Amount/Amount";

export function EarnPoolsListScreen() {
  const branches = getBranches();
  const collSymbols = branches.map((b) => b.symbol);

  const poolsTransition = useTransition(branches.map((c) => c.branchId), {
    from: { opacity: 0, transform: "scale(1.1) translateY(64px)" },
    enter: { opacity: 1, transform: "scale(1) translateY(0px)" },
    leave: { opacity: 0, transform: "scale(1) translateY(0px)" },
    trail: 80,
    config: {
      mass: 1,
      tension: 1800,
      friction: 140,
    },
  });

  return (
    <Screen
      heading={{
        title: (
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
                {["bvUSD" as const, ...collSymbols].map((symbol) => (
                  <TokenIcon
                    key={symbol}
                    symbol={symbol}
                  />
                ))}
              </TokenIcon.Group>,
              <TokenIcon symbol="bvUSD" />,
            )}
          </div>
        ),
        subtitle: content.earnHome.subheading,
      }}
      width={67 * 8}
      gap={16}
    >
      {poolsTransition((style, branchId) => (
        <a.div style={style}>
          <EarnPool branchId={branchId} />
        </a.div>
      ))}
    </Screen>
  );
}

function EarnPool({
  branchId,
}: {
  branchId: BranchId;
}) {
  const account = useAccount();
  const earnPosition = useEarnPosition(branchId, account.address ?? null);
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 16,
      })}
    >
      <Vault />
      <EarnPositionSummary
        branchId={branchId}
        earnPosition={earnPosition.data ?? null}
        linkToScreen
      />
    </div>
  );
}

function Vault() {
  return (
    <div
      className={css({
        position: "relative",
        display: "flex",
        flexDirection: "column",
        padding: "12px 16px",
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: "solid",
        width: "100%",
        userSelect: "none",
        background: "token(colors.infoSurface)",
        border: "1px solid token(colors.neutral100)",
      })}
    >
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 16,
          paddingBottom: 12,
          borderBottom: `1px solid token(colors.neutral100)`,
        })}
      >
        <div
          className={css({
            flexGrow: 0,
            flexShrink: 0,
            display: "flex",
          })}
        >
          <TokenIcon
            symbol={"bvUSD"}
            size={34}
          />
        </div>
        <div
          className={css({
            flexGrow: 1,
            display: "flex",
            justifyContent: "space-between",
          })}
        >
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
            })}
          >
            <div>
              sbvUSD
            </div>
            <div
              className={css({
                display: "flex",
                gap: 4,
                fontSize: 14,
                color: "contentAlt"
              })}
            >
              <div>TVL</div>
              <div>
                <Amount
                  fallback="-"
                  format="compact"
                  prefix="$"
                  value={1000000}
                />
              </div>
              <InfoTooltip heading="Total Value Locked (TVL)">
                Total amount of bvUSD deposited in the vault.
              </InfoTooltip>
            </div>
          </div>
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            })}
          >
            <div
              className={css({
                display: "flex",
                gap: 6,
              })}
            >
              <div
                className={css({
                  color: "contentAlt2",
                })}
              >
                APR
              </div>
              <div>
                <Amount
                  fallback="-%"
                  format="1z"
                  percentage
                  value={0.1}
                />
              </div>
              <InfoTooltip
                content={{
                  heading: "Current APR",
                  body: "The annualized rate this stability pool’s "
                    + "deposits earned over the last 24 hours.",
                  footerLink: {
                    label: "Check Dune for more details",
                    href: "https://dune.com/liquity/liquity-v2",
                  },
                }}
              />
            </div>
            <div
              className={css({
                display: "flex",
                gap: 4,
                fontSize: 14,
              })}
            >
              <div
                className={css({
                  color: "contentAlt2",
                })}
              >
                7d APR
              </div>
              <Amount
                fallback="-%"
                format="1z"
                percentage
                value={0.1}
              />
              <InfoTooltip
                content={{
                  heading: "APR (last 7 days)",
                  body: "The annualized percentage rate this stability pool’s "
                    + "deposits earned over the past 7 days.",
                  footerLink: {
                    label: "Check Dune for more details",
                    href: "https://dune.com/liquity/liquity-v2",
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>
      <div
        className={css({
          position: "relative",
          display: "flex",
          gap: 32,
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 12,
          height: 56,
          fontSize: 14,
        })}
      >
        <div
          className={css({
            display: "flex",
            gap: 32,
          })}
        >
          <div>
            <div
              className={css({
                color: "contentAlt",
              })}
            >
              Deposit
            </div>
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 8,
              })}
            >
              <div
                title={`1000000 bvUSD`}
                className={css({
                  display: "flex",
                  justifyContent: "flex-start",
                  alignItems: "center",
                  gap: 4,
                  height: 24,
                })}
              >
                <TokenIcon symbol="bvUSD" size="mini" title={null} />
              </div>
            </div>
          </div>
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            })}
          >
            <div
              className={css({
                color: "contentAlt",
              })}
            >
              Rewards
            </div>
            <div
              className={css({
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: 8,
                height: 24,
              })}
            >
              <TokenIcon symbol="bvUSD" size="mini" title={null} />
            </div>
          </div>
          {/* {active && (
            <div>
              <div
                style={{
                  color: `var(--fg-secondary-${active ? "active" : "inactive"})`,
                }}
              >
                Pool share
              </div>
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  height: 24,
                })}
              >
                <Amount percentage value={share} />
                {prevEarnPosition && (
                  <div
                    className={css({
                      display: "inline",
                      color: "contentAlt",
                      textDecoration: "line-through",
                    })}
                  >
                    <Amount percentage value={prevShare} />
                  </div>
                )}
              </div>
            </div>
          )} */}
        </div>
        <OpenLink
          active={true}
          path={`https://app.vaultcraft.io/`}
          title={`Deposit into the bvUSD vault`}
        />
      </div>
    </div>
  )
}
