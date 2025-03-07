"use client";

import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Screen } from "@/src/comps/Screen/Screen";
import { LEGACY_CHECK } from "@/src/constants";
import { dnum18 } from "@/src/dnum-utils";
import { useLegacyPositions } from "@/src/liquity-utils";
import { HomeTable } from "@/src/screens/HomeScreen/HomeTable";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { Button, IconBorrow, IconEarn, IconStake, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import { notFound } from "next/navigation";

function getLegacyBranch(branchId: number) {
  const branch = LEGACY_CHECK?.BRANCHES[branchId];
  if (!branch) {
    throw new Error(`Invalid branch ID: ${branchId}`);
  }
  return branch;
}

export function LegacyScreen() {
  if (!LEGACY_CHECK) {
    notFound();
  }

  const account = useAccount();
  const legacyPositions = useLegacyPositions(account.address ?? null);

  return (
    <Screen
      heading={{
        title: "Liquity V2-Legacy Positions",
      }}
    >
      {account.isConnected
        ? (
          <>
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: 32,
                padding: 16,
                textAlign: "center",
                textWrap: "balance",
                color: "content",
                background: "infoSurface",
                border: "1px solid token(colors.infoSurfaceBorder)",
                borderRadius: 8,
              })}
            >
              {!account.isConnected
                ? "Connect your wallet to view your legacy positions."
                : legacyPositions.isFetching
                ? "Loading your legacy positions…"
                : legacyPositions.data?.hasAnyPosition
                ? `
                    You have active positions in Liquity V2-Legacy.
                    These positions are not compatible with Liquity V2.
                    You can withdraw these positions from here at any time.
                  `
                : "You do not have any active positions in Liquity V2-Legacy."}
            </div>
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: 48,
                width: 534,
              })}
            >
              <EarnPositionsTable />
              <LoanPositionsTable />
              <StakingPositionsTable />
            </div>
          </>
        )
        : <ConnectWarningBox />}
    </Screen>
  );
}

function EarnPositionsTable() {
  if (!LEGACY_CHECK) {
    throw new Error("LEGACY_CHECK is not defined.");
  }
  const txFlow = useTransactionFlow();
  const account = useAccount();
  const legacyPositions = useLegacyPositions(account.address ?? null);
  const spDeposits = legacyPositions.data?.spDeposits ?? [];
  return (
    <HomeTable
      title="Legacy Earn Positions"
      subtitle="Your positions in the Liquity V2-Legacy Stability Pools."
      loading={legacyPositions.isLoading && "Fetching legacy earn positions…"}
      icon={<IconEarn />}
      columns={[
        "Stability Pool",
        "Deposit",
        "Rewards",
      ] as const}
      rows={[
        ...spDeposits.map((spPosition) => {
          const branch = getLegacyBranch(spPosition.branchId);
          return (
            <tr key={branch.symbol}>
              <td>
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  })}
                >
                  <TokenIcon symbol={branch.symbol} size="mini" />
                  <span>{branch.name}</span>
                </div>
              </td>
              <td>
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 4,
                  })}
                >
                  <Amount
                    fallback="…"
                    format="compact"
                    value={spPosition && dnum18(spPosition.deposit)}
                  />
                  <TokenIcon symbol="BOLD" size="mini" />
                </div>
              </td>
              <td>
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 8,
                  })}
                >
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    })}
                  >
                    <Amount
                      fallback="…"
                      format="compact"
                      value={spPosition && dnum18(spPosition.yieldGain)}
                    />
                    <TokenIcon symbol="BOLD" size="mini" />
                  </div>
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    })}
                  >
                    <Amount
                      fallback="…"
                      format="compact"
                      value={spPosition && dnum18(spPosition.collGain)}
                    />
                    <TokenIcon symbol={branch.symbol} size="mini" />
                  </div>
                </div>
              </td>
            </tr>
          );
        }),
        <tr>
          <td
            colSpan={3}
            className={css({
              padding: "12px 0 0!",
            })}
          >
            <div
              className={css({
                display: "flex",
                gap: 16,
                justifyContent: "flex-end",
              })}
            >
              <Button
                disabled={spDeposits.length === 0}
                mode="primary"
                size="small"
                label="Withdraw all"
                onClick={() => {
                  txFlow.start({
                    flowId: "legacyEarnWithdrawAll",
                    backLink: ["/legacy", "Back to legacy positions"],
                    successLink: ["/legacy", "Go to legacy positions"],
                    successMessage: "The positions have been withdrawn successfully.",
                    pools: spDeposits.map((deposit) => ({
                      branchIndex: deposit.branchId,
                      deposit: dnum18(deposit.deposit),
                      rewards: {
                        bold: dnum18(deposit.yieldGain),
                        coll: dnum18(deposit.collGain),
                      },
                    })),
                  });
                }}
              />
            </div>
          </td>
        </tr>,
      ]}
    />
  );
}

