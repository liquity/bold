"use client";

import type { CollateralSymbol } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { Positions } from "@/src/comps/Positions/Positions";
import { useCollateralContracts } from "@/src/contracts";
import { DNUM_1 } from "@/src/dnum-utils";
import { useCollateral, useCollIndexFromSymbol } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Ethereum";
import { useStabilityPool } from "@/src/subgraph-hooks";
import { css } from "@/styled-system/css";
import { AnchorTextButton, IconBorrow, IconEarn, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import Link from "next/link";
import { HomeTable } from "./HomeTable";

export function HomeScreen() {
  const collSymbols = useCollateralContracts().map((coll) => coll.symbol);
  const account = useAccount();
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
          rows={collSymbols.map((symbol) => <BorrowingRow symbol={symbol} />)}
        />
        <HomeTable
          title="Earn Rewards with BOLD"
          subtitle="Earn BOLD & (staked) ETH rewards by putting your BOLD in a stability pool"
          icon={<IconEarn />}
          columns={["Pool", "Current APR", "Pool size", null] as const}
          rows={collSymbols.map((symbol) => <EarnRewardsRow symbol={symbol} />)}
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
  const collateral = useCollateral(collIndex);
  const avgInterestRate = dn.from(0, 18);

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
        <Amount value={avgInterestRate} percentage />
      </td>
      <td>
        <Amount value={maxLtv} percentage />
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
  const collateral = useCollateral(collIndex);
  const earnPool = useStabilityPool(collIndex ?? undefined);

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
        <Amount value={earnPool.data?.apr} percentage />
      </td>
      <td>
        <Amount
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
