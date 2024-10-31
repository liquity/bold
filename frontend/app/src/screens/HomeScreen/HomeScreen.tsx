"use client";

import type { CollateralSymbol } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { Positions } from "@/src/comps/Positions/Positions";
import { getContracts } from "@/src/contracts";
import { DNUM_1 } from "@/src/dnum-utils";
import { getCollToken, useAverageInterestRate, useCollIndexFromSymbol, useEarnPool } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Ethereum";
import { css } from "@/styled-system/css";
import { AnchorTextButton, IconBorrow, IconEarn, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";
import { HomeTable } from "./HomeTable";

export function HomeScreen() {
  const account = useAccount();

  const { collaterals } = getContracts();
  const collSymbols = collaterals.map((coll) => coll.symbol);

  return (
    <div
      className={css({
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        gap: 64,
        width: "100%",
      })}
    >
      <Positions address={account.address ?? null} />
      <div
        className={css({
          display: "grid",
          gap: 24,
          gridTemplateColumns: "1fr 1fr",
        })}
      >
        <HomeTable
          title="Borrow BOLD against ETH and staked ETH"
          subtitle="You can adjust your loans, including your interest rate, at any time"
          icon={<IconBorrow />}
          columns={["Collateral", "Avg rate, p.a.", "Max LTV", null] as const}
          rows={collSymbols.map((symbol) => (
            <BorrowingRow
              key={symbol}
              symbol={symbol}
            />
          ))}
        />
        <HomeTable
          title="Earn rewards with BOLD"
          subtitle="Earn BOLD & (staked) ETH rewards by putting your BOLD in a stability pool"
          icon={<IconEarn />}
          columns={["Pool", "Current APR", "Pool size", null] as const}
          rows={collSymbols.map((symbol) => (
            <EarnRewardsRow
              key={symbol}
              symbol={symbol}
            />
          ))}
        />
      </div>
    </div>
  );
}

function BorrowingRow({
  symbol,
}: {
  symbol: CollateralSymbol;
}) {
  const collIndex = useCollIndexFromSymbol(symbol);
  const collateral = getCollToken(collIndex);
  const avgInterestRate = useAverageInterestRate(collIndex);

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
        <div
          className={css({
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          })}
        >
          <Link
            href={`/borrow/${symbol.toLowerCase()}`}
            legacyBehavior
            passHref
          >
            <AnchorTextButton
              label={
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  Borrow
                  <TokenIcon symbol="BOLD" size="mini" />
                </div>
              }
              title={`Borrow ${collateral?.name} from ${symbol}`}
            />
          </Link>
          <Link
            href={`/leverage/${symbol.toLowerCase()}`}
            legacyBehavior
            passHref
          >
            <AnchorTextButton
              label={
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                  })}
                >
                  Leverage
                  <TokenIcon symbol={symbol} size="mini" />
                </div>
              }
              title={`Borrow ${collateral?.name} from ${symbol}`}
            />
          </Link>
        </div>
      </td>
    </tr>
  );
}

function EarnRewardsRow({
  symbol,
}: {
  symbol: CollateralSymbol;
}) {
  const collIndex = useCollIndexFromSymbol(symbol);
  const collateral = getCollToken(collIndex);
  const earnPool = useEarnPool(collIndex);

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
          format="compact"
          prefix="$"
          value={earnPool.data?.totalDeposited}
        />
      </td>
      <td>
        <Link
          href={`/earn/${symbol.toLowerCase()}`}
          legacyBehavior
          passHref
        >
          <AnchorTextButton
            label={
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
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
        </Link>
      </td>
    </tr>
  );
}
