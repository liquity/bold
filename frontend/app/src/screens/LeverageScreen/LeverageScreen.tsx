"use client";

import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { Field } from "@/src/comps/Field/Field";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { useInputFieldValue } from "@/src/form-utils";
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
import { useState } from "react";
import { match } from "ts-pattern";

const collateralSymbols = COLLATERALS.map(({ symbol }) => symbol);

function isCollateralSymbol(symbol: string): symbol is typeof collateralSymbols[number] {
  const c: string[] = collateralSymbols;
  return c.includes(symbol);
}

export function LeverageScreen() {
  const router = useRouter();

  // useParams() can return an array, but not with the current
  // routing setup so we can safely assume it’s a string
  const collateral = String(useParams().collateral ?? "eth").toUpperCase();
  const collateralIndex = isCollateralSymbol(collateral) ? collateralSymbols.indexOf(collateral) : 0;

  const deposit = useInputFieldValue((value) => `${dn.format(value)} ${collateral}`);
  const interestRate = useInputFieldValue((value) => `${dn.format(value)}%`);
  const ethLiqPrice = useInputFieldValue((value) => `$ ${dn.format(value)}`);

  const [leverage, setLeverage] = useState(0);
  const maxLeverage = 5; // 6.0x

  const liquidationRisk: null | {
    ethPrice: Dnum;
    level: "low" | "medium" | "high";
    ltv: string;
  } = deposit.parsed && dn.gt(deposit.parsed, 0)
    ? {
      ethPrice: dn.from(1200),
      level: match(leverage)
        .when((l) => l <= 1, () => "low" as const)
        .when((l) => l <= 3, () => "medium" as const)
        .otherwise(() => "high" as const),
      ltv: "33.00%",
    }
    : null;

  const redemptionRiskLevel = interestRate.parsed
    && dn.gt(interestRate.parsed, 0)
    && (
      match(interestRate.parsed)
        .when((r) => dn.lt(r, 3.6), () => "high" as const)
        .when((r) => dn.lt(r, 5.1), () => "medium" as const)
        .otherwise(() => "low" as const)
    );

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
                    value: "0.00",
                  }))}
                  menuPlacement="end"
                  menuWidth={300}
                  onSelect={(index) => {
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
              secondaryStart="$0.00"
              secondaryEnd={
                <TextButton
                  label={`Max. 10.00 ${collateral}`}
                  onClick={() => deposit.setValue("10.00")}
                />
              }
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
                ETH stats
              </span>
              <span>{0}</span>
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
          // “ETH Liquidation price”
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
                      setLeverage(Math.round(value * maxLeverage * 10) / 10);
                    }}
                    value={leverage / maxLeverage}
                  />
                </div>
              }
              label={content.leverageScreen.liquidationPriceField.label}
              actionLabel={
                <span>
                  Leverage{" "}
                  <span
                    style={{
                      color: leverage > 3 ? "#F36740" : "#2F3037",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {dn.format([BigInt(Math.round((leverage + 1) * 10)), 1], {
                      digits: 1,
                      trailingZeros: true,
                    })}x
                  </span>
                </span>
              }
              placeholder="0.00"
              secondaryStart="Total debt 0 BOLD"
              secondaryEnd={
                <HFlex gap={6}>
                  <PillButton
                    label="1.5x"
                    onClick={() => setLeverage(0.5)}
                    warnLevel="low"
                  />
                  <PillButton
                    label="2.5x"
                    onClick={() => setLeverage(1.5)}
                    warnLevel="medium"
                  />
                  <PillButton
                    label="5.0x"
                    onClick={() => setLeverage(4.0)}
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
                label={`${
                  match(liquidationRisk.level)
                    .with("low", () => "Low")
                    .with("medium", () => "Medium")
                    .with("high", () => "High")
                    .exhaustive()
                } liq. risk`}
                level={liquidationRisk.level}
              />
              <Field.FooterInfo
                label="LTV"
                value={
                  <HFlex gap={4}>
                    {liquidationRisk.ltv}
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
              label="Liq. ETH Price"
              value={
                <HFlex gap={4}>
                  ${dn.format(liquidationRisk.ethPrice, 2)}
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
          footerStart={
            // e.g. “Medium redemption risk”
            redemptionRiskLevel && (
              <Field.FooterInfoWarnLevel
                label={`${
                  match(redemptionRiskLevel)
                    .with("low", () => "Low")
                    .with("medium", () => "Medium")
                    .with("high", () => "High")
                    .exhaustive()
                } redemption risk`}
                level={redemptionRiskLevel}
              />
            )
          }
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
