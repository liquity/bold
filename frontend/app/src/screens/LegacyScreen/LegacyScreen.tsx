"use client";

import type { Dnum, TokenSymbol } from "@/src/types";

import { CollateralRegistry } from "@/src/abi/CollateralRegistry";
import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { Screen } from "@/src/comps/Screen/Screen";
import { dnum18 } from "@/src/dnum-utils";
import { LEGACY_CHECK } from "@/src/env";
import { parseInputPercentage, useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { useLegacyPositions } from "@/src/liquity-utils";
import { HomeTable } from "@/src/screens/HomeScreen/HomeTable";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import {
  Button,
  IconBorrow,
  IconEarn,
  IconStake,
  InfoTooltip,
  InputField,
  TextButton,
  TokenIcon,
  TOKENS_BY_SYMBOL,
} from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import * as dn from "dnum";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useRef } from "react";
import { useReadContract } from "wagmi";

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

  const positionsTransition = useTransition({
    account,
    legacyPositions,
  }, {
    keys: ({ account, legacyPositions }) => (
      !account.address
        ? "no-account"
        : `${account.address}${legacyPositions.data?.hasAnyPosition}`
    ),
    from: {
      opacity: 0,
      transform: `
        scale3d(0.97, 0.97, 1)
        translate3d(0, 8px, 0)
      `,
    },
    enter: {
      opacity: 1,
      transform: `
        scale3d(1, 1, 1)
        translate3d(0, 0px, 0)
      `,
      immediate: !account.address,
    },
    leave: {
      display: "none",
      immediate: true,
    },
    config: {
      mass: 1,
      tension: 2800,
      friction: 120,
    },
  });

  return (
    <Screen
      heading={{
        title: "Liquity V2-Legacy Positions",
      }}
    >
      {positionsTransition((style, { account, legacyPositions }) => (
        account.address
          ? (
            <a.div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: 48,
                willChange: "transform, opacity",
              })}
              style={style}
            >
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  padding: 16,
                  textAlign: "center",
                  textWrap: "balance",
                  color: "content",
                  background: "infoSurface",
                  border: "1px solid token(colors.infoSurfaceBorder)",
                  borderRadius: 8,
                })}
              >
                {legacyPositions.isLoading
                  ? "Fetching your legacy positions…"
                  : legacyPositions.data?.hasAnyPosition
                  ? "You have active positions in Liquity V2-Legacy."
                    + " These positions are not compatible with Liquity V2."
                    + " You can withdraw these positions from here at any time."
                  : "You do not have any active positions in Liquity V2-Legacy."}
              </div>
              {legacyPositions.isSuccess && (
                <div
                  className={css({
                    display: "flex",
                    flexDirection: "column",
                    gap: 48,
                  })}
                >
                  <EarnPositionsTable />
                  <LoanPositionsTable />
                  <StakingPositionsTable />
                  <RedeemSection />
                </div>
              )}
              {legacyPositions.isLoading && (
                <div
                  className={css({
                    display: "flex",
                    justifyContent: "center",
                    gap: 16,
                  })}
                >
                  Loading…
                </div>
              )}
            </a.div>
          )
          : (
            <a.div style={style}>
              <ConnectWarningBox />
            </a.div>
          )
      ))}
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
      placeholder="No active positions."
      rows={legacyPositions.isSuccess && spDeposits.length === 0 ? [] : [
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
                  <TokenIcon
                    size="mini"
                    symbol={branch.symbol}
                  />
                  <span>{branch.name}</span>
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
                  <TokenAmount
                    symbol="LEGACY_BOLD"
                    value={dnum18(spPosition.deposit)}
                  />
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
                  <TokenAmount
                    symbol="LEGACY_BOLD"
                    value={dnum18(spPosition.yieldGain)}
                  />
                  <TokenAmount
                    symbol={branch.symbol}
                    value={dnum18(spPosition.collGain)}
                  />
                </div>
              </td>
            </tr>
          );
        }),
        <tr key="withdraw-all">
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
  const boldBalance = dnum18(legacyPositions.data?.boldBalance ?? 0n);
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
      placeholder="No opened loans."
      rows={troves.map((trove) => {
        const debt = dnum18(trove.entireDebt);
        const coll = dnum18(trove.entireColl);
        const hasEnoughBold = dn.lte(debt, boldBalance);
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
                <TokenIcon
                  size="mini"
                  symbol={trove.collToken.symbol}
                />
                <span>{trove.collToken.name}</span>
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
                <TokenAmount
                  symbol={trove.collToken.symbol}
                  value={coll}
                />
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
                <TokenAmount
                  symbol="LEGACY_BOLD"
                  value={debt}
                />
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
                {!hasEnoughBold && (
                  <InfoTooltip level="warning" heading="Insufficient Legacy BOLD">
                    Your current Legacy BOLD balance ({fmtnum(
                      boldBalance,
                      { digits: 2 },
                    )} BOLD) is too low to close this loan. You need at least {fmtnum(debt, { digits: 2 })}{" "}
                    BOLD to close this loan.
                  </InfoTooltip>
                )}
                <Button
                  disabled={!hasEnoughBold}
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
      placeholder="No active staking position."
      rows={stakeDeposit && dn.eq(stakeDeposit, 0) ? [] : [
        <tr key="stake-deposit">
          <td>
            <TokenAmount
              symbol="LQTY"
              value={stakeDeposit}
            />
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

function RedeemSection() {
  if (!LEGACY_CHECK) {
    throw new Error("LEGACY_CHECK is not defined.");
  }

  const account = useAccount();
  const txFlow = useTransactionFlow();
  const legacyPositions = useLegacyPositions(account.address ?? null);
  const boldBalance = legacyPositions.data ? dnum18(legacyPositions.data.boldBalance) : null;

  const redemptionRate = useReadContract({
    abi: CollateralRegistry,
    address: LEGACY_CHECK.COLLATERAL_REGISTRY,
    functionName: "getRedemptionRateWithDecay",
    account: account.address,
  });

  const amount = useInputFieldValue(fmtnum);
  const maxFee = useInputFieldValue((value) => `${fmtnum(value, "pct2z")}%`, {
    parse: parseInputPercentage,
  });

  const hasUpdatedRedemptionRate = useRef(false);
  if (!hasUpdatedRedemptionRate.current && redemptionRate.data) {
    if (maxFee.isEmpty) {
      maxFee.setValue(
        fmtnum(
          dn.mul(dnum18(redemptionRate.data), 1.1),
          "pct2z",
        ),
      );
    }
    hasUpdatedRedemptionRate.current = true;
  }

  const allowSubmit = account.isConnected
    && amount.parsed
    && maxFee.parsed
    && boldBalance
    && dn.gte(boldBalance, amount.parsed);

  return (
    <HomeTable
      title="Legacy Redemption"
      subtitle="Redeem your Legacy BOLD for ETH and LSTs."
      icon={<IconEarn />}
      columns={[]}
      rows={[
        <tr
          key="redeem-legacy-bold"
          className={css({
            "& th, & td": {
              fontWeight: "initial",
              whiteSpace: "initial",
              textAlign: "initial",
            },
          })}
        >
          <td>
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: 24,
                padding: "8px 0 0",
                marginBottom: -8,
              })}
            >
              <Field
                field={
                  <InputField
                    id="input-redeem-amount"
                    contextual={
                      <InputField.Badge
                        icon={<TokenIcon symbol="BOLD" />}
                        label="Legacy BOLD"
                      />
                    }
                    drawer={amount.isFocused
                      ? null
                      : boldBalance
                          && amount.parsed
                          && dn.gt(amount.parsed, boldBalance)
                      ? {
                        mode: "error",
                        message: `Insufficient BOLD balance. You have ${fmtnum(boldBalance)} BOLD.`,
                      }
                      : null}
                    label="Redeeming"
                    placeholder="0.00"
                    secondary={{
                      start: `$${
                        amount.parsed
                          ? fmtnum(amount.parsed)
                          : "0.00"
                      }`,
                      end: (
                        boldBalance && dn.gt(boldBalance, 0) && (
                          <TextButton
                            label={`Max ${fmtnum(boldBalance)} Legacy BOLD`}
                            onClick={() => {
                              amount.setValue(dn.toString(boldBalance));
                            }}
                          />
                        )
                      ),
                    }}
                    {...amount.inputFieldProps}
                  />
                }
              />

              <Field
                field={
                  <InputField
                    id="input-max-fee"
                    drawer={maxFee.isFocused
                      ? null
                      : maxFee.parsed && dn.gt(maxFee.parsed, 0.01)
                      ? {
                        mode: "warning",
                        message: `A high percentage will result in a higher fee.`,
                      }
                      : null}
                    label="Max redemption fee"
                    placeholder="0.00"
                    {...maxFee.inputFieldProps}
                  />
                }
                footer={[
                  {
                    end: (
                      <span
                        className={css({
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 14,
                        })}
                      >
                        <>
                          Current redemption rate:
                          <Amount
                            percentage
                            suffix="%"
                            value={redemptionRate.data ? dnum18(redemptionRate.data) : null}
                            format="pct1z"
                          />
                        </>
                        <InfoTooltip
                          content={{
                            heading: "Maximum redemption fee",
                            body: (
                              <>
                                This is the maximum redemption fee you are willing to pay. The redemption fee is a
                                percentage of the redeemed amount that is paid to the protocol. The redemption fee must
                                be higher than the current fee.
                              </>
                            ),
                            footerLink: {
                              href: "https://dune.com/queries/4641717/7730245",
                              label: "Redemption fee on Dune",
                            },
                          }}
                        />
                      </span>
                    ),
                  },
                ]}
              />

              <section
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  padding: 16,
                  color: "infoSurfaceContent",
                  background: "infoSurface",
                  border: "1px solid token(colors.infoSurfaceBorder)",
                  borderRadius: 8,
                })}
              >
                <h1
                  className={css({
                    display: "flex",
                    flexDirection: "column",
                    fontSize: 16,
                    fontWeight: 600,
                  })}
                >
                  Important note
                </h1>
                <div>
                  <p
                    className={css({
                      fontSize: 15,
                      "& a": {
                        color: "accent",
                        textDecoration: "underline",
                      },
                    })}
                  >
                    You will be charged a dynamic redemption fee (the more redemptions, the higher the fee).{" "}
                    <Link
                      href="https://docs.liquity.org/v2-faq/redemptions-and-delegation"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Learn more about redemptions.
                    </Link>
                  </p>
                </div>
              </section>

              <div
                className={css({
                  display: "flex",
                  justifyContent: "flex-end",
                })}
              >
                <Button
                  disabled={!allowSubmit}
                  label="Redeem Legacy BOLD"
                  mode="primary"
                  size="small"
                  onClick={() => {
                    if (
                      amount.parsed
                      && maxFee.parsed
                      && boldBalance
                      && dn.gte(boldBalance, amount.parsed)
                    ) {
                      txFlow.start({
                        flowId: "legacyRedeemCollateral",
                        backLink: ["/legacy", "Back to legacy positions"],
                        successLink: ["/legacy", "Go to legacy positions"],
                        successMessage: "The redemption was successful.",

                        amount: amount.parsed,
                        maxFee: maxFee.parsed,
                      });
                    }
                  }}
                />
              </div>
            </div>
          </td>
        </tr>,
      ]}
    />
  );
}

function TokenAmount({
  digits = 2,
  symbol,
  value,
}: {
  digits?: number | null;
  symbol: TokenSymbol | "LEGACY_BOLD";
  value?: Dnum | null;
}) {
  const token = TOKENS_BY_SYMBOL[symbol === "LEGACY_BOLD" ? "BOLD" : symbol];
  return (
    <div
      title={fmtnum(value, {
        digits: digits ?? undefined,
        suffix: " " + (symbol === "LEGACY_BOLD" ? "Legacy BOLD" : token.name),
      })}
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 4,
        userSelect: "none",
      })}
    >
      {fmtnum(value, {
        compact: true,
        digits: 2,
      })}
      <div
        className={css({
          display: "flex",
          width: 16,
          height: 16,
          pointerEvents: "none",
        })}
        style={{
          opacity: symbol === "LEGACY_BOLD" ? 0.5 : 1,
        }}
      >
        <TokenIcon
          size="mini"
          symbol={symbol === "LEGACY_BOLD" ? "BOLD" : symbol}
        />
      </div>
    </div>
  );
}
