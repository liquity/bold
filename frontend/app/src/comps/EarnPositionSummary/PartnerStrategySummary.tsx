import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { StrategyIcon, STRATEGIES_BY_ID, StrategyId, IconExternal } from "@liquity2/uikit";
import Link from "next/link";

export function PartnerStrategySummary({
  strategy,
}: {
  strategy: StrategyId;
}) {
  const strategyContent: Record<StrategyId, {
    title: string;
    subtitle: string;
    href: string;
    infoItems: Array<{
      label: string;
      content: ReactNode;
    }>;
  }> = {
    balancer: {
      title: "Balancer V3",
      subtitle: "AMM stable pool with USND/USDC liquidity",
      href: `https://balancer.fi/pools/arbitrum/v3/0xc11d4777d0bcc257bba293b90522f5d6bd875228`,
      infoItems: [],
    },
    bunni: {
      title: "Bunni",
      subtitle: "Rehypothecation DEX built on Uniswap v4 with USND liquidity",
      href: `https://bunni.xyz/explore/pools/arbitrum/0x75c55eda2c37c47eaf1db8b500171f72f23dc5b16404e904866a6ad1b3a3e537`,
      infoItems: [],
    },
    camelot: {
      title: "Camelot",
      subtitle: "The Arbitrum native DEX with ETH/USND liquidity",
      href: `https://app.camelot.exchange/pools/0xA20723963Fb33297a3F5491831742f9B63EFe4f2`,
      infoItems: [],
    },
    spectra: {
      title: "Spectra",
      subtitle: "Lock in fixed rates on USND and trade yield tokens for yUSND",
      href: `https://app.spectra.finance/pools/arb:0xdbfdad05d2d280195331582516813358f41d1cc4`,
      infoItems: [],
    },
    teller: {
      title: "Teller",
      subtitle: "Lending/borrowing protocol with USND to lend and earn yield",
      href: `https://app.teller.org/arbitrum-one/lend?assetCategory=0x4ecf61a6c2fab8a047ceb3b3b263b401763e9d49&assetTab=pools`,
      infoItems: [],
    },
  };

  return (
    <PartnerStrategySummaryBase
      action={{
        label: "Deposit to the pool",
        href: strategyContent[strategy].href,
        target: "_blank",
      }}
      active={false}
      strategyId={strategy}
      title={strategyContent[strategy].title}
      subtitle={strategyContent[strategy].subtitle}
      infoItems={[
        // {
        //   label: "Deposit",
        //   content: (
        //     <>
        //       <div
        //         title={active
        //           ? `${fmtnum(yusndPosition?.yusnd, "full")} yUSND`
        //           : undefined}
        //         className={css({
        //           display: "flex",
        //           justifyContent: "flex-start",
        //           alignItems: "center",
        //           gap: 4,
        //           height: 24,
        //         })}
        //       >
        //         {active && fmtnum(yusndPosition?.yusnd)}
        //         <TokenIcon symbol="USND" size="mini" title={null} />
        //       </div>
        //       {prevYusndPosition && (
        //         <div
        //           title={`${fmtnum(prevYusndPosition.yusnd, "full")} yUSND`}
        //           className={css({
        //             display: "flex",
        //             justifyContent: "flex-start",
        //             alignItems: "center",
        //             gap: 4,
        //             height: 24,
        //             color: "contentAlt",
        //             textDecoration: "line-through",
        //           })}
        //         >
        //           {fmtnum(prevYusndPosition.usnd)}
        //           <TokenIcon symbol="USND" size="mini" title={null} />
        //         </div>
        //       )}
        //     </>
        //   ),
        // },
      ].filter((item) => item !== null)}
    />
  );
}

export function PartnerStrategySummaryBase({
  action,
  active,
  infoItems = [],
  poolInfo,
  strategyId,
  subtitle,
  title,
}: {
  action?: null | {
    label: string;
    href: string;
    target: "_blank" | "_self" | "_parent" | "_top";
  };
  active: boolean;
  infoItems?: Array<{
    content: ReactNode;
    label: ReactNode;
  }>;
  poolInfo?: ReactNode;
  strategyId: StrategyId;
  subtitle?: ReactNode;
  title?: ReactNode;
}) {
  const strategy = STRATEGIES_BY_ID[strategyId];

  return (
    <div
      className={css({
        position: "relative",
        display: "flex",
        flexDirection: "column",
        padding: "12px 16px",
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: "solid",
        width: "100%",
        userSelect: "none",

        "--fg-primary-active": "token(colors.positionContent)",
        "--fg-primary-inactive": "token(colors.content)",

        "--fg-secondary-active": "token(colors.positionContentAlt)",
        "--fg-secondary-inactive": "token(colors.contentAlt)",

        "--border-active": "color-mix(in srgb, token(colors.secondary) 15%, transparent)",
        "--border-inactive": "token(colors.infoSurfaceBorder)",

        "--bg-active": "token(colors.position)",
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
          alignItems: "start",
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
          <StrategyIcon
            id={strategy.id}
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
            <div>{title}</div>
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
              {subtitle}
            </div>
          </div>
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            })}
          >
            {poolInfo}
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
          // height: {
          //   base: "auto",
          //   large: 56,
          // },
          height: 56,
          fontSize: 14,
        })}
      >
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 8,
            small: { // prev: large
              flexDirection: "row",
              gap: 32,
            },
          })}
        >
          {infoItems.map((item) => (
            <div key={String(item.label)}>
              <div
                style={{
                  color: `var(--fg-secondary-${active ? "active" : "inactive"})`,
                }}
              >
                {item.label}
              </div>
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                })}
              >
                {item.content}
              </div>
            </div>
          ))}
        </div>

        {action && (
          <OpenLink
            active={active}
            href={action.href}
            target={action.target}
            title={action.label}
          />
        )}
      </div>
    </div>
  );
}

function OpenLink({
  active,
  href,
  target,
  title,
}: {
  active: boolean;
  href: string;
  target: "_blank" | "_self" | "_parent" | "_top";
  title: string;
}) {
  return (
    <Link
      title={title}
      href={href}
      target={target}
      className={css({
        position: "absolute",
        inset: "0 -16px -12px auto",
        display: "grid",
        placeItems: {
          base: "end center",
          large: "center",
        },
        padding: {
          base: "16px 12px",
          large: "0 12px 0 24px",
        },
        borderRadius: 8,
        _focusVisible: {
          outline: "2px solid token(colors.focused)",
          outlineOffset: -2,
        },
        _active: {
          translate: "0 1px",
        },

        "& > div": {
          transformOrigin: "50% 50%",
          transition: "scale 80ms",
        },
        _hover: {
          "& > div": {
            scale: 1.05,
          },
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
        {active
          ? <IconExternal size={24} />
          : <IconExternal size={24} />}
      </div>
    </Link>
  );
}
