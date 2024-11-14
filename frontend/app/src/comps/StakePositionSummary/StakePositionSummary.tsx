import type { PositionStake } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { TagPreview } from "@/src/comps/TagPreview/TagPreview";
import { fmtnum } from "@/src/formatting";
import { css } from "@/styled-system/css";
import { HFlex, IconStake, InfoTooltip, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";

export function StakePositionSummary({
  prevStakePosition,
  stakePosition,
  txPreviewMode = false,
}: {
  prevStakePosition?: null | PositionStake;
  stakePosition: null | PositionStake;
  txPreviewMode?: boolean;
}) {
  // We might want to use an inactive state like for the Earn positions.
  // For now, it's always active.
  const active = true;

  return (
    <div
      className={css({
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        padding: 16,
        borderRadius: 8,
        userSelect: "none",

        "--fg-primary-active": "token(colors.strongSurfaceContent)",
        "--fg-primary-inactive": "token(colors.content)",

        "--fg-secondary-active": "token(colors.strongSurfaceContentAlt)",
        "--fg-secondary-inactive": "token(colors.contentAlt)",

        "--border-active": "color-mix(in srgb, token(colors.secondary) 15%, transparent)",
        "--border-inactive": "token(colors.infoSurfaceBorder)",

        "--bg-active": "token(colors.strongSurface)",
        "--bg-inactive": "token(colors.infoSurface)",

        "--update-color": "token(colors.positiveAlt)",
      })}
      style={{
        color: `var(--fg-primary-${active ? "active" : "inactive"})`,
        background: `var(--bg-${active ? "active" : "inactive"})`,
        border: active ? 0 : "1px solid var(--border-inactive)",
      }}
    >
      {txPreviewMode && <TagPreview />}
      <div
        className={css({
          display: "flex",
          alignItems: "flex-start",
          flexDirection: "column",
          paddingBottom: 12,
        })}
        style={{
          borderBottom: `1px solid var(--border-${active ? "active" : "inactive"})`,
        }}
      >
        <h1
          title="LQTY Stake"
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 4,
            paddingBottom: 12,
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "strongSurfaceContent",
              fontSize: 12,
              textTransform: "uppercase",
            })}
          >
            <div
              className={css({
                display: "flex",
                color: "strongSurfaceContentAlt2",
              })}
            >
              <IconStake size={16} />
            </div>
            LQTY Stake
          </div>
        </h1>
        <div
          className={css({
            flexGrow: 0,
            flexShrink: 0,
            display: "flex",
          })}
        >
        </div>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              fontSize: 40,
              lineHeight: 1,
              gap: 12,
            })}
          >
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 12,
              })}
            >
              <div
                style={{
                  color: txPreviewMode
                      && prevStakePosition
                      && stakePosition?.deposit
                      && !dn.eq(prevStakePosition.deposit, stakePosition.deposit)
                    ? "var(--update-color)"
                    : "inherit",
                }}
              >
                <Amount
                  format={2}
                  value={stakePosition?.deposit ?? 0}
                />
              </div>
              <TokenIcon symbol="LQTY" size={32} />
              {prevStakePosition
                && stakePosition
                && !dn.eq(prevStakePosition.deposit, stakePosition.deposit)
                && (
                  <div
                    title={`${fmtnum(prevStakePosition.deposit, "full")} LQTY`}
                    className={css({
                      color: "contentAlt",
                      textDecoration: "line-through",
                    })}
                  >
                    {fmtnum(prevStakePosition.deposit, 2)}
                  </div>
                )}
            </div>
          </div>
          <div
            className={css({
              fontSize: 14,
              color: "var(--fg-secondary-active)",
            })}
          >
            Staked
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
                <HFlex
                  gap={8}
                  className={css({
                    color: txPreviewMode ? "var(--update-color)" : "inherit",
                  })}
                >
                  <HFlex gap={4}>
                    <Amount
                      format="2diff"
                      value={stakePosition?.rewards.lusd ?? 0}
                    />
                    <TokenIcon symbol="LUSD" size="mini" />
                  </HFlex>
                  <HFlex gap={4}>
                    <Amount
                      format="2diff"
                      value={stakePosition?.rewards.eth ?? 0}
                    />
                    <TokenIcon symbol="ETH" size="mini" />
                  </HFlex>
                </HFlex>
              )
              : (
                <TokenIcon.Group size="mini">
                  <TokenIcon symbol="LUSD" />
                  <TokenIcon symbol="ETH" />
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
                Voting power
              </div>
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                })}
              >
                <div
                  style={{
                    color: txPreviewMode
                        && prevStakePosition
                        && stakePosition?.share
                        && !dn.eq(prevStakePosition.share, stakePosition.share)
                      ? "var(--update-color)"
                      : "inherit",
                  }}
                >
                  <Amount
                    percentage
                    value={stakePosition?.share ?? 0}
                  />
                </div>
                {prevStakePosition && stakePosition && !dn.eq(prevStakePosition.share, stakePosition.share)
                  ? (
                    <div
                      className={css({
                        color: "contentAlt",
                        textDecoration: "line-through",
                      })}
                    >
                      <Amount
                        percentage
                        value={prevStakePosition?.share ?? 0}
                      />
                    </div>
                  )
                  : " of pool"}
                <InfoTooltip>
                  Voting power is the percentage of the total staked LQTY that you own.
                </InfoTooltip>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
