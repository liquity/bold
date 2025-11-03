"use client";

import type { BranchId } from "@/src/types";

import { EarnPositionSummary } from "@/src/comps/EarnPositionSummary/EarnPositionSummary";
import { PartnerStrategySummary } from "@/src/comps/EarnPositionSummary/PartnerStrategySummary";
import { SboldPositionSummary } from "@/src/comps/EarnPositionSummary/SboldPositionSummary";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { getBranches, useEarnPosition } from "@/src/liquity-utils";
import { WHITE_LABEL_CONFIG } from "@/src/white-label.config";
import { isSboldEnabled, useSboldPosition } from "@/src/sbold";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { TokenIcon } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";

type PoolId = BranchId | "sbold";
type EcosystemId = "steer" | "saga" | "uniswap" | "tellor";

export function EarnPoolsListScreen() {
  const branches = getBranches()
    .filter((b) => b.symbol.toLowerCase() !== "tbtc"); // TODO: remove this once tBTC is supported
  const collSymbols = branches.map((b) => b.symbol);

  const pools: PoolId[] = branches.map((b) => b.branchId);

  if (isSboldEnabled()) {
    pools.push("sbold");
  }

  const poolsTransition = useTransition(pools, {
    from: { opacity: 0, transform: "scale(1.1) translateY(64px)" },
    enter: { opacity: 1, transform: "scale(1) translateY(0px)" },
    leave: { opacity: 0, transform: "scale(1) translateY(0px)" },
    trail: 80,
    config: {
      mass: 1,
      tension: 1800,
      friction: 140,
    },
  });

  const ecosystemPartners: EcosystemId[] = ["steer", "saga", "uniswap", "tellor"];

  const ecosystemTransition = useTransition(ecosystemPartners, {
    from: { opacity: 0, transform: "scale(1.1) translateY(64px)" },
    enter: { opacity: 1, transform: "scale(1) translateY(0px)" },
    leave: { opacity: 0, transform: "scale(1) translateY(0px)" },
    trail: 80,
    config: {
      mass: 1,
      tension: 1800,
      friction: 140,
    },
  });

  return (
    <Screen
      width="100%"
      heading={{
        title: (
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexFlow: "wrap",
              gap: "0 8px",
            })}
          >
            {content.earnHome.headline(
              <TokenIcon.Group>
                {[WHITE_LABEL_CONFIG.tokens.mainToken.symbol, ...collSymbols].map((symbol) => (
                  <TokenIcon
                    key={symbol}
                    symbol={symbol}
                  />
                ))}
              </TokenIcon.Group>,
              <TokenIcon symbol={WHITE_LABEL_CONFIG.tokens.mainToken.symbol} />,
            )}
          </div>
        ),
        subtitle: (
          <>
            {content.earnHome.subheading}{" "}
            <LinkTextButton
              label={content.earnHome.learnMore[1]}
              href={content.earnHome.learnMore[0]}
              external
            />
          </>
        ),
      }}
    >
      <div
        className={css({
          display: "grid",
          gridTemplateColumns: {
            base: "1fr",
            medium: "repeat(2, 1fr)",
          },
          gap: 16,
        })}
      >
        {poolsTransition((style, poolId) => (
          <a.div style={{ ...style, width: "100%" }}>
            {poolId === "sbold"
              ? <SboldPool />
              : <EarnPool branchId={poolId} />}
          </a.div>
        ))}
      </div>

      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 24,
          paddingTop: 48,
        })}
      >
        <header
          className={css({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexFlow: "wrap",
              gap: "0 8px",
              fontSize: {
                base: 20,
                medium: 28,
              },
            })}
          >
            Ecosystem
            <PartnerIconGroup />
          </div>
          <p
            className={css({
              textAlign: "center",
              color: "contentAlt",
            })}
          >
            Partner protocols integrated with Must
          </p>
        </header>

        <div
          className={css({
            display: "grid",
            gridTemplateColumns: {
              base: "1fr",
              medium: "repeat(4, 1fr)",
            },
            gap: 16,
          })}
        >
          {ecosystemTransition((style, partnerId) => (
            <a.div style={{ ...style, width: "100%" }}>
              <EcosystemPartner partnerId={partnerId} />
            </a.div>
          ))}
        </div>
      </div>
    </Screen>
  );
}

function EarnPool({
  branchId,
}: {
  branchId: BranchId;
}) {
  const account = useAccount();
  const earnPosition = useEarnPosition(branchId, account.address ?? null);
  return (
    <EarnPositionSummary
      branchId={branchId}
      earnPosition={earnPosition.data ?? null}
      linkToScreen
    />
  );
}

function SboldPool() {
  const account = useAccount();
  const sboldPosition = useSboldPosition(account.address ?? null);
  return (
    <SboldPositionSummary
      linkToScreen
      sboldPosition={sboldPosition.data ?? null}
    />
  );
}

function EcosystemPartner({ partnerId }: { partnerId: EcosystemId }) {
  return <PartnerStrategySummary strategy={partnerId} />;
}

function PartnerIconGroup() {
  const partners: EcosystemId[] = ["steer", "saga", "uniswap", "tellor"];
  
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        "& > *:not(:first-child)": {
          marginLeft: "-8px",
        },
      })}
    >
      {partners.map((partnerId) => (
        <div
          key={partnerId}
          className={css({
            width: 24,
            height: 24,
            borderRadius: "50%",
            overflow: "hidden",
            border: "2px solid black",
          })}
        >
          <img
            src={getPartnerLogoPath(partnerId)}
            alt={partnerId}
            className={css({
              width: "100%",
              height: "100%",
              objectFit: "cover",
            })}
          />
        </div>
      ))}
    </div>
  );
}

function getPartnerLogoPath(partnerId: EcosystemId): string {
  const logos: Record<EcosystemId, string> = {
    steer: "/images/partners/steer.webp",
    saga: "/images/partners/saga.png",
    uniswap: "/images/partners/uniswap.svg",
    tellor: "/images/partners/tellor.svg",
  };
  return logos[partnerId];
}
