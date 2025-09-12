"use client";

import type { CollateralSymbol } from "@/src/types";
import type { ReactNode } from "react";

import { useBreakpoint } from "@/src/breakpoints";
import { Amount } from "@/src/comps/Amount/Amount";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { Positions } from "@/src/comps/Positions/Positions";
import { FORKS_INFO } from "@/src/constants";
import content from "@/src/content";
import { DNUM_1 } from "@/src/dnum-utils";
import {
  getBranch,
  getBranches,
  getCollToken,
  getToken,
  useAverageInterestRate,
  useBranchDebt,
  useEarnPool,
} from "@/src/liquity-utils";
import { useSboldStats } from "@/src/sbold";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { IconBorrow, IconEarn, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import Image from "next/image";
import { useMemo, useState } from "react";
import { HomeTable } from "./HomeTable";
import { YieldSourceTable } from "./YieldSourceTable";

type ForkInfo = (typeof FORKS_INFO)[number];

export function HomeScreen() {
  const account = useAccount();

  const [compact, setCompact] = useState(false);
  useBreakpoint(({ medium }) => {
    setCompact(!medium);
  });

  return (
    <div
      className={css({
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        gap: {
          base: 40,
          medium: 40,
          large: 64,
        },
        width: "100%",
      })}
    >
      <Positions address={account.address ?? null} />
      <div
        className={css({
          display: "grid",
          gap: 24,
          gridTemplateColumns: {
            base: "1fr",
            large: "1fr 1fr",
          },
          gridTemplateAreas: {
            base: `
              "borrow"
              "earn"
              "yield"
            `,
            large: `
              "borrow earn"
              "borrow yield"
            `,
          },
        })}
      >
        <BorrowTable compact={compact} />
        <EarnTable compact={compact} />
        <YieldSourceTable compact={compact} />
      </div>
    </div>
  );
}

function BorrowTable({
  compact,
}: {
  compact: boolean;
}) {
  const columns: ReactNode[] = [
    "Collateral",
    <span
      key="avg-interest-rate"
      title="Average interest rate, per annum"
    >
      {compact ? "Rate" : "Avg rate, p.a."}
    </span>,
    <span
      key="max-ltv"
      title="Maximum Loan-to-Value ratio"
    >
      Max LTV
    </span>,
    <span
      key="total-debt"
      title="Total debt"
    >
      {compact ? "Debt" : "Total debt"}
    </span>,
  ];

  if (!compact) {
    columns.push(null);
  }

  return (
    <div className={css({ gridArea: "borrow" })}>
      <HomeTable
        title="Borrow BOLD against ETH and staked ETH"
        subtitle="You can adjust your loans, including your interest rate, at any time"
        icon={<IconBorrow />}
        columns={columns}
        rows={getBranches().map(({ symbol }) => (
          <BorrowingRow key={symbol} compact={compact} symbol={symbol} />
        ))}
      />
    </div>
  );
}

function EarnTable({
  compact,
}: {
  compact: boolean;
}) {
  const columns: ReactNode[] = [
    "Pool",
    <abbr
      key="apr1d"
      title="Annual Percentage Rate over the last 24 hours"
    >
      APR
    </abbr>,
    <abbr
      key="apr7d"
      title="Annual Percentage Rate over the last 7 days"
    >
      7d APR
    </abbr>,
    "Pool size",
  ];

  if (!compact) {
    columns.push(null);
  }

  return (
    <div
      className={css({
        gridArea: "earn",
      })}
    >
      <div
        className={css({
          position: "relative",
          zIndex: 2,
        })}
      >
        <HomeTable
          title={content.home.earnTable.title}
          subtitle={content.home.earnTable.subtitle}
          icon={<IconEarn />}
          columns={columns}
          rows={[
            ...getBranches(),
            { symbol: "SBOLD" as const },
          ].map(({ symbol }) => (
            <EarnRewardsRow
              key={symbol}
              compact={compact}
              symbol={symbol}
            />
          ))}
        />
      </div>
      <div
        className={css({
          position: "relative",
          zIndex: 1,
        })}
      >
        <ForksInfoDrawer />
      </div>
    </div>
  );
}

function ForksInfoDrawer() {
  const pickedForkIcons = useMemo(() => pickRandomForks(2), []);
  return (
    <div
      className={css({
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        marginTop: -20,
        height: 44 + 20,
        padding: "20px 16px 0",
        whiteSpace: "nowrap",
        background: "#F7F7FF",
        borderRadius: 8,
        userSelect: "none",
      })}
    >
      <div
        className={css({
          display: "flex",
          gap: 12,
        })}
      >
        <div
          className={css({
            flexShrink: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 0,
          })}
        >
          {pickedForkIcons.map(([name, icon], index) => (
            <div
              key={name}
              className={css({
                display: "grid",
                placeItems: "center",
                background: "white",
                borderRadius: "50%",
                width: 18,
                height: 18,
              })}
              style={{
                marginLeft: index > 0 ? -4 : 0,
              }}
            >
              <Image
                loading="eager"
                unoptimized
                alt={name}
                title={name}
                height={18}
                src={icon}
                width={18}
              />
            </div>
          ))}
        </div>
        <div
          className={css({
            display: "grid",
            fontSize: 14,
          })}
        >
          <span
            title={content.home.earnTable.forksInfo.titleAttr}
            className={css({
              overflow: "hidden",
              textOverflow: "ellipsis",
            })}
          >
            {content.home.earnTable.forksInfo.text}
          </span>
        </div>
      </div>
      <div
        className={css({
          display: "flex",
          alignItems: "center",
        })}
      >
        <LinkTextButton
          external
          href={content.home.earnTable.forksInfo.learnMore.url}
          label={content.home.earnTable.forksInfo.learnMore.label}
          title={content.home.earnTable.forksInfo.learnMore.title}
          className={css({
            fontSize: 14,
          })}
        >
          Learn more
        </LinkTextButton>
      </div>
    </div>
  );
}

function BorrowingRow({
  compact,
  symbol,
}: {
  compact: boolean;
  symbol: CollateralSymbol;
}) {
  const branch = getBranch(symbol);
  const collateral = getCollToken(branch.id);
  const avgInterestRate = useAverageInterestRate(branch.id);
  const branchDebt = useBranchDebt(branch.id);

  const maxLtv = collateral?.collateralRatio && dn.gt(collateral.collateralRatio, 0)
    ? dn.div(DNUM_1, collateral.collateralRatio)
    : null;

  return (
    <tr>
      <td>
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 8,
          })}
        >
          <TokenIcon symbol={symbol} size="mini" />
          <span>{collateral?.name}</span>
        </div>
      </td>
      <td>
        <Amount
          fallback="…"
          percentage
          value={avgInterestRate.data}
        />
      </td>
      <td>
        <Amount
          value={maxLtv}
          percentage
        />
      </td>
      <td>
        <Amount
          format="compact"
          prefix="$"
          fallback="…"
          value={branchDebt.data}
        />
      </td>
      {!compact && (
        <td>
          <div
            className={css({
              display: "flex",
              gap: 16,
              justifyContent: "flex-end",
            })}
          >
            <LinkTextButton
              href={`/borrow/${symbol.toLowerCase()}`}
              label={
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 14,
                  })}
                >
                  Borrow
                  <TokenIcon symbol="BOLD" size="mini" />
                </div>
              }
              title={`Borrow ${collateral?.name} from ${symbol}`}
            />
          </div>
        </td>
      )}
    </tr>
  );
}

