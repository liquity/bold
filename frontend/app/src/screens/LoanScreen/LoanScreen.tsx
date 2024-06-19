"use client";

import type { PositionLoan } from "@/src/types";
import type { ReactNode } from "react";

import { Field } from "@/src/comps/Field/Field";
import { Position } from "@/src/comps/Position/Position";
import { Screen } from "@/src/comps/Screen/Screen";
import { DEBT_SUGGESTIONS, ETH_MAX_RESERVE } from "@/src/constants";
import content from "@/src/content";
import { ACCOUNT_BALANCES, ACCOUNT_POSITIONS } from "@/src/demo-data";
import { useDemoState } from "@/src/demo-state";
import { useInputFieldValue } from "@/src/form-utils";
import { getLiquidationRisk, getLoanDetails, getLtv } from "@/src/liquity-math";
import { usePrice } from "@/src/prices";
import { infoTooltipProps } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  Button,
  Dropdown,
  HFlex,
  IconGas,
  InfoTooltip,
  InputField,
  PillButton,
  Tabs,
  TextButton,
  TokenIcon,
  TOKENS_BY_SYMBOL,
  VFlex,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { notFound, useRouter, useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { useMemo, useState } from "react";

const TABS = [
  { label: "Update position", id: "update" },
  { label: "Repay & Close", id: "close" },
];

export function LoanScreen() {
  const router = useRouter();
  const action = useSelectedLayoutSegment() ?? "update";

  const searchParams = useSearchParams();
  const troveId = searchParams.get("id");

  const tab = TABS.findIndex(({ id }) => id === action);

  const trove = useMemo(() => {
    if (troveId === null) {
      return null;
    }
    let troveIdInt: bigint;
    try {
      troveIdInt = BigInt(troveId);
    } catch {
      return null;
    }
    const position = ACCOUNT_POSITIONS.find((position) => (
      position.type === "loan" && position.troveId === troveIdInt
    ));
    return position as PositionLoan | null;
  }, [troveId]);

  if (!trove) {
    notFound();
  }

  return (
    <Screen>
      <VFlex gap={48}>
        <Position troveId={trove.troveId} />
        <VFlex gap={40}>
          <Tabs
            items={TABS.map(({ label, id }) => ({
              label,
              panelId: `p-${id}`,
              tabId: `t-${id}`,
            }))}
            selected={tab}
            onSelect={(index) => {
              router.push(`/loan/${TABS[index].id}?id=${troveId}`);
            }}
          />
          {action === "update" && <UpdatePositionPanel loan={trove} />}
          {action === "close" && <ClosePositionPanel loan={trove} />}
        </VFlex>
      </VFlex>
    </Screen>
  );
}

function UpdatePositionPanel({
  loan,
}: {
  loan: PositionLoan;
}) {
  const router = useRouter();
  const { account, setDemoState } = useDemoState();
  const collateral = TOKENS_BY_SYMBOL[loan.collateral];
  const ethPriceUsd = usePrice("ETH");
  const boldPriceUsd = usePrice("BOLD");

  const deposit = useInputFieldValue((value) => `${dn.format(value)} ${collateral.symbol}`, {
    defaultValue: dn.toString(loan.deposit),
  });
  const debt = useInputFieldValue((value) => `${dn.format(value)} BOLD`, {
    defaultValue: dn.toString(loan.borrowed),
  });
  const interestRate = useInputFieldValue((value) => `${dn.format(value)} %`, {
    defaultValue: dn.toString(dn.mul(loan.interestRate, 100)),
  });

  const ethMax = dn.add(
    loan.deposit,
    dn.sub(
      ACCOUNT_BALANCES[collateral.symbol],
      ETH_MAX_RESERVE,
    ),
  );

  const loanDetails = getLoanDetails(
    deposit.isEmpty ? null : deposit.parsed,
    debt.isEmpty ? null : debt.parsed,
    interestRate.parsed && dn.div(interestRate.parsed, 100),
    dn.div(dn.from(1, 18), collateral.collateralRatio),
    ethPriceUsd,
  );

  const boldInterestPerYear = interestRate.parsed
    && debt.parsed
    && dn.mul(debt.parsed, dn.div(interestRate.parsed, 100));

  const depositDifference = deposit.parsed && dn.sub(deposit.parsed, loan.deposit);
  const showDepositDifference = depositDifference
    && !dn.eq(depositDifference, 0)
    && !deposit.isEmpty
    && !deposit.isFocused;

  const debtDifference = debt.parsed && dn.sub(debt.parsed, loan.borrowed);
  const showDebtDifference = debtDifference
    && !dn.eq(debtDifference, 0)
    && !debt.isEmpty
    && !debt.isFocused;

  const interestRateDifference = interestRate.parsed && dn.sub(interestRate.parsed, dn.mul(loan.interestRate, 100));
  const showInterestRateDifference = interestRateDifference
    && !dn.eq(interestRateDifference, 0)
    && !interestRate.isEmpty
    && !interestRate.isFocused;

  const debtSuggestions = loanDetails.maxDebt && loanDetails.depositUsd
    ? DEBT_SUGGESTIONS.map((ratio) => {
      const debt = loanDetails.maxDebt && dn.mul(loanDetails.maxDebt, ratio);
      const ltv = debt && loanDetails.depositUsd && getLtv(debt, loanDetails.depositUsd);
      const risk = ltv && getLiquidationRisk(ltv, loanDetails.maxLtv);
      return { debt, ltv, risk };
    })
    : null;

  const allowSubmit = account.isConnected
    && deposit.parsed
    && dn.gt(deposit.parsed, 0)
    && debt.parsed
    && dn.gt(debt.parsed, 0)
    && interestRate.parsed
    && dn.gt(interestRate.parsed, 0);

  return (
    <>
      <VFlex gap={48}>
        <Field
          field={
            <InputField
              action={
                <InputTokenBadge
                  icon={<TokenIcon symbol={collateral.symbol} />}
                  label={collateral.name}
                />
              }
              difference={showDepositDifference && `${
                dn.format(depositDifference, {
                  digits: 2,
                  signDisplay: "always",
                })
              }`}
              onDifferenceClick={() => {
                deposit.setValue(dn.toString(loan.deposit));
              }}
              label="Deposit"
              placeholder="0.00"
              secondaryStart={loanDetails.depositUsd
                ? "$" + dn.format(loanDetails.depositUsd, 2)
                : "$0.00"}
              secondaryEnd={
                <TextButton
                  label={`Max ${dn.format(ethMax, 2)} ${collateral.symbol}`}
                  onClick={() => {
                    deposit.setValue(dn.toString(ethMax));
                  }}
                />
              }
              {...deposit.inputFieldProps}
            />
          }
          footer={[[
            // eslint-disable-next-line react/jsx-key
            <Field.FooterInfoEthPrice ethPriceUsd={ethPriceUsd} />,

            // eslint-disable-next-line react/jsx-key
            <Field.FooterInfoMaxLtv maxLtv={loanDetails.maxLtv} />,
          ]]}
        />
        <Field
          field={
            <InputField
              action={
                <InputTokenBadge
                  icon={<TokenIcon symbol="BOLD" />}
                  label="BOLD"
                />
              }
              difference={showDebtDifference && `${
                dn.format(debtDifference, {
                  digits: 2,
                  signDisplay: "always",
                })
              }`}
              onDifferenceClick={() => {
                debt.setValue(dn.toString(loan.borrowed));
              }}
              label="Debt"
              placeholder="0.00"
              secondaryStart={debt.parsed ? `$${dn.format(dn.mul(debt.parsed, boldPriceUsd), 2)}` : "$0.00"}
              secondaryEnd={debtSuggestions && (
                <HFlex gap={6}>
                  {debtSuggestions.map((s) => (
                    s.debt && s.risk && (
                      <PillButton
                        key={dn.toString(s.debt)}
                        label={`$${dn.format(s.debt, { compact: true, digits: 0 })}`}
                        onClick={() => {
                          if (s.debt) {
                            debt.setValue(dn.toString(s.debt, 0));
                          }
                        }}
                        warnLevel={s.risk}
                      />
                    )
                  ))}
                  {debtSuggestions.length > 0 && (
                    <InfoTooltip {...infoTooltipProps(content.borrowScreen.infoTooltips.interestRateSuggestions)} />
                  )}
                </HFlex>
              )}
              {...debt.inputFieldProps}
            />
          }
          footer={[
            [
              // eslint-disable-next-line react/jsx-key
              <Field.FooterInfoLiquidationRisk
                riskLevel={loanDetails.liquidationRisk}
              />,
              // eslint-disable-next-line react/jsx-key
              <Field.FooterInfoLiquidationPrice
                liquidationPrice={loanDetails.liquidationPriceUsd}
              />,
            ],
            [
              null,
              // eslint-disable-next-line react/jsx-key
              <Field.FooterInfoLoanToValue
                ltvRatio={loanDetails.ltv}
                maxLtvRatio={loanDetails.maxLtv}
              />,
            ],
          ]}
        />
        <Field
          // “Interest rate”
          field={
            <InputField
              action={<InputTokenBadge label="% per year" />}
              difference={showInterestRateDifference && `${
                dn.format(interestRateDifference, {
                  digits: 2,
                  signDisplay: "always",
                })
              }`}
              onDifferenceClick={() => {
                interestRate.setValue(dn.toString(dn.mul(loan.interestRate, 100)));
              }}
              label="Interest rate"
              placeholder="0.00"
              secondaryStart={
                <HFlex gap={4}>
                  <div>
                    {boldInterestPerYear
                      ? dn.format(boldInterestPerYear, { digits: 2, trailingZeros: false })
                      : "−"} BOLD / year
                  </div>
                  <InfoTooltip {...infoTooltipProps(content.borrowScreen.infoTooltips.interestRateBoldPerYear)} />
                </HFlex>
              }
              secondaryEnd={
                <HFlex gap={6}>
                  <PillButton
                    label="6.5%"
                    onClick={() => interestRate.setValue("6.5")}
                    warnLevel="low"
                  />
                  <PillButton
                    label="5.0%"
                    onClick={() => interestRate.setValue("5.0")}
                    warnLevel="medium"
                  />
                  <PillButton
                    label="3.5%"
                    onClick={() => interestRate.setValue("3.5")}
                    warnLevel="high"
                  />
                  <InfoTooltip {...infoTooltipProps(content.borrowScreen.infoTooltips.interestRateSuggestions)} />
                </HFlex>
              }
              {...interestRate.inputFieldProps}
            />
          }
          footer={[[
            // eslint-disable-next-line react/jsx-key
            <Field.FooterInfoRedemptionRisk riskLevel={loanDetails.redemptionRisk} />,
            null,
          ]]}
        />
      </VFlex>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 32,
          width: "100%",
        }}
      >
        {!account.isConnected && (
          <div
            className={css({
              paddingTop: 16,
            })}
          >
            <div
              className={css({
                padding: "20px 24px",
                textAlign: "center",
                background: "secondary",
                borderRadius: 8,
              })}
            >
              Please{" "}
              <TextButton
                label="connect"
                onClick={() => {
                  setDemoState({
                    account: { isConnected: true },
                  });
                }}
              />{" "}
              your wallet to continue.
            </div>
          </div>
        )}
        <Button
          disabled={!allowSubmit}
          label="Update position"
          mode="primary"
          size="large"
          wide
          onClick={() => {
            router.push("/transactions/update-loan");
          }}
        />
      </div>
    </>
  );
}

