import type { TokenSymbol } from "@/src/types";
import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { IconArrowRight, IconPlus, TokenIcon, TOKENS_BY_SYMBOL } from "@liquity2/uikit";
import Link from "next/link";

export function EarnPositionSummaryBase({
  action,
  active,
  infoItems = [],
  poolInfo,
  poolToken,
  subtitle,
  title,
}: {
  action?: null | {
    label: string;
    path: `/${string}`;
  };
  active: boolean;
  infoItems?: Array<{
    content: ReactNode;
    label: ReactNode;
  }>;
  poolInfo?: ReactNode;
  poolToken: TokenSymbol;
  subtitle?: ReactNode;
  title?: ReactNode;
}) {
  const token = TOKENS_BY_SYMBOL[poolToken];

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
          alignItems: "center",
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
          <TokenIcon
            symbol={token.symbol}
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
          height: {
            base: "auto",
            large: 56,
          },
          fontSize: 14,
        })}
      >
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 8,
            large: {
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
            path={action.path}
            title={action.label}
          />
        )}
      </div>
    </div>
  );
}

function OpenLink({
  active,
  path,
  title,
}: {
  active: boolean;
  path: string;
  title: string;
}) {
  return (
    <Link
      title={title}
      href={path}
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
          ? <IconArrowRight size={24} />
          : <IconPlus size={24} />}
      </div>
    </Link>
  );
}
