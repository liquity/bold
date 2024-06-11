"use client";

import type { RiskLevel } from "@/src/types";
import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { Field } from "@/src/comps/Field/Field";
import { Screen } from "@/src/comps/Screen/Screen";
import { COLLATERAL_RATIO, LEVERAGE_FACTOR_DEFAULT, LEVERAGE_FACTOR_MAX, LEVERAGE_FACTOR_MIN } from "@/src/constants";
import content from "@/src/content";
import { ACCOUNT_BALANCES, LTV_RISK, REDEMPTION_RISK } from "@/src/demo-data";
import { useInputFieldValue } from "@/src/form-utils";
import { lerp, norm } from "@/src/math-utils";
import { usePrice } from "@/src/prices";
import { css } from "@/styled-system/css";
import {
  Button,
  COLLATERALS,
  Dropdown,
  HFlex,
  InfoTooltip,
  InputField,
  PillButton,
  Slider,
  TextButton,
  TokenIcon,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { match, P } from "ts-pattern";
import { useAccount } from "wagmi";

const collateralSymbols = COLLATERALS.map(({ symbol }) => symbol);

function isCollateralSymbol(symbol: string): symbol is typeof collateralSymbols[number] {
  const c: string[] = collateralSymbols;
  return c.includes(symbol);
}

export function LeverageScreen() {
  const account = useAccount();
  const router = useRouter();
  const ethPrice = usePrice("ETH");

  // useParams() can return an array, but not with the current
  // routing setup so we can safely assume it’s a string
  const collateral = String(useParams().collateral ?? "eth").toUpperCase();
  if (!isCollateralSymbol(collateral)) {
    throw new Error(`Invalid collateral symbol: ${collateral}`);
  }
  const collateralIndex = collateralSymbols.indexOf(collateral);

  const deposit = useInputFieldValue((value) => `${dn.format(value)} ${collateral}`);
  const interestRate = useInputFieldValue((value) => `${dn.format(value)}%`);

  const [liqPriceFocused, setLiqPriceFocused] = useState(false);

  const ethLiqPrice = useInputFieldValue((value) => `$ ${dn.format(value)}`, {
    defaultValue: dn.toString(leveragedLiquidationPrice(ethPrice, LEVERAGE_FACTOR_DEFAULT), 2),
    onChange: ({ parsed: price }) => {
      if (price) {
        updateLeverageFactorFromLiquidationPrice(price);
      }
    },
    onFocusChange: ({ focus }) => {
      setLiqPriceFocused(focus);

      // recalculate exact liquidation price based on the selected leverage factor
      if (!focus) {
        ethLiqPrice.setValue(dn.toString(leveragedLiquidationPrice(ethPrice, leverageFactor), 2));
      }
    },
  });

  const [leverageFactor, setLeverageFactor] = useState(LEVERAGE_FACTOR_DEFAULT);

  const depositUsd = deposit.parsed && dn.mul(deposit.parsed, ethPrice);
  const leveragedDeposit = deposit.parsed ? dn.mul(deposit.parsed, leverageFactor) : null;
  const totalDebtUsd = depositUsd && dn.mul(dn.sub(leverageFactor, dn.from(1, 18)), depositUsd);

  const ltv = ltvFromLeverageFactor(leverageFactor);

  // update liquidation price when ETH price changes
  useEffect(() => {
    if (!liqPriceFocused) {
      ethLiqPrice.setValue(
        dn.toString(leveragedLiquidationPrice(ethPrice, leverageFactor), 2),
      );
    }
  }, [ethPrice, leverageFactor, liqPriceFocused]);

  const liquidationRisk: null | RiskLevel = match(ltv)
    .with(P.nullish, () => null)
    .when((ltv) => dn.gt(ltv, LTV_RISK.high), () => "high" as const)
    .when((ltv) => dn.gt(ltv, LTV_RISK.medium), () => "medium" as const)
    .otherwise(() => "low" as const);

  const redemptionRisk: null | RiskLevel = match(interestRate.parsed)
    .with(P.nullish, () => null)
    .when((r) => dn.gt(r, REDEMPTION_RISK.low), () => "low" as const)
    .when((r) => dn.gt(r, REDEMPTION_RISK.medium), () => "medium" as const)
    .otherwise(() => "high" as const);

  const updateLeverageFactor = (factor: number) => {
    setLeverageFactor(factor);
    ethLiqPrice.setValue(
      dn.toString(leveragedLiquidationPrice(ethPrice, factor), 2),
    );
  };

  const updateLeverageFactorFromLiquidationPrice = (liquidationPrice: Dnum) => {
    const liquidationPriceMin = leveragedLiquidationPrice(ethPrice, LEVERAGE_FACTOR_MIN);
    const liquidationPriceMax = leveragedLiquidationPrice(ethPrice, LEVERAGE_FACTOR_MAX);
    const leverageFactor = leverageFactorFromLiquidationPrice(ethPrice, liquidationPrice);
    setLeverageFactor(
      match(liquidationPrice)
        .when((l) => dn.lt(l, liquidationPriceMin), () => LEVERAGE_FACTOR_MIN)
        .when((l) => dn.gt(l, liquidationPriceMax), () => LEVERAGE_FACTOR_MAX)
        .otherwise(() => leverageFactor),
    );
  };

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
              action={
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
                      deposit.setValue("");
                      deposit.focus();
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
              secondaryStart={depositUsd && `$${dn.format(depositUsd, 2)}`}
              secondaryEnd={account.isConnected && (
                <TextButton
                  label={`Max. ${dn.format(ACCOUNT_BALANCES[collateral])} ${collateral}`}
                  onClick={() => {
                    deposit.setValue(dn.toString(ACCOUNT_BALANCES[collateral]));
                  }}
                />
              )}
              {...deposit.inputFieldProps}
            />
          }
          footerStart={
            <HFlex>
              <span
                className={css({
                  color: "contentAlt",
                })}
              >
                Leveraged
              </span>
              <span
                className={css({
                  fontVariantNumeric: "tabular-nums",
                })}
              >
                {leveragedDeposit && dn.gt(leveragedDeposit, 0)
                  ? `${
                    dn.format(leveragedDeposit, {
                      digits: 2,
                      trailingZeros: true,
                    })
                  } ETH`
                  : "−"}
              </span>
              <InfoTooltip heading="Leveraged deposit">
                A redemption is an event where the borrower’s collateral is exchanged for a corresponding amount of Bold
                stablecoins. At the time of the exchange a borrower does not lose any money.
              </InfoTooltip>
            </HFlex>
          }
          footerEnd={
            <Field.FooterInfo
              label="Max LTV"
              value={
                <HFlex gap={4}>
                  <div>80.00%</div>
                  <InfoTooltip heading="Max LTV">
                    A redemption is an event where the borrower’s collateral is exchanged for a corresponding amount of
                    Bold stablecoins. At the time of the exchange a borrower does not lose any money.
                  </InfoTooltip>
                </HFlex>
              }
            />
          }
        />

        <Field
          // ETH Liquidation price
          field={
            <InputField
              action={
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 300,
                  }}
                >
                  <Slider
                    gradientMode={true}
                    onChange={(value) => {
                      updateLeverageFactor(
                        Math.round(
                          lerp(LEVERAGE_FACTOR_MIN, LEVERAGE_FACTOR_MAX, value) * 10,
                        ) / 10,
                      );
                    }}
                    value={norm(leverageFactor, LEVERAGE_FACTOR_MIN, LEVERAGE_FACTOR_MAX)}
                  />
                </div>
              }
              label={content.leverageScreen.liquidationPriceField.label}
              actionLabel={
                <span>
                  Leverage{" "}
                  <span
                    style={{
                      color: (
                          liquidationRisk === "high"
                        )
                        ? "#F36740"
                        : "#2F3037",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {dn.format([BigInt(Math.round(leverageFactor * 10)), 1], {
                      digits: 1,
                      trailingZeros: true,
                    })}x
                  </span>
                </span>
              }
              placeholder="0.00"
              secondaryStart={
                <>
                  Total debt {totalDebtUsd && dn.gt(totalDebtUsd, 0)
                    ? (
                      <span
                        className={css({
                          fontVariantNumeric: "tabular-nums",
                        })}
                      >
                        ${dn.format(totalDebtUsd, {
                          digits: 2,
                          trailingZeros: true,
                        })}
                      </span>
                    )
                    : "−"}
                </>
              }
              secondaryEnd={
                <HFlex gap={6}>
                  <PillButton
                    label="1.5x"
                    onClick={() => updateLeverageFactor(1.5)}
                    warnLevel="low"
                  />
                  <PillButton
                    label="2.5x"
                    onClick={() => updateLeverageFactor(2.5)}
                    warnLevel="medium"
                  />
                  <PillButton
                    label="5.0x"
                    onClick={() => updateLeverageFactor(5.0)}
                    warnLevel="high"
                  />
                  <InfoTooltip heading="Leverage level">
                    A redemption is an event where the borrower’s collateral is exchanged for a corresponding amount of
                    Bold stablecoins. At the time of the exchange a borrower does not lose any money.
                  </InfoTooltip>
                </HFlex>
              }
              {...ethLiqPrice.inputFieldProps}
            />
          }
          footerStart={liquidationRisk && (
            <>
              <Field.FooterInfoWarnLevel
                label={match(liquidationRisk)
                  .with("low", () => "Low liq. risk")
                  .with("medium", () => "Medium liq. risk")
                  .with("high", () => "High liq. risk")
                  .exhaustive()}
                level={liquidationRisk}
              />
              <Field.FooterInfo
                label="LTV"
                value={
                  <HFlex gap={4}>
                    {ltv
                      ? (
                        <span
                          className={css({
                            fontVariantNumeric: "tabular-nums",
                          })}
                        >
                          {dn.format(dn.mul(ltv, 100), {
                            digits: 2,
                            trailingZeros: true,
                          })}%
                        </span>
                      )
                      : "−"}
                    <InfoTooltip heading="LTV">
                      A redemption is an event where the borrower’s collateral is exchanged for a corresponding amount
                      of Bold stablecoins. At the time of the exchange a borrower does not lose any money.
                    </InfoTooltip>
                  </HFlex>
                }
              />
            </>
          )}
          footerEnd={liquidationRisk && (
            <Field.FooterInfo
              label="ETH Price"
              value={
                <HFlex gap={4}>
                  <span
                    className={css({
                      fontVariantNumeric: "tabular-nums",
                    })}
                  >
                    ${dn.format(ethPrice, {
                      digits: 2,
                      trailingZeros: true,
                    })}
                  </span>
                  <InfoTooltip heading="LTV">
                    A redemption is an event where the borrower’s collateral is exchanged for a corresponding amount of
                    Bold stablecoins. At the time of the exchange a borrower does not lose any money.
                  </InfoTooltip>
                </HFlex>
              }
            />
          )}
        />

        <Field
          // “Interest rate”
          field={
            <InputField
              action={<StaticAction label="% per year" />}
              label={content.leverageScreen.interestRateField.label}
              placeholder="0.00"
              secondaryStart={
                <HFlex gap={4}>
                  <div>0 BOLD / year</div>
                  <InfoTooltip heading="Interest rate">
                    A redemption is an event where the borrower’s collateral is exchanged for a corresponding amount of
                    Bold stablecoins. At the time of the exchange a borrower does not lose any money.
                  </InfoTooltip>
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
                  <InfoTooltip heading="Interest rate">
                    A redemption is an event where the borrower’s collateral is exchanged for a corresponding amount of
                    Bold stablecoins. At the time of the exchange a borrower does not lose any money.
                  </InfoTooltip>
                </HFlex>
              }
              {...interestRate.inputFieldProps}
            />
          }
          footerStart={redemptionRisk && (
            <Field.FooterInfoWarnLevel
              label={match(redemptionRisk)
                .with("low", () => "Low redemption risk")
                .with("medium", () => "Medium redemption risk")
                .with("high", () => "High redemption risk")
                .exhaustive()}
              level={redemptionRisk}
            />
          )}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <Button
            disabled={!(
              deposit.parsed
              && dn.gt(deposit.parsed, 0)
              && interestRate.parsed
              && dn.gt(interestRate.parsed, 0)
            )}
            label={content.leverageScreen.action}
            mode="primary"
            size="large"
            wide
          />
        </div>
      </div>
    </Screen>
  );
}

