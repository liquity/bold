import type { ReactNode } from "react";
import type { CollateralSymbol } from "@/src/types";

import { css } from "@/styled-system/css";
import { TokenIcon, IconExternal } from "@liquity2/uikit";
import Link from "next/link";
import Image from "next/image";

type EcosystemCollateralSymbol = Exclude<CollateralSymbol, "RSETH">;

export type EcosystemPartnerId = 
  | "wsteth"
  | "reth"
  | "weeth"
  | "arb"
  | "comp"
  | "tbtc"
  | "liquity"
  | "summerstone"
  | "octane"
  | "sherlock"
  | "pooltogether"
  | "flowstate"
  | "paladin"
  | "balancer"
  | "spectra"
  | "privacypools"
  | "aura";

const COLLATERAL_INFO: Record<EcosystemCollateralSymbol, { name: string; url: string }> = {
  "ETH": { name: "Ethereum", url: "https://ethereum.org/" },
  "WETH": { name: "Wrapped Ether", url: "https://weth.io/" },
  "WSTETH": { name: "Lido", url: "https://lido.fi/" },
  "RETH": { name: "Rocket Pool", url: "https://rocketpool.net/" },
  "WEETH": { name: "ether.fi", url: "https://www.ether.fi/" },
  "ARB": { name: "Arbitrum", url: "https://arbitrum.io/" },
  "COMP": { name: "Compound", url: "https://compound.finance/" },
  "TBTC": { name: "Threshold Network", url: "https://threshold.network/" },
};

export function EcosystemPartnerSummary({
  partnerId,
}: {
  partnerId: EcosystemPartnerId;
}) {
  const partnerContent: Record<EcosystemPartnerId, {
    title: string;
    subtitle: string;
    href: string;
    logo?: string;
    symbol?: CollateralSymbol;
  }> = {
    wsteth: {
      title: COLLATERAL_INFO.WSTETH.name,
      subtitle: "Liquid staking protocol for Ethereum",
      href: COLLATERAL_INFO.WSTETH.url,
      symbol: "WSTETH",
    },
    reth: {
      title: COLLATERAL_INFO.RETH.name,
      subtitle: "Decentralized Ethereum staking protocol",
      href: COLLATERAL_INFO.RETH.url,
      symbol: "RETH",
    },
    weeth: {
      title: COLLATERAL_INFO.WEETH.name,
      subtitle: "Restaking protocol for Ethereum",
      href: COLLATERAL_INFO.WEETH.url,
      symbol: "WEETH",
    },
    arb: {
      title: COLLATERAL_INFO.ARB.name,
      subtitle: "Leading Ethereum Layer 2 scaling solution",
      href: COLLATERAL_INFO.ARB.url,
      symbol: "ARB",
    },
    comp: {
      title: COLLATERAL_INFO.COMP.name,
      subtitle: "Autonomous interest rate protocol",
      href: COLLATERAL_INFO.COMP.url,
      symbol: "COMP",
    },
    tbtc: {
      title: COLLATERAL_INFO.TBTC.name,
      subtitle: "Decentralized bridge for Bitcoin to Ethereum",
      href: COLLATERAL_INFO.TBTC.url,
      logo: "/images/ecosystem/tbtc.png",
    },
    liquity: {
      title: "Liquity",
      subtitle: "Interest-free borrowing protocol",
      href: "https://liquity.org/",
      logo: "/images/ecosystem/liquity.png",
    },
    summerstone: {
      title: "Summerstone",
      subtitle: "Tokenized real-world asset platform",
      href: "https://summerstone.xyz/",
      logo: "/images/ecosystem/summerstone.png",
    },
    octane: {
      title: "Octane",
      subtitle: "Security and auditing partner",
      href: "https://octane.security/",
      logo: "/images/ecosystem/octane.jpeg",
    },
    sherlock: {
      title: "Sherlock",
      subtitle: "Protocol insurance and security audits",
      href: "https://www.sherlock.xyz/",
      logo: "/images/ecosystem/sherlock.jpeg",
    },
    pooltogether: {
      title: "PoolTogether",
      subtitle: "No-loss prize savings protocol",
      href: "https://pooltogether.com/",
      logo: "/images/ecosystem/pooltogether.jpeg",
    },
    flowstate: {
      title: "Flow State",
      subtitle: "Streaming funding for sustaining & rewarding impact work",
      href: "https://flowstate.network/",
      logo: "/images/ecosystem/flowstate.png",
    },
    paladin: {
      title: "Paladin",
      subtitle: "Governance incentives marketplace for DeFi protocols",
      href: "https://quest.paladin.vote/",
      logo: "/images/ecosystem/paladin.png",
    },
    balancer: {
      title: "Balancer",
      subtitle: "Programmable liquidity protocol for DeFi",
      href: "https://balancer.fi/pools/arbitrum/v3/0x483bc7fe92fc392305dd97d4d3363e0e0a7f144d",
      logo: "/images/ecosystem/balancer.svg",
    },
    spectra: {
      title: "Spectra",
      subtitle: "Interest rate derivatives and yield trading protocol",
      href: "https://app.spectra.finance/pools/arb:0xdbfdad05d2d280195331582516813358f41d1cc4",
      logo: "/images/ecosystem/spectra.jpeg",
    },
    privacypools: {
      title: "Privacy Pools",
      subtitle: "Compliant private transactions on Ethereum",
      href: "https://privacypools.com/",
      logo: "/images/ecosystem/privacypools.png",
    },
    aura: {
      title: "Aura Finance",
      subtitle: "DeFi's Yield & Liquidity Hub powered by Balancer",
      href: "https://aura.finance/",
      logo: "/images/ecosystem/aura.png",
    },
  };

  const partner = partnerContent[partnerId];

  return (
    <EcosystemPartnerSummaryBase
      action={{
        label: "Visit website",
        href: partner.href,
        target: "_blank",
      }}
      title={partner.title}
      subtitle={partner.subtitle}
      logo={partner.logo}
      symbol={partner.symbol}
    />
  );
}

