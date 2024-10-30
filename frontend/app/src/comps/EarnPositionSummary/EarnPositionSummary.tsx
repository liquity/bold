import type { Address, CollateralSymbol } from "@liquity2/uikit";
import type { ReactNode } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { TagPreview } from "@/src/comps/TagPreview/TagPreview";
import { fmtnum } from "@/src/formatting";
import { getCollToken, useCollIndexFromSymbol, useEarnPool, useEarnPosition } from "@/src/liquity-utils";
import { css } from "@/styled-system/css";
import { HFlex, IconArrowRight, IconPlus, InfoTooltip, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";

export function EarnPositionSummary({
  address,
  collSymbol,
  linkToScreen,
  title,
  txPreviewMode,
}: {
  address?: Address;
  collSymbol: CollateralSymbol;
  linkToScreen?: boolean;
  title?: ReactNode;
  txPreviewMode?: boolean;
}) {
  const collIndex = useCollIndexFromSymbol(collSymbol);
  const collateral = getCollToken(collIndex);

  const earnPosition = useEarnPosition(collIndex, address ?? null);
  const earnPool = useEarnPool(collIndex ?? 0);

  const share = (
      earnPosition.data
      && earnPool.data.totalDeposited
      && dn.gt(earnPool.data.totalDeposited, 0)
    )
    ? dn.div(earnPosition.data.deposit, earnPool.data.totalDeposited)
    : dn.from(0, 18);

  const active = Boolean(earnPosition.data?.deposit && dn.gt(earnPosition.data.deposit, 0));

  return collateral && (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        padding: "12px 16px",
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: "solid",

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
        borderColor: active ? "transparent" : "var(--border-inactive)",
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
                  value={earnPool.data?.totalDeposited}
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
            {txPreviewMode ? <TagPreview /> : (
              <>
                <div>
                  <Amount
                    fallback="-%"
                    format="1z"
                    percentage
                    value={earnPool.data?.apr}
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
              </>
            )}
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
        {earnPosition.isLoading
          ? (
            <div
              className={css({
                color: "var(--fg-secondary-inactive)",
              })}
            >
              Fetching position…
            </div>
          )
          : (
            <div
              className={css({
                display: "flex",
                gap: 32,
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
                <div
                  className={css({
                    display: "flex",
                    justifyContent: "flex-start",
                    alignItems: "center",
                    gap: 4,
                    height: 24,
                  })}
                >
                  {active && <Amount value={earnPosition.data?.deposit} />}
                  <TokenIcon symbol="BOLD" size="mini" />
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
                  style={{
                    color: `var(--fg-secondary-${active ? "active" : "inactive"})`,
                  }}
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
                  {active
                    ? (
                      <>
                        <HFlex
                          gap={4}
                          title={`${fmtnum(earnPosition.data?.rewards.bold, "full")} BOLD`}
                          className={css({
                            fontVariantNumeric: "tabular-nums",
                          })}
                        >
                          {fmtnum(earnPosition.data?.rewards.bold)}
                          <TokenIcon symbol="BOLD" size="mini" title={null} />
                        </HFlex>
                        <HFlex gap={4}>
                          <Amount value={earnPosition.data?.rewards.coll} />
                          <TokenIcon symbol={collateral.symbol} size="mini" />
                        </HFlex>
                      </>
                    )
                    : (
                      <TokenIcon.Group size="mini">
                        <TokenIcon symbol="BOLD" />
                        <TokenIcon symbol={collateral.symbol} />
                      </TokenIcon.Group>
                    )}
                </div>
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
          )}

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