function StaticAction({
  label,
  icon,
}: {
  label: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 40,
        padding: "0 16px",
        paddingLeft: icon ? 8 : 16,
        background: "#FFF",
        borderRadius: 20,
        userSelect: "none",
      }}
    >
      {icon}
      <div
        style={{
          fontSize: 24,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// e.g. $4000 per ETH @ 1.5x, returns $3248.63 liq. price
function leveragedLiquidationPrice(
  ethPrice: Dnum,
  leverage: number,
) {
  return dn.div(
    dn.sub(dn.mul(leverage, ethPrice), ethPrice),
    dn.sub(leverage, dn.div(dn.from(1, 18), COLLATERAL_RATIO)),
  );
}

// e.g. $4000 per ETH, $3248.63 liq. price returns 1.5x
function leverageFactorFromLiquidationPrice(
  ethPrice: Dnum,
  liquidationPrice: Dnum,
) {
  return Math.round(
    dn.toNumber(dn.div(
      dn.sub(
        dn.mul(liquidationPrice, dn.div(dn.from(1, 18), COLLATERAL_RATIO)),
        ethPrice,
      ),
      dn.sub(liquidationPrice, ethPrice),
    )) * 10,
  ) / 10;
}

function ltvFromLeverageFactor(leverageFactor: number) {
  return dn.div(dn.sub(leverageFactor, dn.from(1, 18)), leverageFactor);
}
