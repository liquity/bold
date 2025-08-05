"use client";

import type { CollateralSymbol } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { Positions } from "@/src/comps/Positions/Positions";
import { getContracts } from "@/src/contracts";
// import { DNUM_1 } from "@/src/dnum-utils";
import {
  getBranch,
  getCollIndexFromSymbol,
  getCollToken,
  getToken,
  useAverageInterestRate,
  useEarnPool,
  useTotalDebtCollateralPositions,
} from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Arbitrum";
import { css } from "@/styled-system/css";
import {
  AnchorTextButton,
  // IconBorrow,
  // IconEarn,
  TokenIcon,
} from "@liquity2/uikit";
// import * as dn from "dnum";
import Link from "next/link";
import { HomeTable } from "./HomeTable";
import Image from "next/image";
import { MAX_DEBT_LIMITS } from "@/src/constants";
import { useYusndStats } from "@/src/yusnd";

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
        <div>
          <HomeTable
            title='Borrow USND against ETH and assets'
            subtitle='You can adjust your loans, including your interest rate, at any time'
            // icon={<IconBorrow />}
            icon={<Image src='/cute-snails/battle.png' alt='Borrow' width={24} height={24} />}
            columns={
              [
                "Collateral",
                <span title='Average interest rate, per annum'>
                  Avg rate, p.a.
                </span>,
                // <span title='Maximum Loan-to-Value ratio'>Max LTV</span>,
                <span title='Total collateral in USD'>Deposited</span>,
                <span title='Total debt in USD'>Debt Issued</span>,
                null,
              ] as const
            }
            rows={collSymbols.map((symbol) => (
              <BorrowingRow key={symbol} symbol={symbol} />
            ))}
          />
        </div>
        <HomeTable
          title='Earn rewards with USND'
          subtitle='Earn USND & (staked) ETH rewards by putting your USND in a stability pool'
          // icon={<IconEarn />}
          icon={<Image src='/cute-snails/blue.png' alt='Borrow' width={24} height={24} />}
          columns={
            [
              "Pool",
              <abbr title='Annual Percentage Rate over the last 24 hours'>
                APR
              </abbr>,
              <abbr title='Annual Percentage Rate over the last 7 days'>
                7d APR
              </abbr>,
              "Pool size",
              null,
            ] as const
          }
          rows={["YUSND" as const, ...collSymbols].map((symbol) => (
            <EarnRewardsRow key={symbol} symbol={symbol} />
          ))}
        />
      </div>
    </div>
  );
}

function BorrowingRow({ symbol }: { symbol: CollateralSymbol }) {
  const collIndex = getCollIndexFromSymbol(symbol);
  const collateral = getCollToken(collIndex);
  const avgInterestRate = useAverageInterestRate(collIndex);
  const { totalDebt, totalCollateralInUsd } = useTotalDebtCollateralPositions(collIndex);

  const debtLimit = MAX_DEBT_LIMITS[symbol];
  // const maxLtv =
  //   collateral?.collateralRatio && dn.gt(collateral.collateralRatio, 0)
  //     ? dn.div(DNUM_1, collateral.collateralRatio)
  //     : null;

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
          <TokenIcon symbol={symbol} size='mini' />
          <span>{collateral?.name}</span>
        </div>
      </td>
      <td>
        <Amount fallback='…' percentage value={avgInterestRate.data} />
      </td>
      <td>
        {/* <Amount value={maxLtv} percentage /> */}
        <Amount
          fallback='…'
          format='compact'
          prefix='$'
          value={totalCollateralInUsd}
        />
      </td>
      <td className={css({
        display: "flex",
        gap: 4,
        alignItems: "center",
        justifyContent: "end",
      })}>
        <Amount
          fallback='…'
          format='compact'
          prefix='$'
          value={totalDebt}
        />
        <span className={css({
          color: "text.secondary",
        })}>
          /
        </span>
        <Amount
          fallback='…'
          format='compact'
          prefix='$'
          value={debtLimit}
        />
      </td>
      <td>
        <div
          className={css({
            display: "flex",
            gap: 16,
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
                    gap: 4,
                    fontSize: 14,
                  })}
                >
                  Borrow
                  <TokenIcon symbol='USND' size='mini' />
                </div>
              }
              title={`Borrow ${collateral?.name} from ${symbol}`}
            />
          </Link>
          {/* <Link
            href={`/multiply/${symbol.toLowerCase()}`}
            legacyBehavior
            passHref
          >
            <AnchorTextButton
              label={
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 14,
                  })}
                >
                  Multiply
                  <TokenIcon symbol={symbol} size='mini' />
                </div>
              }
              title={`Borrow ${collateral?.name} from ${symbol}`}
            />
          </Link> */}
        </div>
      </td>
    </tr>
  );
}

function EarnRewardsRow({ symbol }: { symbol: CollateralSymbol | "YUSND" }) {
  const branch = symbol === "YUSND" ? null : getBranch(symbol);
  const token = getToken(symbol);
  const earnPool = useEarnPool(branch?.id ?? null);
  const yusndStats = useYusndStats();

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
          <TokenIcon symbol={symbol} size='mini' />
          <span>{symbol === "YUSND" ? "yUSND by Yearn" : token?.name}</span>
        </div>
      </td>
      <td>
        <Amount
          fallback="…"
          percentage
          value={symbol === "YUSND"
            ? yusndStats.data?.apr
            : earnPool.data?.apr}
        />
      </td>
      <td>
        <Amount
          fallback="…"
          percentage
          value={symbol === "YUSND"
            ? yusndStats.data?.apr7d
            : earnPool.data?.apr7d}
        />
      </td>
      <td>
        <Amount
          fallback='…'
          format='compact'
          prefix='$'
          value={symbol === "YUSND"
            ? yusndStats.data?.totalUsnd
            : earnPool.data?.totalDeposited}
        />
      </td>
      <td>
        <Link href={`/earn/${symbol.toLowerCase()}`} legacyBehavior passHref>
          <AnchorTextButton
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
                {symbol === "YUSND" ? (
                  <TokenIcon.Group size='mini'>
                    <TokenIcon symbol='USND' />
                    <TokenIcon symbol='SUP' />
                    <div
                      className={css({
                        width: 16,
                      })}
                    />
                  </TokenIcon.Group>
                ) : (
                  <TokenIcon.Group size='mini'>
                    <TokenIcon symbol='USND' />
                    <TokenIcon symbol={symbol} />
                    <TokenIcon symbol='SUP' />
                  </TokenIcon.Group>
                )}
              </div>
            }
            title={`Earn USND with ${token?.name}`}
          />
        </Link>
      </td>
    </tr>
  );
}
