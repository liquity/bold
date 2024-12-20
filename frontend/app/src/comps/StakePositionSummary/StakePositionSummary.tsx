import type { PositionStake } from "@/src/types";

import { useAppear } from "@/src/anim-utils";
import { Amount } from "@/src/comps/Amount/Amount";
import { TagPreview } from "@/src/comps/TagPreview/TagPreview";
import { fmtnum } from "@/src/formatting";
import { useGovernanceUser } from "@/src/subgraph-hooks";
import { css } from "@/styled-system/css";
import { HFlex, IconStake, InfoTooltip, TokenIcon, useRaf } from "@liquity2/uikit";
import { a } from "@react-spring/web";
import * as dn from "dnum";
import { useRef } from "react";

export function StakePositionSummary({
  loadingState = "success",
  prevStakePosition,
  stakePosition,
  txPreviewMode = false,
}: {
  loadingState?: "error" | "pending" | "success";
  prevStakePosition?: null | PositionStake;
  stakePosition: null | PositionStake;
  txPreviewMode?: boolean;
}) {
  const govUser = useGovernanceUser(stakePosition?.owner ?? null);

  const appear = useAppear(loadingState === "success" && govUser.status === "success");

  // votingPower(t) = lqty * t - offset
  const votingPower = (timestamp: bigint) => {
    if (!govUser.data) {
      return null;
    }
    return (
      BigInt(govUser.data.stakedLQTY) * timestamp
      - BigInt(govUser.data.stakedOffset)
    );
  };

  const votingPowerRef = useRef<HTMLDivElement>(null);
  useRaf(() => {
    if (!votingPowerRef.current) {
      return;
    }

    const vp = votingPower(BigInt(Date.now()));
    if (vp === null) {
      votingPowerRef.current.innerHTML = "0";
      return;
    }

    const vpAsNum = Number(vp / 10n ** 18n) / 1000 / 1000;
    votingPowerRef.current.innerHTML = fmtnum(
      vpAsNum,
      { digits: 2, trailingZeros: true },
    );
  }, 60);

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
          borderBottom: "1px solid color-mix(in srgb, token(colors.secondary) 15%, transparent)",
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
                gap: 8,
                height: 40,
              })}
            >
              {appear((style, show) => (
                show && (
                  <a.div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      height: 40,
                    })}
                    style={style}
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
                  </a.div>
                )
              ))}
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

            {appear((style, show) => (
              show && (
                <a.div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  })}
                  style={style}
                >
                  <div
                    ref={votingPowerRef}
                    className={css({
                      fontVariantNumeric: "tabular-nums",
                    })}
                    style={{
                      color: txPreviewMode
                          && prevStakePosition
                          && stakePosition?.share
                          && !dn.eq(prevStakePosition.share, stakePosition.share)
                        ? "var(--update-color)"
                        : "inherit",
                    }}
                  >
                  </div>
                  {prevStakePosition && stakePosition && !dn.eq(prevStakePosition.share, stakePosition.share) && (
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
                  )}
                  <InfoTooltip>
                    Voting power is the total staked LQTY that you own.<br /> It is calculated as:<br />
                    <code>lqty * t - offset</code>
                  </InfoTooltip>
                </a.div>
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
