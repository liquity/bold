import type { PositionStake } from "@/src/types";
import type { ReactNode } from "react";

import { useAppear } from "@/src/anim-utils";
import { Amount } from "@/src/comps/Amount/Amount";
import { TagPreview } from "@/src/comps/TagPreview/TagPreview";
import { fmtnum } from "@/src/formatting";
import { useVotingPower } from "@/src/liquity-governance";
import { useGovernanceUser } from "@/src/subgraph-hooks";
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
  const govUser = useGovernanceUser(stakePosition?.owner ?? null);

  const account = useAccount();

  const appear = useAppear(
    account.isDisconnected || (
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
                                Your relative voting power changes over time, depending on your and others deposits of
                                LQTY.
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
