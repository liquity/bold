"use client";

import type { CollateralSymbol } from "@/src/types";
import type { ReactNode } from "react";

import { useBreakpoint } from "@/src/breakpoints";
import { Amount } from "@/src/comps/Amount/Amount";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { Positions } from "@/src/comps/Positions/Positions";
import { DNUM_1 } from "@/src/dnum-utils";
import {
  getBranch,
  getBranches,
  getCollToken,
  useAverageInterestRate,
  useBranchDebt,
  useEarnPool,
} from "@/src/liquity-utils";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { IconBorrow, IconEarn, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import { useState } from "react";
import { HomeTable } from "./HomeTable";

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
        })}
      >
        <BorrowTable compact={compact} />
        <EarnTable compact={compact} />
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
    <span title="Average interest rate, per annum">
      {compact ? "Rate" : "Avg rate, p.a."}
    </span>,
    <span title="Maximum Loan-to-Value ratio">
      Max LTV
    </span>,
    <span title="Total debt">
      {compact ? "Debt" : "Total debt"}
    </span>,
  ];

  if (!compact) {
    columns.push(null);
  }

  return (
    <HomeTable
      title="Borrow BOLD against ETH and staked ETH"
      subtitle="You can adjust your loans, including your interest rate, at any time"
      icon={<IconBorrow />}
      columns={columns}
      rows={getBranches().map(({ symbol }) => (
        <BorrowingRow
          key={symbol}
          compact={compact}
          symbol={symbol}
        />
      ))}
    />
  );
}

function EarnTable({
  compact,
}: {
  compact: boolean;
}) {
  const columns: ReactNode[] = [
    "Pool",
    <abbr title="Annual Percentage Rate over the last 24 hours">APR</abbr>,
    <abbr title="Annual Percentage Rate over the last 7 days">
      7d APR
    </abbr>,
    "Pool size",
  ];

  if (!compact) {
    columns.push(null);
  }

  return (
    <HomeTable
      title="Earn rewards with BOLD"
      subtitle="Earn BOLD & (staked) ETH rewards by putting your BOLD in a stability pool"
      icon={<IconEarn />}
      columns={columns}
      rows={getBranches().map(({ symbol }) => (
        <EarnRewardsRow
          key={symbol}
          compact={compact}
          symbol={symbol}
        />
      ))}
    />
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
  symbol: CollateralSymbol;
}) {
  const branch = getBranch(symbol);
  const collateral = getCollToken(branch.id);
  const earnPool = useEarnPool(branch.id);
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
          value={earnPool.data?.apr}
        />
      </td>
      <td>
        <Amount
          fallback="…"
          percentage
          value={earnPool.data?.apr7d}
        />
      </td>
      <td>
        <Amount
          fallback="…"
          format="compact"
          prefix="$"
          value={earnPool.data?.totalDeposited}
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
                  <TokenIcon symbol={symbol} />
                </TokenIcon.Group>
              </div>
            }
            title={`Earn BOLD with ${collateral?.name}`}
          />
        </td>
      )}
    </tr>
  );
}
