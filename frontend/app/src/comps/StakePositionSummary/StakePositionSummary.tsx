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
  return (
    <div
      className={css({
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        padding: 16,
        color: "positionContent",
        background: "position",
        borderRadius: 8,
        userSelect: "none",
        "--update-color": "token(colors.positiveAlt)",
      })}
    >
      {txPreviewMode && <TagPreview />}
      <div
        className={css({
          display: "flex",
          alignItems: "flex-start",
          flexDirection: "column",
          paddingBottom: 12,
          borderBottom: "1px solid #F0F3FE26",
        })}
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
              color: "token(colors.strongSurfaceContentAlt)",
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
              className={css({
                color: "token(colors.strongSurfaceContentAlt)",
              })}
            >
              Rewards
            </div>
            <HFlex
              gap={8}
            >
              <HFlex
                gap={4}
                className={css({
                  color: txPreviewMode
                      && stakePosition?.rewards.lusd
                      && dn.gt(stakePosition?.rewards.lusd, 0)
                    ? "var(--update-color)"
                    : "inherit",
                })}
              >
                <Amount
                  format="2diff"
                  value={stakePosition?.rewards.lusd ?? 0}
                />
                <TokenIcon symbol="LUSD" size="mini" />
              </HFlex>
              <HFlex
                gap={4}
                className={css({
                  color: txPreviewMode
                      && stakePosition?.rewards.eth
                      && dn.gt(stakePosition?.rewards.eth, 0)
                    ? "var(--update-color)"
                    : "inherit",
                })}
              >
                <Amount
                  format="2diff"
                  value={stakePosition?.rewards.eth ?? 0}
                />
                <TokenIcon symbol="ETH" size="mini" />
              </HFlex>
            </HFlex>
          </div>
          <div>
            <div
              className={css({
                color: "token(colors.strongSurfaceContentAlt)",
              })}
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
        </div>
      </div>
    </div>
  );
}
