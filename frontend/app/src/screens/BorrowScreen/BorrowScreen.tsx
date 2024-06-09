"use client";

import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { Field } from "@/src/comps/Field/Field";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { ACCOUNT_BALANCES, ETH_PRICE, BOLD_PRICE } from "@/src/demo-data";
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
  TextButton,
  TokenIcon,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { match } from "ts-pattern";

const collateralSymbols = COLLATERALS.map(({ symbol }) => symbol);

function isCollateralSymbol(symbol: string): symbol is typeof collateralSymbols[number] {
  const c: string[] = collateralSymbols;
  return c.includes(symbol);
}

export function BorrowScreen() {
  const router = useRouter();

  // useParams() can return an array, but not with the current
  // routing setup so we can safely assume it’s a string
  const collateral = String(useParams().collateral ?? "eth").toUpperCase();

  if (!isCollateralSymbol(collateral)) {
    throw new Error(`Invalid collateral symbol: ${collateral}`);
  }

  const collateralIndex = collateralSymbols.indexOf(collateral);

  const deposit = useInputFieldValue((value) => `${dn.format(value)} ${collateral}`);
  const borrowing = useInputFieldValue((value) => `${dn.format(value)} BOLD`);
  const interestRate = useInputFieldValue((value) => `${dn.format(value)}%`);

  const liquidationRisk: null | {
    ethPrice: Dnum;
    level: "low" | "medium" | "high";
    ltv: string;
  } = deposit.parsed && dn.gt(deposit.parsed, 0)
      && borrowing.parsed && dn.gt(borrowing.parsed, 0)
    ? {
      ethPrice: dn.from(1200),
      level: "low",
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
              action={
                <Dropdown
                  items={COLLATERALS.map(({ symbol, name }) => ({
                    icon: <TokenIcon symbol={symbol} />,
                    label: name,
                    value: dn.format(ACCOUNT_BALANCES[symbol]),
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
              secondaryStart={`$${
                deposit.parsed
                  ? dn.format(
                    dn.mul(ETH_PRICE, deposit.parsed),
                    { digits: 2, trailingZeros: true },
                  )
                  : "0.00"
              }`}
              secondaryEnd={
                <TextButton
                  label={`Max. ${dn.format(ACCOUNT_BALANCES[collateral])} ${collateral}`}
                  onClick={() =>
                    deposit.setValue(
                      dn.format(ACCOUNT_BALANCES[collateral]).replace(",", ""),
                    )}
                />
              }
              {...deposit.inputFieldProps}
            />
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
              secondaryStart={`$${
                borrowing.parsed
                  ? dn.format(
                    dn.mul(BOLD_PRICE, borrowing.parsed),
                    { digits: 2, trailingZeros: true },
                  )
                  : "0.00"
              }`}
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
