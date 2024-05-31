"use client";

import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { Field, FieldInfo, FieldInfoWarnLevel } from "@/src/comps/Field/Field";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { POOLS } from "@/src/demo-data";
import { parseInputFloat } from "@/src/form-utils";
import { css } from "@/styled-system/css";
import {
  Button,
  Dropdown,
  HFlex,
  InfoTooltip,
  InputField,
  PillButton,
  Slider,
  Tabs,
  TextButton,
  TokenIcon,
  VFlex,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter, useSelectedLayoutSegment } from "next/navigation";
import { useEffect, useState } from "react";
import { match } from "ts-pattern";

const TABS = [
  { label: "Borrow BOLD", id: "borrow" },
  { label: "Leverage ETH", id: "leverage" },
];

function poolIndexFromSymbol(symbol: string) {
  return POOLS.findIndex(({ symbol: s }) => (
    s.toLowerCase() === symbol.toLowerCase()
  ));
}

export function BorrowLeverageScreen() {
  const router = useRouter();
  const type = useSelectedLayoutSegment();
  const { collateral = "eth" } = useParams();

  const [
    depositPoolIndex,
    setDepositPoolIndex,
  ] = useState(poolIndexFromSymbol(String(collateral)));

  useEffect(() => {
    setDepositPoolIndex(poolIndexFromSymbol(String(collateral)));
  }, [collateral]);

  const pool = POOLS[depositPoolIndex];

  const deposit = useInputFieldValue((value) => `${dn.format(value)} ${pool.symbol}`);
  const borrowing = useInputFieldValue((value) => `${dn.format(value)} BOLD`);
  const interestRate = useInputFieldValue((value) => `${dn.format(value)}%`);
  const ethLiqPrice = useInputFieldValue((value) => `$ ${dn.format(value)}`);

  const [leverage, setLeverage] = useState(0);
  const maxLeverage = 5; // 6.0x

  const liquidationRisk: null | {
    ethPrice: Dnum;
    level: "low" | "medium" | "high";
    ltv: string;
  } = deposit.parsed && dn.gt(deposit.parsed, 0)
      && borrowing.parsed && dn.gt(borrowing.parsed, 0)
    ? {
      ethPrice: dn.from(1200),
      level: type === "leverage"
        ? match(leverage)
          .when((l) => l <= 1, () => "low" as const)
          .when((l) => l <= 3, () => "medium" as const)
          .otherwise(() => "high" as const)
        : "low",
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
          {content.borrowScreen.headline(
            <TokenIcon.Group>
              {POOLS.map(({ symbol }) => (
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
              action={
                <Dropdown
                  items={POOLS.map(({ symbol, token }) => ({
                    icon: <TokenIcon symbol={symbol} />,
                    label: token,
                    value: "0.00",
                  }))}
                  menuPlacement="end"
                  menuWidth={300}
                  onSelect={(index) => {
                    router.push(
                      `/${type}/${POOLS[index].symbol.toLowerCase()}`,
                      { scroll: false },
                    );
                  }}
                  selected={depositPoolIndex}
                />
              }
              label={content.borrowScreen.depositField.label}
              placeholder="0.00"
              secondaryStart="$0.00"
              secondaryEnd={
                <TextButton
                  label={`Max. 10.00 ${pool.symbol}`}
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
                Voting rights
              </span>
              <span>{0}</span>
            </HFlex>
          }
          footerEnd={
            <FieldInfo
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

        <VFlex gap={24}>
          <Tabs
            items={TABS.map(({ label, id }) => ({
              label,
              panelId: `p-${id}`,
              tabId: `t-${id}`,
            }))}
            onSelect={(index) => {
              router.push(
                `/${TABS[index].id}/${pool.symbol.toLowerCase()}`,
                { scroll: false },
              );
            }}
            selected={type === "borrow" ? 0 : 1}
          />

          {type === "borrow" && (
            <Field
              // “You borrow”
              field={
                <InputField
                  action={
                    <StaticAction
                      icon={<TokenIcon symbol="BOLD" />}
                      label="BOLD"
                    />
                  }
                  label={content.borrowScreen.borrowField.label}
                  placeholder="0.00"
                  secondaryStart="$0.00"
                  secondaryEnd={deposit.parsed && dn.gt(deposit.parsed, 0) && (
                    <HFlex>
                      <div>Max LTV 80%:</div>
                      <TextButton
                        label="24,405.69 BOLD"
                        onClick={() => borrowing.setValue("24405.69")}
                      />
                    </HFlex>
                  )}
                  {...borrowing.inputFieldProps}
                />
              }
              footerStart={liquidationRisk && (
                <>
                  <FieldInfoWarnLevel
                    label={`${
                      match(liquidationRisk.level)
                        .with("low", () => "Low")
                        .with("medium", () => "Medium")
                        .with("high", () => "High")
                        .exhaustive()
                    } liq. risk`}
                    level={liquidationRisk.level}
                  />
                  <FieldInfo
                    label="LTV"
                    value={
                      <HFlex gap={4}>
                        {liquidationRisk.ltv}
                        <InfoTooltip heading="LTV">
                          A redemption is an event where the borrower’s collateral is exchanged for a corresponding
                          amount of Bold stablecoins. At the time of the exchange a borrower does not lose any money.
                        </InfoTooltip>
                      </HFlex>
                    }
                  />
                </>
              )}
              footerEnd={liquidationRisk && (
                <FieldInfo
                  label="Liq. ETH Price"
                  value={
                    <HFlex gap={4}>
                      ${dn.format(liquidationRisk.ethPrice, 2)}
                      <InfoTooltip heading="LTV">
                        A redemption is an event where the borrower’s collateral is exchanged for a corresponding amount
                        of Bold stablecoins. At the time of the exchange a borrower does not lose any money.
                      </InfoTooltip>
                    </HFlex>
                  }
                />
              )}
            />
          )}

          {type === "leverage" && (
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
                  label={content.borrowScreen.liquidationPriceField.label}
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
                        A redemption is an event where the borrower’s collateral is exchanged for a corresponding amount
                        of Bold stablecoins. At the time of the exchange a borrower does not lose any money.
                      </InfoTooltip>
                    </HFlex>
                  }
                  {...ethLiqPrice.inputFieldProps}
                />
              }
              footerStart={liquidationRisk && (
                <>
                  <FieldInfoWarnLevel
                    label={`${
                      match(liquidationRisk.level)
                        .with("low", () => "Low")
                        .with("medium", () => "Medium")
                        .with("high", () => "High")
                        .exhaustive()
                    } liq. risk`}
                    level={liquidationRisk.level}
                  />
                  <FieldInfo
                    label="LTV"
                    value={
                      <HFlex gap={4}>
                        {liquidationRisk.ltv}
                        <InfoTooltip heading="LTV">
                          A redemption is an event where the borrower’s collateral is exchanged for a corresponding
                          amount of Bold stablecoins. At the time of the exchange a borrower does not lose any money.
                        </InfoTooltip>
                      </HFlex>
                    }
                  />
                </>
              )}
              footerEnd={liquidationRisk && (
                <FieldInfo
                  label="Liq. ETH Price"
                  value={
                    <HFlex gap={4}>
                      ${dn.format(liquidationRisk.ethPrice, 2)}
                      <InfoTooltip heading="LTV">
                        A redemption is an event where the borrower’s collateral is exchanged for a corresponding amount
                        of Bold stablecoins. At the time of the exchange a borrower does not lose any money.
                      </InfoTooltip>
                    </HFlex>
                  }
                />
              )}
            />
          )}
        </VFlex>

        <Field
          // “Interest rate”
          field={
            <InputField
              action={<StaticAction label="% per year" />}
              label={content.borrowScreen.interestRateField.label}
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
              <FieldInfoWarnLevel
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
              && borrowing.parsed
              && dn.gt(borrowing.parsed, 0)
              && interestRate.parsed
              && dn.gt(interestRate.parsed, 0)
            )}
            label={content.borrowScreen.action}
            mode="primary"
            size="large"
            wide
          />
        </div>
      </div>
    </Screen>
  );
}

function useInputFieldValue(format: (value: Dnum) => string) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const parsed = parseInputFloat(value);
  return {
    inputFieldProps: {
      onBlur: () => setFocused(false),
      onChange: (value: string) => setValue(value),
      onFocus: () => setFocused(true),
      value: focused || !parsed || !value.trim() ? value : format(parsed),
    },
    parsed,
    setValue,
    value,
  };
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
