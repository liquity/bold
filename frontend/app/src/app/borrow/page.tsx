"use client";

import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { Field, FieldInfo } from "@/src/comps/Field/Field";
import content from "@/src/content";
import { POOLS } from "@/src/demo-data";
import { parseInputFloat } from "@/src/form-utils";
import { css } from "@/styled-system/css";
import { Button, Dropdown, InputField, PillButton, TextButton, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import { useState } from "react";
import { match } from "ts-pattern";

export default function Borrow() {
  const [depositPoolIndex, setDepositPoolIndex] = useState(0);
  const pool = POOLS[depositPoolIndex];

  const deposit = useInputFieldValue((value) => `${dn.format(value)} ${pool.symbol}`);
  const borrowing = useInputFieldValue((value) => `${dn.format(value)} BOLD`);
  const interestRate = useInputFieldValue((value) => dn.format(value));

  const liquidationRisk: null | {
    ethPrice: Dnum;
    level: "low" | "medium" | "high";
    ltv: string;
  } = deposit.parsed && dn.gt(deposit.parsed, 0)
      && borrowing.parsed && dn.gt(borrowing.parsed, 0)
    ? {
      ethPrice: dn.from(1200),
      level: "low" as const,
      ltv: "33.00%",
    }
    : null;

  return (
    <div
      className={css({
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 64,
        width: "100%",
        padding: 24,
      })}
    >
      <header
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        })}
      >
        <h1
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingBottom: 12,
            fontSize: 28,
          })}
        >
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
        </h1>
        <p
          className={css({
            color: "contentAlt",
          })}
        >
          {content.borrowScreen.subheading}
        </p>
      </header>
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
                  onSelect={setDepositPoolIndex}
                  selected={depositPoolIndex}
                />
              }
              label={content.borrowScreen.depositField.label}
              placeholder="0.00"
              secondaryStart="0.00 USD"
              secondaryEnd={
                <TextButton
                  label={`Max. 10.00 ${pool.symbol}`}
                  onClick={() => deposit.setValue("10.00")}
                />
              }
              {...deposit.inputFieldProps}
            />
          }
          footerStart={`${pool.token} stats`}
          footerEnd={
            <>
              <FieldInfo
                label="Max LTV"
                value="80.00%"
              />
              <FieldInfo
                label="Capacity"
                value="0.5M"
              />
            </>
          }
        />
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
              secondaryStart="0.00 USD"
              secondaryEnd={deposit.parsed && dn.gt(deposit.parsed, 0) && (
                <div
                  className={css({
                    display: "flex",
                    gap: 8,
                  })}
                >
                  <div>Max LTV 80%:</div>
                  <TextButton
                    label="24,405.69 BOLD"
                    onClick={() => borrowing.setValue("24405.69")}
                  />
                </div>
              )}
              {...borrowing.inputFieldProps}
            />
          }
          footerStart={liquidationRisk && (
            <>
              <FieldInfo
                value={
                  <div
                    className={css({
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    })}
                  >
                    <div
                      className={css({
                        width: 12,
                        height: 12,
                        "--warn-color-low": "token(colors.positive)",
                        "--warn-color-medium": "token(colors.warning)",
                        "--warn-color-high": "token(colors.negative)",
                        borderRadius: "50%",
                      })}
                      style={{
                        background: `var(--warn-color-${liquidationRisk.level})`,
                      }}
                    />
                    {match(liquidationRisk.level)
                      .with("low", () => "Low")
                      .with("medium", () => "Medium")
                      .with("high", () => "High")
                      .exhaustive()} liquidation risk
                  </div>
                }
              />
              <FieldInfo label="LTV" value="33.00%" />
            </>
          )}
          footerEnd={liquidationRisk && (
            <FieldInfo
              label="Liq. ETH Price"
              value={`${dn.format(liquidationRisk.ethPrice, 2)} USD`}
            />
          )}
        />
        <Field
          // “Interest rate”
          field={
            <InputField
              action={<StaticAction label="% per year" />}
              label={content.borrowScreen.interestRateField.label}
              placeholder="0.00"
              secondaryStart="0 BOLD / year"
              secondaryEnd={
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                  }}
                >
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
                </div>
              }
              {...interestRate.inputFieldProps}
            />
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
    </div>
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
