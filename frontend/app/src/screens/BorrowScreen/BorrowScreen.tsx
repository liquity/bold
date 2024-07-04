"use client";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { Forecast } from "@/src/comps/Forecast/Forecast";
import { Screen } from "@/src/comps/Screen/Screen";
import { DEBT_SUGGESTIONS } from "@/src/constants";
import content from "@/src/content";
import { ACCOUNT_BALANCES } from "@/src/demo-mode";
import { useAccount } from "@/src/eth/Ethereum";
import { useInputFieldValue } from "@/src/form-utils";
import { getLiquidationRisk, getLoanDetails, getLtv } from "@/src/liquity-math";
import { usePrice } from "@/src/prices";
import { infoTooltipProps } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  Button,
  COLLATERALS,
  Dropdown,
  HFlex,
  IconChevronSmallUp,
  InfoTooltip,
  InputField,
  PillButton,
  TextButton,
  TokenIcon,
  VFlex,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

const collateralSymbols = COLLATERALS.map(({ symbol }) => symbol);

function isCollateralSymbol(symbol: string): symbol is typeof collateralSymbols[number] {
  const c: string[] = collateralSymbols;
  return c.includes(symbol);
}

export function BorrowScreen() {
  // const demoMode = useDemoMode();
  const account = useAccount();

  const router = useRouter();
  const ethPriceUsd = usePrice("ETH");
  const boldPriceUsd = usePrice("BOLD");

  // useParams() can return an array, but not with the current
  // routing setup so we can safely assume it’s a string
  const collateral = String(useParams().collateral ?? "eth").toUpperCase();
  if (!isCollateralSymbol(collateral)) {
    throw new Error(`Invalid collateral symbol: ${collateral}`);
  }
  const collateralIndex = collateralSymbols.indexOf(collateral);
  const { collateralRatio } = COLLATERALS[collateralIndex];

  const deposit = useInputFieldValue((value) => `${dn.format(value)} ${collateral}`);
  const debt = useInputFieldValue((value) => `${dn.format(value)} BOLD`);
  const interestRate = useInputFieldValue((value) => `${dn.format(value)}%`);

  if (!ethPriceUsd || !boldPriceUsd) {
    return null;
  }

  const loanDetails = getLoanDetails(
    deposit.isEmpty ? null : deposit.parsed,
    debt.isEmpty ? null : debt.parsed,
    interestRate.parsed && dn.div(interestRate.parsed, 100),
    dn.div(dn.from(1, 18), collateralRatio),
    ethPriceUsd,
  );

  const debtSuggestions = loanDetails.maxDebt
      && loanDetails.depositUsd
      && loanDetails.deposit
      && dn.gt(loanDetails.deposit, 0)
    ? DEBT_SUGGESTIONS.map((ratio) => {
      const debt = loanDetails.maxDebt && dn.mul(loanDetails.maxDebt, ratio);
      const ltv = debt && loanDetails.depositUsd && getLtv(debt, loanDetails.depositUsd);
      const risk = ltv && getLiquidationRisk(ltv, loanDetails.maxLtv);
      return { debt, ltv, risk };
    })
    : null;

  const boldInterestPerYear = interestRate.parsed
    && debt.parsed
    && dn.mul(debt.parsed, dn.div(interestRate.parsed, 100));

  const allowSubmit = account.isConnected
    && deposit.parsed
    && dn.gt(deposit.parsed, 0)
    && debt.parsed
    && dn.gt(debt.parsed, 0)
    && interestRate.parsed
    && dn.gt(interestRate.parsed, 0);

  const [showForecast, setShowForecast] = useState(false);

  return (
    <Screen
      title={
        <HFlex>
          {content.borrowScreen.headline(
            <TokenIcon.Group>
              {COLLATERALS.map(({ symbol }) => (
                <TokenIcon
                  key={symbol}
                  symbol={symbol}
                />
              ))}
            </TokenIcon.Group>,
            <TokenIcon symbol="BOLD" />,
          )}
        </HFlex>
      }
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 48,
          width: 534,
        })}
      >
        <Field
          // “You deposit”
          field={
            <InputField
              contextual={
                <Dropdown
                  items={COLLATERALS.map(({ symbol, name }) => ({
                    icon: <TokenIcon symbol={symbol} />,
                    label: name,
                    value: account.isConnected ? dn.format(ACCOUNT_BALANCES[symbol]) : "−",
                  }))}
                  menuPlacement="end"
                  menuWidth={300}
                  onSelect={(index) => {
                    deposit.setValue("");
                    router.push(
                      `/borrow/${COLLATERALS[index].symbol.toLowerCase()}`,
                      { scroll: false },
                    );
                  }}
                  selected={collateralIndex}
                />
              }
              label={content.borrowScreen.depositField.label}
              placeholder="0.00"
              secondary={{
                start: `$${
                  deposit.parsed
                    ? dn.format(dn.mul(ethPriceUsd, deposit.parsed), 2)
                    : "0.00"
                }`,
                end: account.isConnected && (
                  <TextButton
                    label={`Max ${dn.format(ACCOUNT_BALANCES[collateral])} ${collateral}`}
                    onClick={() => {
                      deposit.setValue(
                        dn.format(ACCOUNT_BALANCES[collateral]).replace(",", ""),
                      );
                    }}
                  />
                ),
              }}
              {...deposit.inputFieldProps}
            />
          }
          footer={[
            [
              // eslint-disable-next-line react/jsx-key
              <Field.FooterInfoEthPrice ethPriceUsd={ethPriceUsd} />,

              // eslint-disable-next-line react/jsx-key
              <Field.FooterInfoMaxLtv maxLtv={loanDetails.maxLtv} />,
            ],
          ]}
        />

        <Field
          // “You borrow”
          field={
            <InputField
              contextual={
                <InputField.Badge
                  icon={<TokenIcon symbol="BOLD" />}
                  label="BOLD"
                />
              }
              label={content.borrowScreen.borrowField.label}
              placeholder="0.00"
              secondary={{
                start: `$${
                  debt.parsed
                    ? dn.gt(dn.mul(boldPriceUsd, debt.parsed), 1_000_000_000_000)
                      ? "−"
                      : dn.format(
                        dn.mul(boldPriceUsd, debt.parsed),
                        { digits: 2, trailingZeros: true, compact: dn.gt(debt.parsed, 1_000_000_000) },
                      )
                    : "0.00"
                }`,
                end: debtSuggestions && (
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
                ),
              }}
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

        <VFlex gap={0}>
          <Field
            // “Interest rate”
            field={
              <InputField
                contextual={<InputField.Badge label="% per year" />}
                label={content.borrowScreen.interestRateField.label}
                placeholder="0.00"
                secondary={{
                  start: (
                    <HFlex gap={4}>
                      <div>
                        {boldInterestPerYear
                          ? dn.format(boldInterestPerYear, { digits: 2, trailingZeros: false })
                          : "−"} BOLD / year
                      </div>
                      <InfoTooltip {...infoTooltipProps(content.borrowScreen.infoTooltips.interestRateBoldPerYear)} />
                    </HFlex>
                  ),
                  end: (
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
                  ),
                }}
                {...interestRate.inputFieldProps}
              />
            }
            footer={[
              [
                // eslint-disable-next-line react/jsx-key
                <Field.FooterInfoRedemptionRisk riskLevel={loanDetails.redemptionRisk} />,

                // eslint-disable-next-line react/jsx-key
                <TextButton
                  onClick={() => setShowForecast(!showForecast)}
                  label={
                    <>
                      <div>
                        Redemption forecast
                      </div>
                      <div
                        className={css({
                          transform: showForecast ? "rotate(0)" : "rotate(180deg)",
                          transition: "transform 150ms",
                        })}
                      >
                        <IconChevronSmallUp size={14} />
                      </div>
                    </>
                  }
                />,
              ],
            ]}
          />
          <Forecast opened={showForecast} />
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
          <ConnectWarningBox />
          <Button
            disabled={!allowSubmit}
            label={content.borrowScreen.action}
            mode="primary"
            size="large"
            wide
            onClick={() => {
              router.push("/transactions/borrow");
            }}
          />
        </div>
      </div>
    </Screen>
  );
}