function LoanPositionsTable() {
  const txFlow = useTransactionFlow();
  const account = useAccount();
  const legacyPositions = useLegacyPositions(account.address ?? null);
  const troves = legacyPositions.data?.troves ?? [];
  return (
    <HomeTable
      title="Legacy Loan Positions"
      subtitle="Your currently active loans in Liquity V2-Legacy."
      loading={legacyPositions.isLoading && "Fetching legacy loan positions…"}
      icon={<IconBorrow />}
      columns={[
        "Collateral",
        "Deposit",
        "Borrowed",
        null,
      ] as const}
      rows={troves.map((trove) => {
        const debt = dnum18(trove.entireDebt);
        const coll = dnum18(trove.entireColl);
        return (
          <tr key={trove.collToken.symbol}>
            <td>
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                })}
              >
                <TokenIcon symbol={trove.collToken.symbol} size="mini" />
                <span>{trove.collToken.name}</span>
              </div>
            </td>
            <td>
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 4,
                })}
              >
                <Amount
                  fallback="…"
                  format="compact"
                  value={coll}
                />
                <TokenIcon
                  symbol={trove.collToken.symbol}
                  size="mini"
                />
              </div>
            </td>
            <td>
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 4,
                })}
              >
                <Amount
                  fallback="…"
                  format="compact"
                  value={debt}
                />
                <TokenIcon symbol="BOLD" size="mini" />
              </div>
            </td>
            <td>
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                })}
              >
                <Button
                  mode="primary"
                  size="small"
                  label="Close loan"
                  onClick={() => {
                    txFlow.start({
                      flowId: "legacyCloseLoanPosition",
                      backLink: [`/legacy`, "Back to legacy positions"],
                      successLink: ["/legacy", "Go to legacy positions"],
                      successMessage: "The loan position has been closed successfully.",
                      trove: {
                        borrowed: debt,
                        branchId: trove.branchId,
                        deposit: coll,
                        troveId: trove.troveId,
                      },
                    });
                  }}
                />
              </div>
            </td>
          </tr>
        );
      })}
    />
  );
}

function StakingPositionsTable() {
  const txFlow = useTransactionFlow();
  const account = useAccount();
  const legacyPositions = useLegacyPositions(account.address ?? null);
  const stakeDeposit = legacyPositions.data && dnum18(legacyPositions.data.stakeDeposit);
  return (
    <HomeTable
      title="Legacy Staking Position"
      subtitle="Your staking position in Liquity V2-Legacy."
      loading={legacyPositions.isLoading && "Fetching legacy staking position…"}
      icon={<IconStake />}
      columns={["Staked LQTY", null] as const}
      rows={[
        <tr>
          <td>
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 4,
              })}
            >
              <Amount
                fallback="…"
                value={stakeDeposit}
              />
              <TokenIcon symbol="LQTY" size="mini" />
            </div>
          </td>
          <td>
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
              })}
            >
              <Button
                disabled={!stakeDeposit || dn.eq(stakeDeposit, 0)}
                mode="primary"
                size="small"
                label="Unstake all"
                onClick={() => {
                  if (stakeDeposit) {
                    txFlow.start({
                      flowId: "legacyUnstakeAll",
                      backLink: ["/legacy", "Back to legacy positions"],
                      successLink: ["/legacy", "Go to legacy positions"],
                      successMessage: "You have successfully unstaked your LQTY.",
                      lqtyAmount: stakeDeposit,
                    });
                  }
                }}
              />
            </div>
          </td>
        </tr>,
      ]}
    />
  );
}
