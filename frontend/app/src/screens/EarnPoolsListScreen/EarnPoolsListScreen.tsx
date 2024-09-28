"use client";

import type { Dnum, Entries, PositionEarn } from "@/src/types";
import type { CollateralSymbol, Token } from "@liquity2/uikit";
import type { ReactNode } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { ACCOUNT_POSITIONS, EARN_POOLS } from "@/src/demo-mode";
import { css } from "@/styled-system/css";
import { HFlex, IconArrowRight, IconPlus, InfoTooltip, TokenIcon, TOKENS_BY_SYMBOL } from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";

export function EarnPoolsListScreen() {
  const earnPositions = new Map<CollateralSymbol, PositionEarn>();

  for (const position of ACCOUNT_POSITIONS) {
    if (position.type === "earn") {
      earnPositions.set(position.collateral, position);
    }
  }

  return (
    <Screen
      title={
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          })}
        >
          {content.earnHome.headline(
            <TokenIcon.Group>
              {[
                "BOLD" as const,
                ...Object.keys(EARN_POOLS) as (keyof typeof EARN_POOLS)[],
              ].map((symbol) => (
                <TokenIcon
                  key={symbol}
                  symbol={symbol}
                />
              ))}
            </TokenIcon.Group>,
            <TokenIcon symbol="BOLD" />,
          )}
        </div>
      }
      subtitle={content.earnHome.subheading}
      width={67 * 8}
      gap={16}
    >
      {(Object.entries(EARN_POOLS) as Entries<typeof EARN_POOLS>).map(([symbol, pool]) => {
        const token = TOKENS_BY_SYMBOL[symbol];
        const { deposit, rewards } = earnPositions.get(symbol) ?? {};
        console.log(
          { deposit, rewards },
          earnPositions.get(symbol),
          earnPositions,
          symbol,
        );
        return (
          <Pool
            key={symbol}
            apr={pool.apr}
            deposit={deposit}
            path={`/earn/${symbol.toLowerCase()}`}
            rewards={[
              { amount: rewards?.bold ?? dn.from(0, 18), token: "BOLD" },
              { amount: rewards?.coll ?? dn.from(0, 18), token: symbol },
            ]}
            share={deposit && dn.gt(deposit, 0)
              ? dn.div(deposit, pool.boldQty)
              : dn.from(0, 18)}
            token={token}
            tvl={pool.boldQty}
          />
        );
      })}
    </Screen>
  );
}

function Pool({
  apr,
  deposit,
  path,
  share,
  token,
  rewards = [],
  tvl,
  customTitle,
}: {
  apr: Dnum;
  deposit?: Dnum;
  path: string;
  share: Dnum;
  token: Token;
  rewards?: {
    amount: Dnum;
    token: Token["symbol"];
  }[];
  tvl: Dnum;
  customTitle?: ReactNode;
}) {
  const active = deposit && dn.gt(deposit, 0);
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 16,
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
          alignItems: "center",
          gap: 16,
          paddingBottom: 16,
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
            <div>
              {customTitle || (
                `BOLD • ${token.name} stability pool`
              )}
            </div>
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
              <div>TVL</div>
              <div>
                <Amount value={tvl} format="compact" />
              </div>
              <InfoTooltip heading="Total Value Locked">
                test
              </InfoTooltip>
            </div>
          </div>
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            })}
          >
            <div>
              <Amount value={apr} format="1z" percentage />
            </div>
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
              <div>Current APR</div>
              <InfoTooltip heading="APR">
                test
              </InfoTooltip>
            </div>
          </div>
        </div>
      </div>
      <div
        className={css({
          position: "relative",
          display: "flex",
          alignItems: "flex-end",
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
          {active && (
            <div>
              <div
                style={{
                  color: `var(--fg-secondary-${active ? "active" : "inactive"})`,
                }}
              >
                Deposit
              </div>
              <HFlex gap={4}>
                <Amount value={deposit} />
                <TokenIcon symbol="BOLD" size="mini" />
              </HFlex>
            </div>
          )}
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
                  {rewards.map(({ amount, token }) => (
                    <HFlex key={token} gap={4}>
                      <Amount value={amount} />
                      <TokenIcon symbol={token} size="mini" />
                    </HFlex>
                  ))}
                </HFlex>
              )
              : (
                <TokenIcon.Group size="mini">
                  {rewards.map(({ token }) => (
                    <TokenIcon
                      key={token}
                      symbol={token}
                    />
                  ))}
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
                Pool share
              </div>
              <div>
                <Amount value={share} percentage />
              </div>
            </div>
          )}
        </div>

        <PoolLink
          active={active}
          path={path}
          title={`${active ? "Manage" : "Join"} ${token.name} pool`}
        />
      </div>
    </div>
  );
}

function PoolLink({
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
        inset: "-16px -16px -16px auto",
        display: "grid",
        placeItems: "center",
        padding: "0 16px",
        borderRadius: 8,
        transition: "scale 80ms",
        _focusVisible: {
          outline: "2px solid token(colors.focused)",
          outlineOffset: -2,
        },
        _active: {
          translate: "0 1px",
        },
        _hover: {
          scale: 1.05,
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
        {active ? <IconArrowRight size={24} /> : <IconPlus size={24} />}
      </div>
    </Link>
  );
}
