import type { Address, CollateralSymbol } from "@liquity2/uikit";
import type { ReactNode } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { useCollateral, useCollIndexFromSymbol } from "@/src/liquity-utils";
import { useEarnPosition, useStabilityPool } from "@/src/subgraph-hooks";
import { css } from "@/styled-system/css";
import { HFlex, IconArrowRight, IconPlus, InfoTooltip, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";

export function EarnPosition({
  address,
  collSymbol,
  linkToScreen,
  title,
}: {
  address?: Address;
  collSymbol: CollateralSymbol;
  linkToScreen?: boolean;
  title?: ReactNode;
}) {
  const collIndex = useCollIndexFromSymbol(collSymbol);
  const collateral = useCollateral(collIndex);

  const earnPosition = useEarnPosition(address, collIndex ?? undefined);
  const stabilityPool = useStabilityPool(collIndex ?? 0);

  const share = (
      earnPosition.data
      && stabilityPool.data
      && dn.gt(stabilityPool.data.totalDeposited, 0)
    )
    ? dn.div(earnPosition.data.deposit, stabilityPool.data.totalDeposited)
    : dn.from(0, 18);

  const active = Boolean(earnPosition.data?.deposit && dn.gt(earnPosition.data.deposit, 0));

  return collateral && (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        padding: "12px 16px",
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
          paddingBottom: 12,
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
              {title ?? `${collateral.name} Stability Pool`}
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
                  fallback="-"
                  format="compact"
                  prefix="$"
                  value={stabilityPool.data?.totalDeposited}
                />
              </div>
              <InfoTooltip heading="Total Value Locked (TVL)">
                Total amount of BOLD deposited in this stability pool.
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
                fallback="-%"
                format="1z"
                percentage
                value={stabilityPool.data?.apr}
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
              <InfoTooltip heading="Annual Percentage Rate (APR)">
                The annualized rate this stability pool’s deposits earned over the past 7 days.
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
          paddingTop: 12,
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
          <div>
            <div
              style={{
                color: `var(--fg-secondary-${active ? "active" : "inactive"})`,
              }}
            >
              Deposit
            </div>
            <HFlex gap={4} justifyContent="flex-start">
              {active && <Amount value={earnPosition.data?.deposit} />}
              <TokenIcon symbol="BOLD" size="mini" />
            </HFlex>
          </div>
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

        {linkToScreen && (
          <OpenLink
            active={active}
            path={`/earn/${collateral?.symbol.toLowerCase()}`}
            title={`${active ? "Manage" : "Deposit to"} ${collateral.name} pool`}
          />
        )}
      </div>
    </div>
  );
}

function OpenLink({
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
        inset: "0 -16px -12px auto",
        display: "grid",
        placeItems: "center",
        padding: "0 12px 0 24px",
        borderRadius: 10,
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
