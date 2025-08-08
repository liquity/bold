import type { PositionStake } from "@/src/types";
import type { ReactNode } from "react";

import { useAppear } from "@/src/anim-utils";
import { Amount } from "@/src/comps/Amount/Amount";
import { Tag } from "@/src/comps/Tag/Tag";
import { TagPreview } from "@/src/comps/TagPreview/TagPreview";
import content from "@/src/content";
import { dnum18 } from "@/src/dnum-utils";
import { fmtnum } from "@/src/formatting";
import { useGovernanceStats, useGovernanceUser, useVotingPower } from "@/src/liquity-governance";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { HFlex, IconStake, InfoTooltip, TokenIcon } from "@liquity2/uikit";
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
  const account = useAccount();

  const govStats = useGovernanceStats();
  const govUser = useGovernanceUser(stakePosition?.owner ?? null);

  const stakedLqty = dnum18(govUser.data?.stakedLQTY);
  const allocatedLqty = dnum18(govUser.data?.allocatedLQTY);
  const totalStakedLqty = dnum18(govStats.data?.totalLQTYStaked);

  const stakedShare = stakedLqty && totalStakedLqty && dn.gt(totalStakedLqty, 0)
    ? dn.div(stakedLqty, totalStakedLqty)
    : null;

  const appear = useAppear(
    !account.isConnected || (
      loadingState === "success" && govUser.status === "success"
    ),
  );

  const votingPowerRef = useRef<HTMLDivElement>(null);
  const votingPowerTooltipRef = useRef<HTMLDivElement>(null);

  useVotingPower(stakePosition?.owner ?? null, (share) => {
    if (!votingPowerRef.current) {
      return;
    }

    if (!share) {
      votingPowerRef.current.innerHTML = "−";
      votingPowerRef.current.title = "";
      return;
    }

    const shareFormatted = fmtnum(share, { preset: "12z", scale: 100 }) + "%";

    votingPowerRef.current.innerHTML = fmtnum(share, "pct2z") + "%";
    votingPowerRef.current.title = shareFormatted;

    if (votingPowerTooltipRef.current) {
      votingPowerTooltipRef.current.innerHTML = shareFormatted;
    }
  });

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
            display: "grid",
            gridTemplateColumns: "repeat(2, auto)",
            gap: 16,
            fontSize: 14,
            medium: {
              gridTemplateColumns: "repeat(4, auto)",
              gap: 32,
            },
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
                  whiteSpace: "nowrap",
                })}
              >
                Voting share
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
                    <Amount
                      percentage
                      value={stakedShare}
                      fallback="−"
                      suffix="%"
                    />
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
                                {content.stakeScreen.infoTooltips.votingShare}
                              </p>
                              {account.address && stakedLqty && (
                                <div
                                  className={css({
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                  })}
                                >
                                  <TooltipRow
                                    label="Your stake"
                                    value={
                                      <Amount
                                        format="2z"
                                        fixed
                                        value={stakedLqty}
                                        fallback="−"
                                        suffix=" LQTY"
                                        title={fmtnum(stakedLqty, {
                                          preset: "full",
                                          suffix: " LQTY",
                                        })}
                                      />
                                    }
                                  />
                                  <TooltipRow
                                    label="Total staked"
                                    value={
                                      <Amount
                                        fallback="−"
                                        fixed
                                        format="2z"
                                        suffix=" LQTY"
                                        title={fmtnum(totalStakedLqty, {
                                          preset: "full",
                                          suffix: " LQTY",
                                        })}
                                        value={totalStakedLqty}
                                      />
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          ),
                          footerLink: {
                            href: content.stakeScreen.learnMore[0],
                            label: content.stakeScreen.learnMore[1],
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
            <div>
              <div
                className={css({
                  color: "token(colors.strongSurfaceContentAlt)",
                  whiteSpace: "nowrap",
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
                    >
                    </div>
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
                                {content.stakeScreen.infoTooltips.votingPower}
                              </p>
                              {account.address && (govUser.data?.stakedLQTY ?? 0n) > 0n && (
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
                            href: content.stakeScreen.learnMore[0],
                            label: content.stakeScreen.learnMore[1],
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
                title={`${fmtnum(allocatedLqty ?? 0, "full")} LQTY allocated`}
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                })}
              >
                <Amount
                  title={null}
                  format="compact"
                  value={allocatedLqty ?? 0}
                />
                <TokenIcon
                  title={null}
                  symbol="LQTY"
                  size="mini"
                />
                {stakedLqty
                  && allocatedLqty
                  && dn.gt(allocatedLqty, 0)
                  && dn.lt(allocatedLqty, stakedLqty)
                  && (
                    <Tag
                      title="Partial allocation: some of your staked LQTY is not allocated"
                      size="mini"
                      css={{
                        color: "warningAltContent",
                        background: "warningAlt",
                        border: 0,
                        textTransform: "uppercase",
                      }}
                    >
                      partial
                    </Tag>
                  )}
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
