import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { IconExternal } from "@liquity2/uikit";
import Link from "next/link";

type PartnerId = "steer" | "saga" | "tellor";

const PARTNER_DATA: Record<PartnerId, {
  name: string;
  description: string;
  url: string;
  logo: string;
}> = {
  steer: {
    name: "Steer Protocol",
    description: "Automated liquidity management",
    url: "https://steer.finance",
    logo: "/images/partners/steer.webp",
  },
  saga: {
    name: "Uniswap V3",
    description: "Gasless AMM on Saga",
    url: "https://app.uniswap.org",
    logo: "/images/partners/uniswap.svg",
  },
  tellor: {
    name: "Tellor",
    description: "Decentralized oracle network",
    url: "https://tellor.io",
    logo: "/images/partners/tellor.svg",
  },
};

export function PartnerStrategySummary({
  strategy,
}: {
  strategy: PartnerId;
}) {
  const partner = PARTNER_DATA[strategy];

  return (
    <PartnerStrategySummaryBase
      action={{
        label: `Visit ${partner.name}`,
        href: partner.url,
        target: "_blank",
      }}
      active={false}
      partnerId={strategy}
      title={partner.name}
      subtitle={partner.description}
      infoItems={[]}
    />
  );
}

export function PartnerStrategySummaryBase({
  action,
  active,
  infoItems = [],
  poolInfo,
  partnerId,
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
  partnerId: PartnerId;
  subtitle?: ReactNode;
  title?: ReactNode;
}) {
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

        "--bg-active": "rgba(167, 147, 175, 0.08)",
        "--bg-inactive": "rgba(167, 147, 175, 0.08)",
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
          <PartnerIcon
            id={partnerId}
            logo={PARTNER_DATA[partnerId].logo}
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
          height: 56,
          fontSize: 14,
        })}
      >
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 8,
            small: {
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
            href={action.href}
            target={action.target}
            title={action.label}
          />
        )}
      </div>
    </div>
  );
}

function PartnerIcon({
  id,
  logo,
  size = 34,
}: {
  id: PartnerId;
  logo: string;
  size?: number;
}) {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        overflow: "hidden",
      })}
      style={{
        width: size,
        height: size,
      }}
    >
      {logo ? (
        <img
          src={logo}
          alt={id}
          className={css({
            width: "100%",
            height: "100%",
            objectFit: "cover",
          })}
        />
      ) : (
        <div
          className={css({
            fontWeight: 700,
            fontSize: 18,
          })}
        >
          {id.charAt(0).toUpperCase()}
        </div>
      )}
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
