import type { ReactNode } from "react";
import type { CollateralSymbol } from "@/src/types";

import { css } from "@/styled-system/css";
import { TokenIcon, IconExternal } from "@liquity2/uikit";
import Link from "next/link";
import Image from "next/image";

export type EcosystemPartnerId = 
  | "wsteth"
  | "reth"
  | "rseth"
  | "weeth"
  | "arb"
  | "comp"
  | "tbtc"
  | "liquity"
  | "summerstone"
  | "octane"
  | "sherlock"
  | "pooltogether";

const COLLATERAL_INFO: Record<CollateralSymbol, { name: string; url: string }> = {
  "ETH": { name: "Ethereum", url: "https://ethereum.org/" },
  "WETH": { name: "Wrapped Ether", url: "https://weth.io/" },
  "WSTETH": { name: "Lido", url: "https://lido.fi/" },
  "RETH": { name: "Rocket Pool", url: "https://rocketpool.net/" },
  "RSETH": { name: "Kelp DAO", url: "https://kelpdao.xyz/" },
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
    rseth: {
      title: COLLATERAL_INFO.RSETH.name,
      subtitle: "Liquid restaked token for DeFi",
      href: COLLATERAL_INFO.RSETH.url,
      symbol: "RSETH",
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
      symbol: "TBTC",
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
        padding: "12px 16px",
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: "solid",
        width: "100%",
        height: "100%",
        minHeight: 160,
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
          gap: 16,
          paddingBottom: 12,
          borderBottom: "1px solid token(colors.infoSurfaceBorder)",
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
                width: 34,
                height: 34,
                position: "relative",
                borderRadius: "50%",
                overflow: "hidden",
              })}
            >
              <Image
                src={logo}
                alt={String(title)}
                width={34}
                height={34}
                style={{ objectFit: "contain" }}
              />
            </div>
          ) : symbol ? (
            <TokenIcon symbol={symbol} size={34} />
          ) : (
            <div
              className={css({
                width: 34,
                height: 34,
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
                color: "token(colors.contentAlt)",
              })}
            >
              {subtitle}
            </div>
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
          height: 56,
          fontSize: 14,
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
        <IconExternal size={24} />
      </div>
    </Link>
  );
}
