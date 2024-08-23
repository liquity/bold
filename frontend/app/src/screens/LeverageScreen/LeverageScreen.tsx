"use client";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { LeverageField, useLeverageField } from "@/src/comps/LeverageField/LeverageField";
import { RedemptionInfo } from "@/src/comps/RedemptionInfo/RedemptionInfo";
import { Screen } from "@/src/comps/Screen/Screen";
import { INTEREST_RATE_INCREMENT, INTEREST_RATE_MAX, INTEREST_RATE_MIN } from "@/src/constants";
import content from "@/src/content";
import { ACCOUNT_BALANCES, getDebtBeforeRateBucketIndex, INTEREST_CHART } from "@/src/demo-mode";
import { useInputFieldValue } from "@/src/form-utils";
import { getRedemptionRisk } from "@/src/liquity-math";
import { useAccount } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { infoTooltipProps } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  Button,
  COLLATERALS,
  Dropdown,
  HFlex,
  IconSuggestion,
  InfoTooltip,
  InputField,
  lerp,
  norm,
  Slider,
  TextButton,
  TokenIcon,
  VFlex,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

const collateralSymbols = COLLATERALS.map(({ symbol }) => symbol);

function isCollateralSymbol(symbol: string): symbol is typeof collateralSymbols[number] {
  const c: string[] = collateralSymbols;
  return c.includes(symbol);
}

