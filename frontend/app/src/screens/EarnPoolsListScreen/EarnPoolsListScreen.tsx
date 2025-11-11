"use client";

import type { BranchId } from "@/src/types";

import { NBSP } from "@/src/characters";
import { useBreakpointName } from "@/src/breakpoints";
import { EarnPositionSummary } from "@/src/comps/EarnPositionSummary/EarnPositionSummary";
import { PartnerStrategySummary } from "@/src/comps/EarnPositionSummary/PartnerStrategySummary";
import { SboldPositionSummary } from "@/src/comps/EarnPositionSummary/SboldPositionSummary";
import { Screen } from "@/src/comps/Screen/Screen";
import { getBranches, useEarnPosition } from "@/src/liquity-utils";
import { WHITE_LABEL_CONFIG } from "@/src/white-label.config";
import { isSboldEnabled, useSboldPosition } from "@/src/sbold";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { TokenIcon } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";

type PoolId = BranchId | "sbold";
type EcosystemId = "steer" | "saga" | "oku" | "tellor" | "yield" | "statom";

export function EarnPoolsListScreen() {
  const branches = getBranches()
    // .filter((b) => b.symbol.toLowerCase() !== "tbtc"); // TODO: remove this once tBTC is supported
  const collSymbols = branches.map((b) => b.symbol);
  const breakpoint = useBreakpointName();
  const isMobile = breakpoint === "small";

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

  const ecosystemPartners: EcosystemId[] = ["steer", "saga", "oku", "tellor", "yield", "statom"];

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
    <>
      <div
        className={css({
          position: "relative",
          width: "100%",
          marginTop: -96,
          paddingTop: 96,
          marginBottom: -180,
        })}
      >
        <div
          className={`borrow-heading-background ${css({
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100vw",
            height: "100%",
            zIndex: -1,
            backgroundPosition: "center top",
            _after: {
              content: '""',
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "50%",
              background: "linear-gradient(to bottom, transparent, black)",
            },
          })}`}
        />
        
        <div
          className={css({
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 0 80px",
            minHeight: "420px",
            maxWidth: "1200px",
            margin: "0 auto",
            width: "100%",
          })}
        >
          <h1
            className={`font-audiowide ${css({
              color: "white",
              fontSize: { base: '28px', medium: '37px' },
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 0,
              lineHeight: 1.2,
            })}`}
          >
            Deposit{" "}
            <span
              className={css({
                display: "inline-flex",
                alignItems: "center",
                whiteSpace: "nowrap",
              })}
            >
              {WHITE_LABEL_CONFIG.tokens.mainToken.symbol}{NBSP}<TokenIcon symbol={WHITE_LABEL_CONFIG.tokens.mainToken.symbol} size={isMobile ? 32 : 46} />
            </span>
            <br />
            <span
              className={css({
                display: "inline-flex",
                alignItems: "center",
                whiteSpace: "nowrap",
                fontSize: { base: '17px', medium: '20px' },
                gap: "8px",
              })}
            >
              to earn rewards
              <TokenIcon.Group>
                {collSymbols.map((symbol) => (
                  <TokenIcon
                    key={symbol}
                    symbol={symbol}
                  />
                ))}
              </TokenIcon.Group>
            </span>
          </h1>
          <p
            className={css({
              color: "#FFF",
              fontSize: "17px",
              textAlign: "center",
              maxWidth: "600px",
              margin: "16px auto 0",
              lineHeight: "120%",
              fontWeight: 400,
              padding: '0 28px'
            })}
          >
            A ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} deposit in a stability pool earns rewards from the fees that users pay on their loans. Also, the ${WHITE_LABEL_CONFIG.tokens.mainToken.symbol} may be swapped to collateral in case the system needs to liquidate positions.{" "}
            <a
              href="https://docs.must.finance/docs/user-docs/must-and-earn"
              target="_blank"
              rel="noopener noreferrer"
              className={css({
                color: "#FFF",
                textDecoration: "underline",
                "&:hover": {
                  color: "#A189AB",
                },
              })}
            >
              Learn more
            </a>
          </p>
        </div>
      </div>

      <Screen
        width="100%"
        heading={null}
      >
      <div
        className={css({
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 16,
          paddingTop: 100,
          width: '100%',
          maxWidth: "536px",
          margin: "0 auto",
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
              medium: "repeat(3, 1fr)",
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
    </>
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
  const partners: EcosystemId[] = ["steer", "saga", "oku", "tellor", "yield", "statom"];
  
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
      {partners.map((partnerId) => {
        const logoPath = getPartnerLogoPath(partnerId);
        const isTokenIcon = ["statom"].includes(partnerId);
        
        if (isTokenIcon) {
          return (
            <div
              key={partnerId}
              className={css({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                borderRadius: "50%",
              })}
            >
              <TokenIcon symbol={logoPath.toUpperCase() as any} size={20} />
            </div>
          );
        }
        
        return (
          <div
            key={partnerId}
            className={css({
              width: 24,
              height: 24,
              borderRadius: "50%",
              overflow: "hidden",
            })}
            style={{
              background: partnerId === "oku" ? "black" : undefined,
            }}
          >
            <img
              src={logoPath}
              alt={partnerId}
              className={css({
                width: "100%",
                height: "100%",
                objectFit: "cover",
              })}
            />
          </div>
        );
      })}
    </div>
  );
}

function getPartnerLogoPath(partnerId: EcosystemId): string {
  const logos: Record<EcosystemId, string> = {
    steer: "/images/partners/steer.webp",
    saga: "/images/partners/saga.png",
    oku: "/images/partners/oku.svg",
    yield: "/images/partners/yieldfi.svg",
    statom: "statom",
    tellor: "/images/partners/tellor.svg",
  };
  return logos[partnerId];
}
