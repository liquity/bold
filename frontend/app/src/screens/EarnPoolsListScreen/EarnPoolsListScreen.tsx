"use client";

import type { CollateralSymbol } from "@liquity2/uikit";
import type { ReactNode } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { useCollateralContracts } from "@/src/contracts";
import { useCollateral, useCollIndexFromSymbol } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Ethereum";
import { useEarnPosition, useStabilityPool } from "@/src/subgraph-hooks";
import { css } from "@/styled-system/css";
import { HFlex, IconArrowRight, IconPlus, InfoTooltip, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";

export function EarnPoolsListScreen() {
  const collSymbols = useCollateralContracts().map((coll) => coll.symbol);
  return (
    <Screen
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
              {["BOLD" as const, ...collSymbols].map((symbol) => (
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
      subtitle={content.earnHome.subheading}
      width={67 * 8}
      gap={16}
    >
      {collSymbols.map((symbol) => (
        <Pool
          key={symbol}
          collSymbol={symbol}
        />
      ))}
    </Screen>
  );
}

function Pool({
  collSymbol,
  title,
}: {
  collSymbol: CollateralSymbol;
  title?: ReactNode;
}) {
  const account = useAccount();
  const collIndex = useCollIndexFromSymbol(collSymbol);
  const collateral = useCollateral(collIndex);

  const earnPosition = useEarnPosition(account.address, collIndex ?? undefined);
  const stabilityPool = useStabilityPool(collIndex ?? 0);

  const share = earnPosition.data && stabilityPool.data && dn.gt(stabilityPool.data.totalDeposited, 0)
    ? dn.div(earnPosition.data.deposit, stabilityPool.data.totalDeposited)
    : dn.from(0, 18);

  const active = Boolean(earnPosition.data?.deposit && dn.gt(earnPosition.data.deposit, 0));

  return collateral && (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 16,
        borderRadius: 8,
        "--fg-primary-active": "token(colors.strongSurfaceContent)",
        "--fg-primary-inactive": "token(colors.content)",

        "--fg-secondary-active": "token(colors.strongSurfaceContentAlt)",
        "--fg-secondary-inactive": "token(colors.contentAlt)",

        "--border-active": "color-mix(in srgb, token(colors.secondary) 15%, transparent)",
        "--border-inactive": "token(colors.infoSurfaceBorder)",

        "--bg-active": "token(colors.strongSurface)",
        "--bg-inactive": "token(colors.infoSurface)",
      })}
      style={{
        color: `var(--fg-primary-${active ? "active" : "inactive"})`,
        background: `var(--bg-${active ? "active" : "inactive"})`,
        border: active ? 0 : "1px solid var(--border-inactive)",
      }}
    >
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 16,
          paddingBottom: 16,
        })}
        style={{
          borderBottom: `1px solid var(--border-${active ? "active" : "inactive"})`,
        }}
      >
        <div
          className={css({
            flexGrow: 0,
            flexShrink: 0,
            display: "flex",
          })}
        >
          <TokenIcon
            symbol={collateral.symbol}
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
              {title ?? `BOLD • ${collateral.name} stability pool`}
            </div>
            <div
              className={css({
                display: "flex",
                gap: 4,
                fontSize: 14,
              })}
              style={{
                color: `var(--fg-secondary-${active ? "active" : "inactive"})`,
              }}
            >
              <div>TVL</div>
              <div>
                <Amount
                  format="compact"
                  prefix="$"
                  value={stabilityPool.data?.totalDeposited}
                />
              </div>
              <InfoTooltip heading="Total Value Locked">
                Total amount of BOLD deposited in the stability pool.
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
            <div>
              <Amount
                value={stabilityPool.data?.apr}
                format="1z"
                percentage
              />
            </div>
            <div
              className={css({
                display: "flex",
                gap: 4,
                fontSize: 14,
              })}
              style={{
                color: `var(--fg-secondary-${active ? "active" : "inactive"})`,
              }}
            >
              <div>Current APR</div>
              <InfoTooltip heading="APR">
                Annual percentage rate being earned by the {collateral.name} stability pool’s deposits over the past 7 days.
              </InfoTooltip>
            </div>
          </div>
        </div>
      </div>
      <div
        className={css({
          position: "relative",
          display: "flex",
          alignItems: "flex-end",
          gap: 32,
          justifyContent: "space-between",
        })}
      >
        <div
          className={css({
            display: "flex",
            gap: 32,
            fontSize: 14,
          })}
        >
          {active && (
            <div>
              <div
                style={{
                  color: `var(--fg-secondary-${active ? "active" : "inactive"})`,
                }}
              >
                Deposit
              </div>
              <HFlex gap={4}>
                <Amount value={earnPosition.data?.deposit} />
                <TokenIcon symbol="BOLD" size="mini" />
              </HFlex>
            </div>
          )}
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            })}
          >
            <div
              style={{
                color: `var(--fg-secondary-${active ? "active" : "inactive"})`,
              }}
            >
              Rewards
            </div>
            {active
              ? (
                <HFlex>
                  <HFlex gap={4}>
                    <Amount value={earnPosition.data?.rewards.bold} />
                    <TokenIcon symbol="BOLD" size="mini" />
                  </HFlex>
                  <HFlex gap={4}>
                    <Amount value={earnPosition.data?.rewards.coll} />
                    <TokenIcon symbol={collateral.symbol} size="mini" />
                  </HFlex>
                </HFlex>
              )
              : (
                <TokenIcon.Group size="mini">
                  <TokenIcon symbol="BOLD" />
                  <TokenIcon symbol={collateral.symbol} />
                </TokenIcon.Group>
              )}
          </div>
          {active && (
            <div>
              <div
                style={{
                  color: `var(--fg-secondary-${active ? "active" : "inactive"})`,
                }}
              >
                Pool share
              </div>
              <div>
                <Amount percentage value={share} />
              </div>
            </div>
          )}
        </div>

        <PoolLink
          active={active}
          path={`/earn/${collateral?.symbol.toLowerCase()}`}
          title={`${active ? "Manage" : "Join"} ${collateral.name} pool`}
        />
      </div>
    </div>
  );
}

function PoolLink({
  active,
  path,
  title,
}: {
  active: boolean;
  path: string;
  title: string;
}) {
  return (
    <Link
      title={title}
      href={path}
      className={css({
        position: "absolute",
        inset: "-16px -16px -16px auto",
        display: "grid",
        placeItems: "center",
        padding: "0 16px",
        borderRadius: 8,
        transition: "scale 80ms",
        _focusVisible: {
          outline: "2px solid token(colors.focused)",
          outlineOffset: -2,
        },
        _active: {
          translate: "0 1px",
        },
        _hover: {
          scale: 1.05,
        },
      })}
    >
      <div
        className={css({
          display: "grid",
          placeItems: "center",
          width: 34,
          height: 34,
          color: "accentContent",
          background: "accent",
          borderRadius: "50%",
        })}
      >
        {active ? <IconArrowRight size={24} /> : <IconPlus size={24} />}
      </div>
    </Link>
  );
}