function EarnRewardsRow({
  compact,
  symbol,
}: {
  compact: boolean;
  symbol: CollateralSymbol | "SBOLD";
}) {
  const branch = symbol === "SBOLD" ? null : getBranch(symbol);
  const token = getToken(symbol);
  const earnPool = useEarnPool(branch?.id ?? null);
  const sboldStats = useSboldStats();
  return (
    <tr>
      <td>
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 8,
          })}
        >
          <TokenIcon symbol={symbol} size="mini" />
          <span>{symbol === "SBOLD" ? "sBOLD by K3 Capital" : token?.name}</span>
        </div>
      </td>
      <td>
        <Amount
          fallback="…"
          percentage
          value={symbol === "SBOLD"
            ? sboldStats.data?.apr
            : earnPool.data?.apr}
        />
      </td>
      <td>
        <Amount
          fallback="…"
          percentage
          value={symbol === "SBOLD"
            ? sboldStats.data?.apr7d
            : earnPool.data?.apr7d}
        />
      </td>
      <td>
        <Amount
          fallback="…"
          format="compact"
          prefix="$"
          value={symbol === "SBOLD"
            ? sboldStats.data?.totalBold
            : earnPool.data?.totalDeposited}
        />
      </td>
      {!compact && (
        <td>
          <LinkTextButton
            href={`/earn/${symbol.toLowerCase()}`}
            label={
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 14,
                })}
              >
                Earn
                <TokenIcon.Group size="mini">
                  <TokenIcon symbol="BOLD" />
                  {symbol === "SBOLD"
                    ? (
                      <div
                        className={css({
                          width: 16,
                        })}
                      />
                    )
                    : <TokenIcon symbol={symbol} />}
                </TokenIcon.Group>
              </div>
            }
            title={`Earn BOLD with ${token?.name}`}
          />
        </td>
      )}
    </tr>
  );
}

function pickRandomForks(count: number): ForkInfo[] {
  const forks = [...FORKS_INFO];
  if (forks.length < count) {
    return forks;
  }
  const picked: ForkInfo[] = [];
  for (let i = 0; i < count; i++) {
    const [info] = forks.splice(
      Math.floor(Math.random() * forks.length),
      1,
    );
    if (info) picked.push(info);
  }
  return picked;
}
