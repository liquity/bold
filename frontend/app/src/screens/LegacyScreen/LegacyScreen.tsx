"use client";

import { Amount } from "@/src/comps/Amount/Amount";
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

type LegacyBranch = NonNullable<typeof LEGACY_CHECK>["BRANCHES"][number];

export function LegacyScreen() {
  if (!LEGACY_CHECK) {
    notFound();
  }

  return (
    <Screen
      heading={{
        title: "Liquity V2-Legacy Positions",
      }}
    >
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
        You have active positions in Liquity V2-Legacy. These positions are not compatible with Liquity V2. You can
        withdraw these positions at any time.
      </div>
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 48,
          width: 534,
        })}
      >
        <EarnPositionsTable branches={LEGACY_CHECK.BRANCHES} />
        <LoanPositionsTable branches={LEGACY_CHECK.BRANCHES} />
        <StakingPositionsTable branches={LEGACY_CHECK.BRANCHES} />
      </div>
    </Screen>
  );
}

function StakingPositionsTable({
  branches: _branches,
}: {
  branches: readonly LegacyBranch[];
}) {
  return (
    <HomeTable
      title="Staking Position"
      subtitle="Your staking position in Liquity V2-Legacy."
      icon={<IconStake />}
      columns={[
        "Staked",
        null,
      ] as const}
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
                format="compact"
                value={dn.from(123_456.78, 18)}
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
                mode="primary"
                size="small"
                label="Unstake"
              />
            </div>
          </td>
        </tr>,
      ]}
    />
  );
}

function LoanPositionsTable({
  branches,
}: {
  branches: readonly LegacyBranch[];
}) {
  const demoLoan = (branhcIndex: number, deposit: number, borrowed: number) => {
    const branch = branches[branhcIndex];
    if (!branch) {
      throw new Error("Invalid branch index");
    }
    return {
      symbol: branch.symbol,
      name: branch.name,
      deposit: dn.from(deposit, 18),
      borrowed: dn.from(borrowed, 18),
    };
  };

  const demoLoans = [
    demoLoan(1, 10, 40_002.78),
    demoLoan(0, 8, 23_300.23),
    demoLoan(1, 23.3, 11_234.56),
    demoLoan(1, 21, 33_456.78),
    demoLoan(2, 7.8, 12_345.67),
  ] as const;

  return (
    <HomeTable
      title="Legacy Loan Positions"
      subtitle="Your currently active loans in Liquity V2-Legacy."
      icon={<IconBorrow />}
      columns={[
        "Collateral",
        "Deposit",
        "Borrowed",
        null,
      ] as const}
      rows={demoLoans.map((loan) => {
        return (
          <tr key={loan.symbol}>
            <td>
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                })}
              >
                <TokenIcon symbol={loan.symbol} size="mini" />
                <span>{loan.name}</span>
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
                  value={loan.deposit}
                />
                <TokenIcon
                  symbol={loan.symbol}
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
                  value={loan.borrowed}
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
                />
              </div>
            </td>
          </tr>
        );
      })}
    />
  );
}

function EarnPositionsTable({
  branches,
}: {
  branches: readonly LegacyBranch[];
}) {
  const account = useAccount();
  const txFlow = useTransactionFlow();
  const legacyPositions = useLegacyPositions(account.address ?? null);
  return (
    <HomeTable
      title="Legacy Earn Positions"
      subtitle="Your positions in the Liquity V2-Legacy Stability Pools."
      icon={<IconEarn />}
      columns={[
        "Stability Pool",
        "Deposit",
        "Rewards",
      ] as const}
      rows={[
        ...branches.map((branch, index) => {
          const branchPosition = legacyPositions.data?.branches[index] ?? null;
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
                    value={branchPosition && dnum18(branchPosition.deposit)}
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
                      value={branchPosition && dnum18(branchPosition.yieldGain)}
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
                      value={branchPosition && dnum18(branchPosition.collGain)}
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
                disabled={!legacyPositions.data?.branches.some((branch) => branch.deposit > 0n)}
                mode="primary"
                size="small"
                label="Withdraw all"
                onClick={() => {
                  const branches = legacyPositions.data?.branches;
                  if (branches) {
                    txFlow.start({
                      flowId: "legacyEarnUpdate",
                      backLink: [
                        "/legacy",
                        "Back to legacy positions",
                      ],
                      successLink: ["/legacy", "Go to legacy positions"],
                      successMessage: "The positions have been withdrawn successfully.",
                      pools: branches
                        .map((position, branchIndex) => (
                          position.deposit > 0n
                            ? ({
                              branchIndex,
                              deposit: dnum18(position.deposit),
                              rewards: {
                                bold: dnum18(position.yieldGain),
                                coll: dnum18(position.collGain),
                              },
                            })
                            : null
                        ))
                        .filter((pool) => pool !== null),
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