export function EcosystemPartnerSummaryBase({
  action,
  logo,
  symbol,
  subtitle,
  title,
}: {
  action?: null | {
    label: string;
    href: string;
    target: "_blank" | "_self" | "_parent" | "_top";
  };
  logo?: string;
  symbol?: CollateralSymbol;
  subtitle?: ReactNode;
  title?: ReactNode;
}) {
  return (
    <div
      className={css({
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: "solid",
        width: "100%",
        height: 140,
        userSelect: "none",
        borderColor: "token(colors.infoSurfaceBorder)",
        background: "token(colors.infoSurface)",
        color: "token(colors.content)",
      })}
    >
      <div
        className={css({
          display: "flex",
          alignItems: "start",
          gap: 12,
        })}
      >
        <div
          className={css({
            flexGrow: 0,
            flexShrink: 0,
            display: "flex",
          })}
        >
          {logo ? (
            <div
              className={css({
                width: 40,
                height: 40,
                position: "relative",
                borderRadius: "50%",
                overflow: "hidden",
              })}
            >
              <Image
                src={logo}
                alt={String(title)}
                width={40}
                height={40}
                style={{ objectFit: "contain" }}
              />
            </div>
          ) : symbol ? (
            <TokenIcon symbol={symbol} size={40} />
          ) : (
            <div
              className={css({
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "token(colors.secondary)",
              })}
            />
          )}
        </div>
        <div
          className={css({
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 0,
          })}
        >
          <div
            className={css({
              fontSize: 16,
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            })}
          >
            {title}
          </div>
          <div
            style={{ WebkitBoxOrient: "vertical" }}
            className={css({
              fontSize: 13,
              lineHeight: 1.3,
              color: "token(colors.contentAlt)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              // WebkitBoxOrient: "vertical",
              overflow: "hidden",
            })}
          >
            {subtitle}
          </div>
        </div>
      </div>
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
        })}
      >
        {action && (
          <OpenLink
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
  href,
  target,
  title,
}: {
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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 34,
        height: 34,
        borderRadius: "50%",
        color: "accentContent",
        background: "accent",
        transition: "all 80ms",
        _focusVisible: {
          outline: "2px solid token(colors.focused)",
          outlineOffset: 2,
        },
        _hover: {
          transform: "scale(1.05)",
        },
        _active: {
          transform: "scale(0.98) translateY(1px)",
        },
      })}
    >
      <IconExternal size={20} />
    </Link>
  );
}