export function LeverageScreen() {
  const account = useAccount();
  const router = useRouter();

  // useParams() can return an array, but not with the current
  // routing setup so we can safely assume it’s a string
  const collSymbol = String(useParams().collateral ?? "eth").toUpperCase();
  if (!isCollateralSymbol(collSymbol)) {
    throw new Error(`Invalid collateral symbol: ${collSymbol}`);
  }
  const collateralIndex = collateralSymbols.indexOf(collSymbol);
  const collateral = COLLATERALS[collateralIndex];

  const boldPriceUsd = usePrice("BOLD") ?? dn.from(0, 18);
  const collPrice = usePrice(collateral.symbol) ?? dn.from(0, 18);

  const depositPreLeverage = useInputFieldValue((value) => `${dn.format(value)} ${collateral.name}`);
  const interestRate = useInputFieldValue((value) => `${dn.format(value)}%`);

  const ethPriceBold = dn.mul(collPrice, boldPriceUsd);

  const depositUsd = depositPreLeverage.parsed && dn.mul(depositPreLeverage.parsed, collPrice);
  const depositBold = depositPreLeverage.parsed && dn.mul(depositPreLeverage.parsed, ethPriceBold);

  const leverageField = useLeverageField({
    updatePriority: "liquidationPrice",
    depositPreLeverage: depositPreLeverage.parsed,
    collPrice,
    collToken: COLLATERALS[collateralIndex],
  });

  const totalDebtBold = depositBold && dn.mul(
    dn.sub(leverageField.leverageFactor, dn.from(1, 18)),
    depositBold,
  );

  const redemptionRisk = getRedemptionRisk(
    interestRate.parsed && dn.div(interestRate.parsed, 100),
  );

  // reset leverage when collateral changes
  useEffect(() => {
    leverageField.updateLeverageFactor(leverageField.leverageFactorSuggestions[0]);
  }, [collateral.symbol, leverageField.leverageFactorSuggestions]);

  const boldInterestPerYear = interestRate.parsed
    && totalDebtBold
    && dn.gt(depositBold, 0)
    && dn.div(totalDebtBold, depositBold);

  const boldRedeemableInFront = dn.format(
    getDebtBeforeRateBucketIndex(
      interestRate.parsed
        ? Math.round((dn.toNumber(interestRate.parsed) - INTEREST_RATE_MIN) / INTEREST_RATE_INCREMENT)
        : 0,
    ),
    { compact: true },
  );

  const allowSubmit = account.isConnected
    && depositPreLeverage.parsed
    && dn.gt(depositPreLeverage.parsed, 0)
    && interestRate.parsed
    && dn.gt(interestRate.parsed, 0);

  return (
    <Screen
      title={
        <HFlex>
          {content.leverageScreen.headline(
            <TokenIcon.Group>
              {COLLATERALS.map(({ symbol }) => (
                <TokenIcon
                  key={symbol}
                  symbol={symbol}
                />
              ))}
            </TokenIcon.Group>,
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
                    setTimeout(() => {
                      depositPreLeverage.setValue("");
                      depositPreLeverage.focus();
                    }, 0);
                    router.push(
                      `/leverage/${COLLATERALS[index].symbol.toLowerCase()}`,
                      { scroll: false },
                    );
                  }}
                  selected={collateralIndex}
                />
              }
              label={content.leverageScreen.depositField.label}
              placeholder="0.00"
              secondary={{
                start: depositUsd && `$${
                  dn.format(depositUsd, {
                    digits: 2,
                    trailingZeros: true,
                  })
                }`,
                end: account.isConnected && (
                  <TextButton
                    label={`Max ${dn.format(ACCOUNT_BALANCES[collateral.symbol])} ${collateral.name}`}
                    onClick={() => {
                      depositPreLeverage.setValue(dn.toString(ACCOUNT_BALANCES[collateral.symbol]));
                    }}
                  />
                ),
              }}
              {...depositPreLeverage.inputFieldProps}
            />
          }
          footer={[[
            // eslint-disable-next-line react/jsx-key
            <Field.FooterInfoCollPrice
              collName={collateral.name}
              collPriceUsd={collPrice}
            />,

            // eslint-disable-next-line react/jsx-key
            <Field.FooterInfoMaxLtv
              maxLtv={dn.div(dn.from(1, 18), collateral.collateralRatio)}
            />,
          ]]}
        />

        <LeverageField {...leverageField} />

        <VFlex gap={0}>
          <Field
            // “Interest rate”
            field={
              <InputField
                contextual={
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 300,
                    }}
                  >
                    <Slider
                      gradient={[1 / 3, 2 / 3]}
                      chart={INTEREST_CHART}
                      onChange={(value) => {
                        interestRate.setValue(
                          String(Math.round(lerp(INTEREST_RATE_MIN, INTEREST_RATE_MAX, value) * 10) / 10),
                        );
                      }}
                      value={norm(
                        interestRate.parsed ? dn.toNumber(interestRate.parsed) : 0,
                        INTEREST_RATE_MIN,
                        INTEREST_RATE_MAX,
                      )}
                    />
                  </div>
                }
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
                    <span>
                      <span>{"Before you "}</span>
                      <span
                        className={css({
                          color: "content",
                        })}
                      >
                        <span
                          style={{
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {boldRedeemableInFront}
                        </span>
                        <span>{" BOLD to redeem"}</span>
                      </span>
                    </span>
                  ),
                }}
                {...interestRate.inputFieldProps}
                valueUnfocused={(!interestRate.isEmpty && interestRate.parsed)
                  ? (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <span
                        style={{
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {dn.format(interestRate.parsed, { digits: 1, trailingZeros: true })}
                      </span>
                      <span
                        style={{
                          color: "#878AA4",
                          fontSize: 24,
                        }}
                      >
                        % per year
                      </span>
                    </span>
                  )
                  : null}
              />
            }
            footer={[
              [
                // eslint-disable-next-line react/jsx-key
                <Field.FooterInfoRedemptionRisk riskLevel={redemptionRisk} />,
                <span
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: "contentAlt",
                  })}
                >
                  <IconSuggestion size={16} />
                  <span>You can adjust interest rate later</span>
                </span>,
              ],
            ]}
          />
        </VFlex>

        <RedemptionInfo />

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
            label={content.leverageScreen.action}
            mode="primary"
            size="large"
            onClick={() => {
              router.push("/transactions/leverage");
            }}
            wide
          />
        </div>
      </div>
    </Screen>
  );
}
