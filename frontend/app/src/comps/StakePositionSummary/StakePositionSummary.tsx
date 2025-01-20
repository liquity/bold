import type { PositionStake } from "@/src/types";
import type { ReactNode } from "react";

import { useAppear } from "@/src/anim-utils";
import { Amount } from "@/src/comps/Amount/Amount";
import { TagPreview } from "@/src/comps/TagPreview/TagPreview";
import { fmtnum } from "@/src/formatting";
import { useAccount } from "@/src/services/Ethereum";
import { useGovernanceStats, useGovernanceUser } from "@/src/subgraph-hooks";
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
  const govStats = useGovernanceStats();

  const account = useAccount();

  const appear = useAppear(
    account.isDisconnected || (
      loadingState === "success" && govUser.status === "success"
    ),
  );

  // totalVotingPower(t) = governanceStats.totalLQTYStaked * t - governanceStats.totalOffset
  const totalVotingPower = (t: bigint) => {
    if (!govStats.data) return null;
    const { totalLQTYStaked, totalOffset } = govStats.data;
    return BigInt(totalLQTYStaked) * t - BigInt(totalOffset);
  };

  // userVotingPower(t) = lqty * t - offset
  const userVotingPower = (t: bigint) => {
    if (!govUser.data) return null;
    const { stakedLQTY, stakedOffset } = govUser.data;
    return BigInt(stakedLQTY) * t - BigInt(stakedOffset);
  };

  const votingPowerRef = useRef<HTMLDivElement>(null);
  const votingPowerTooltipRef = useRef<HTMLDivElement>(null);

  useRaf(() => {
    if (!votingPowerRef.current) {
      return;
    }

    const now = Date.now();
    const nowInSeconds = BigInt(Math.floor(now / 1000));

    const userVp = userVotingPower(nowInSeconds);
    const userVpNext = userVotingPower(nowInSeconds + 1n);

    const totalVP = totalVotingPower(nowInSeconds);
    const totalVPNext = totalVotingPower(nowInSeconds + 1n);

    if (
      userVp === null
      || userVpNext === null
      || totalVP === null
      || totalVPNext === null
    ) {
      votingPowerRef.current.innerHTML = "−";
      votingPowerRef.current.title = "";
      return;
    }

    const liveProgress = (now % 1000) / 1000;
    const userVpLive = userVp + (userVpNext - userVp) * BigInt(Math.floor(liveProgress * 1000)) / 1000n;
    const totalVpLive = totalVP + (totalVPNext - totalVP) * BigInt(Math.floor(liveProgress * 1000)) / 1000n;

    // pctShare(t) = userVotingPower(t) / totalVotingPower(t)
    const share = dn.div([userVpLive, 18], [totalVpLive, 18]);

    const sharePct = dn.mul(share, 100);
    const sharePctFormatted = dn.format(sharePct, { digits: 12, trailingZeros: true }) + "%";
    const sharePctRoundedFormatted = fmtnum(sharePct, { digits: 2, trailingZeros: true }) + "%";

    votingPowerRef.current.innerHTML = sharePctRoundedFormatted;
    votingPowerRef.current.title = sharePctFormatted;

    if (votingPowerTooltipRef.current) {
      votingPowerTooltipRef.current.innerHTML = sharePctFormatted;
    }
  }, 30);

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
          {!txPreviewMode && (
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
                    {prevStakePosition
                      && stakePosition
                      && !dn.eq(prevStakePosition.share, stakePosition.share) && (
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
                    {!txPreviewMode && (
                      <InfoTooltip
                        content={{
                          heading: null,
                          body: (
                            <div
                              className={css({
                                display: "flex",
                                flexDirection: "column",
                                gap: 16,
                              })}
                            >
                              <p>
                                Voting power increases over time based on the total amount of LQTY staked.
                              </p>
                              {account.address && (
                                <div
                                  className={css({
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                  })}
                                >
                                  <TooltipRow
                                    label="Your voting power"
                                    value={<div ref={votingPowerTooltipRef} />}
                                  />
                                </div>
                              )}
                            </div>
                          ),
                          footerLink: {
                            href: "https://docs.liquity.org/v2-faq/lqty-staking",
                            label: "Learn more",
                          },
                        }}
                      />
                    )}
                  </a.div>
                )
              ))}
            </div>
          )}
          {!txPreviewMode && (
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
                Allocated
              </div>
              <div
                title={`${fmtnum([govUser.data?.allocatedLQTY ?? 0n, 18], "full")} LQTY`}
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                })}
              >
                <Amount
                  title={null}
                  format="compact"
                  value={[govUser.data?.allocatedLQTY ?? 0n, 18]}
                />
                <TokenIcon
                  title={null}
                  symbol="LQTY"
                  size="mini"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TooltipRow({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div
      className={css({
        display: "flex",
        justifyContent: "space-between",
        fontSize: 14,
        gap: 8,
      })}
    >
      <div
        className={css({
          color: "contentAlt",
          whiteSpace: "nowrap",
        })}
      >
        {label}
      </div>
      <div
        className={css({
          fontVariantNumeric: "tabular-nums",
          color: "content",
          userSelect: "none",
        })}
      >
        {value}
      </div>
    </div>
  );
}