function ClosePositionPanel({
  loan,
}: {
  loan: PositionLoan;
}) {
  const router = useRouter();
  const { account, setDemoState } = useDemoState();
  const ethPriceUsd = usePrice("ETH");
  const boldPriceUsd = usePrice("BOLD");
  const [tokenIndex, setTokenIndex] = useState(0);

  const collateral = TOKENS_BY_SYMBOL[loan.collateral];

  const loanDetails = getLoanDetails(
    loan.deposit,
    loan.borrowed,
    loan.interestRate,
    dn.div(dn.from(1, 18), collateral.collateralRatio),
    ethPriceUsd,
  );

  const allowSubmit = account.isConnected;

  return (
    <>
      <VFlex gap={48}>
        <Field
          field={
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 16,
                justifyContent: "space-between",
              })}
            >
              <div
                className={css({
                  display: "flex",
                  gap: 16,
                  fontSize: 28,
                  lineHeight: 1,
                })}
              >
                <div>
                  {dn.format(
                    tokenIndex === 0
                      ? (loanDetails.debt ?? dn.from(0))
                      : (dn.div(loanDetails.debt ?? dn.from(0), ethPriceUsd)),
                    { digits: 2, trailingZeros: true },
                  )}
                </div>
              </div>
              <Dropdown
                items={(["BOLD", "ETH"] as const).map((symbol) => ({
                  icon: <TokenIcon symbol={symbol} />,
                  label: symbol,
                }))}
                menuWidth={300}
                onSelect={setTokenIndex}
                selected={tokenIndex}
              />
            </div>
          }
          footer={[[
            // eslint-disable-next-line react/jsx-key
            <Field.FooterInfo
              label={`$${dn.format(dn.mul(loan.borrowed, boldPriceUsd), 2)}`}
              value={null}
            />,
            null,
          ]]}
          label="You repay with"
        />
        <Field
          field={
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 16,
                justifyContent: "space-between",
              })}
            >
              <div
                className={css({
                  display: "flex",
                  gap: 16,
                  fontSize: 28,
                  lineHeight: 1,
                })}
              >
                <div>
                  {dn.format(
                    loanDetails.deposit ?? dn.from(0),
                    { digits: 2, trailingZeros: true },
                  )}
                </div>
              </div>
              <div>
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 24,
                  })}
                >
                  <TokenIcon symbol={collateral.symbol} />
                  <div>
                    {collateral.name}
                  </div>
                </div>
              </div>
            </div>
          }
          label="You reclaim"
        />
      </VFlex>
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          color: "contentAlt",
        })}
      >
        <HFlex gap={8}>
          <IconGas />
          Gas
        </HFlex>
        <VFlex gap={12}>
          <div
            className={css({
              color: "content",
            })}
          >
            0.01 ETH
          </div>
          <div>~$32.06</div>
        </VFlex>
      </div>
      <div
        className={css({
          padding: 20,
          textAlign: "center",
          background: "yellow:200",
          borderRadius: 8,
        })}
      >
        You are repaying your debt and closing the position.<br />The deposit will be returned to your wallet.
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 32,
          width: "100%",
        }}
      >
        {!account.isConnected && (
          <div
            className={css({
              paddingTop: 16,
            })}
          >
            <div
              className={css({
                padding: "20px 24px",
                textAlign: "center",
                background: "secondary",
                borderRadius: 8,
              })}
            >
              Please{" "}
              <TextButton
                label="connect"
                onClick={() => {
                  setDemoState({
                    account: { isConnected: true },
                  });
                }}
              />{" "}
              your wallet to continue.
            </div>
          </div>
        )}
        <Button
          disabled={!allowSubmit}
          label="Repay & close"
          mode="primary"
          size="large"
          wide
          onClick={() => {
            router.push("/transactions/close-loan");
          }}
        />
      </div>
    </>
  );
}

function InputTokenBadge({
  label,
  icon,
}: {
  label: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 40,
        padding: "0 16px",
        fontSize: 24,
        background: "#FFF",
        borderRadius: 20,
        userSelect: "none",
      })}
      style={{
        paddingLeft: icon ? 8 : 16,
      }}
    >
      {icon}
      <div>
        {label}
      </div>
    </div>
  );
}
