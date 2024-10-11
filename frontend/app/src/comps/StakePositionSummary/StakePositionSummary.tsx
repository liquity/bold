import type { Address } from "@liquity2/uikit";

import { Amount } from "@/src/comps/Amount/Amount";
import { useProtocolContract } from "@/src/contracts";
import { dnum18 } from "@/src/dnum-utils";
import { css } from "@/styled-system/css";
import { HFlex, IconStake, InfoTooltip, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import { useReadContracts } from "wagmi";

export function StakePositionSummary({
  address,
}: {
  address?: Address;
}) {
  const active = true;
  const LqtyStaking = useProtocolContract("LqtyStaking");

  const {
    data: {
      stake,
      totalStaked,
    } = {
      stake: dn.from(0),
      totalStaked: dn.from(0),
    },
  } = useReadContracts({
    contracts: [
      {
        abi: LqtyStaking.abi,
        address: LqtyStaking.address,
        functionName: "stakes",
        args: [address ?? "0x"],
      },
      {
        abi: LqtyStaking.abi,
        address: LqtyStaking.address,
        functionName: "totalLQTYStaked",
      },
    ],
    query: {
      refetchInterval: 10_000,
      select: ([stake, totalStaked]) => ({
        stake: dnum18(stake),
        totalStaked: dnum18(totalStaked),
      }),
    },
    allowFailure: false,
  });

  const share = dn.gt(totalStaked, 0)
    ? dn.div(stake, totalStaked)
    : dn.from(0);

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
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
              userSelect: "none",
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
                userSelect: "none",
              })}
            >
              <Amount value={stake} />
              <TokenIcon symbol="LQTY" size={32} />
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
                <HFlex>
                  <HFlex gap={4}>
                    <Amount
                      format="2diff"
                      value={0}
                    />
                    <TokenIcon symbol="LUSD" size="mini" />
                  </HFlex>
                  <HFlex gap={4}>
                    <Amount
                      format="2diff"
                      value={0}
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
                <Amount percentage value={share} /> of pool
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
