"use client";

import type { RiskLevel } from "@/src/types";
import type { ReactNode } from "react";

import { Field } from "@/src/comps/Field/Field";
import { Screen } from "@/src/comps/Screen/Screen";
import { LTV_RISK, MAX_LTV_ALLOWED, REDEMPTION_RISK } from "@/src/constants";
import content from "@/src/content";
import { ACCOUNT_BALANCES } from "@/src/demo-data";
import { useDemoState } from "@/src/demo-state";
import { useInputFieldValue } from "@/src/form-utils";
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
  TextButton,
  TokenIcon,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { match, P } from "ts-pattern";
// import { useAccount } from "wagmi";

const collateralSymbols = COLLATERALS.map(({ symbol }) => symbol);

function isCollateralSymbol(symbol: string): symbol is typeof collateralSymbols[number] {
  const c: string[] = collateralSymbols;
  return c.includes(symbol);
}

export function BorrowScreen() {
  const { account } = useDemoState();
  // const account = useAccount();
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
  const borrowing = useInputFieldValue((value) => `${dn.format(value)} BOLD`);
  const interestRate = useInputFieldValue((value) => `${dn.format(value)}%`);

  const depositUsdValue = deposit.parsed && dn.mul(deposit.parsed, ethPriceUsd);

  const ltv = depositUsdValue && dn.gt(depositUsdValue, 0) && borrowing.parsed
    ? dn.div(borrowing.parsed, depositUsdValue)
    : null;

  const maxLtv = dn.div(dn.from(1, 18), collateralRatio);
  const maxLtvAllowed = dn.mul(maxLtv, MAX_LTV_ALLOWED);

  const maxBorrowing = depositUsdValue && dn.gt(depositUsdValue, 0)
    ? dn.mul(depositUsdValue, maxLtvAllowed)
    : null;

  let liquidationPriceUsd = deposit.parsed
      && dn.gt(deposit.parsed, 0)
      && borrowing.parsed
      && dn.gt(borrowing.parsed, 0)
      && dn.gt(maxLtv, 0)
    ? dn.div(dn.mul(borrowing.parsed, maxLtv), deposit.parsed)
    : null;

  if (liquidationPriceUsd && ltv && dn.gt(ltv, maxLtv)) {
    liquidationPriceUsd = ethPriceUsd;
  }

  const liquidationRisk: null | RiskLevel = match(ltv)
    .with(P.nullish, () => null)
    .when((ltv) => dn.gt(ltv, LTV_RISK.high), () => "high" as const)
    .when((ltv) => dn.gt(ltv, LTV_RISK.medium), () => "medium" as const)
    .otherwise(() => "low" as const);

  const redemptionRisk: null | RiskLevel = match(interestRate.parsed)
    .with(P.nullish, () => null)
    .when((r) => dn.eq(r, 0), () => null)
    .when((r) => dn.gt(r, REDEMPTION_RISK.low), () => "low" as const)
    .when((r) => dn.gt(r, REDEMPTION_RISK.medium), () => "medium" as const)
    .otherwise(() => "high" as const);

  const allowSubmit = deposit.parsed
    && dn.gt(deposit.parsed, 0)
    && borrowing.parsed
    && dn.gt(borrowing.parsed, 0)
    && interestRate.parsed
    && dn.gt(interestRate.parsed, 0);

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
              secondaryStart={`$${
                deposit.parsed
                  ? dn.format(
                    dn.mul(ethPriceUsd, deposit.parsed),
                    2,
                  )
                  : "0.00"
              }`}
              secondaryEnd={account.isConnected && (
                <TextButton
                  label={`Max ${dn.format(ACCOUNT_BALANCES[collateral])} ${collateral}`}
                  onClick={() => {
                    deposit.setValue(
                      dn.format(ACCOUNT_BALANCES[collateral]).replace(",", ""),
                    );
                  }}
                />
              )}
              {...deposit.inputFieldProps}
            />
          }
          footerEnd={
            <Field.FooterInfo
              label="Max LTV"
              value={
                <HFlex gap={4}>
                  <div>
                    {dn.format(dn.mul(maxLtv, 100), { digits: 2, trailingZeros: true })}%
                  </div>
                  <InfoTooltip heading="Max LTV">
                    A redemption is an event where the borrower’s collateral is exchanged for a corresponding amount of
                    Bold stablecoins. At the time of the exchange a borrower does not lose any money.
                  </InfoTooltip>
                </HFlex>
              }
            />
          }
          footerStart={
            <Field.FooterInfo
              label="ETH Price"
              value={
                <HFlex gap={4}>
                  <span
                    className={css({
                      fontVariantNumeric: "tabular-nums",
                    })}
                  >
                    ${dn.format(ethPriceUsd, {
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
                  ? dn.gt(
                      dn.mul(boldPriceUsd, borrowing.parsed),
                      1_000_000_000_000,
                    )
                    ? "−"
                    : dn.format(
                      dn.mul(boldPriceUsd, borrowing.parsed),
                      {
                        digits: 2,
                        trailingZeros: true,
                        compact: dn.gt(borrowing.parsed, 1_000_000_000),
                      },
                    )
                  : "0.00"
              }`}
              secondaryEnd={maxBorrowing && (
                <div
                  className={css({
                    flexGrow: 0,
                    flexShrink: 1,
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  })}
                >
                  <div>
                    {`Max LTV ${
                      dn.format(
                        dn.mul(maxLtvAllowed, 100),
                        { digits: 2, trailingZeros: false },
                      )
                    }%:`}
                  </div>
                  <div>
                    <TextButton
                      label={`${dn.format(maxBorrowing, 2)} BOLD`}
                      onClick={() => borrowing.setValue(dn.format(maxBorrowing, 2).replace(",", ""))}
                    />
                  </div>
                </div>
              )}
              {...borrowing.inputFieldProps}
            />
          }
          footerStart={
            <>
              <Field.FooterInfoWarnLevel
                help={<InfoTooltip heading="Liquidation risk" />}
                label={match(liquidationRisk)
                  .with(P.nullish, () => "Liquidation risk")
                  .with("low", () => "Low liq. risk")
                  .with("medium", () => "Medium liq. risk")
                  .with("high", () => "High liq. risk")
                  .exhaustive()}
                level={liquidationRisk ?? "none"}
                title={match(liquidationRisk)
                  .with(P.nullish, () => undefined)
                  .with("low", () => "Low liquidation risk")
                  .with("medium", () => "Medium liquidation risk")
                  .with("high", () => "High liquidation risk")
                  .exhaustive()}
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
                          {dn.lt(ltv, maxLtv)
                            ? dn.format(dn.mul(ltv, 100), { digits: 2, trailingZeros: true })
                            : `>${dn.format(dn.mul(maxLtv, 100), { digits: 2, trailingZeros: true })}`}%
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
          }
          footerEnd={liquidationRisk && (
            <Field.FooterInfo
              label="Liq. ETH price"
              title={`Liquidation ETH price: ${
                liquidationPriceUsd
                  ? `$${dn.format(liquidationPriceUsd, 2)}`
                  : "−"
              }`}
              value={
                <HFlex gap={4}>
                  ${liquidationPriceUsd
                    ? dn.format(
                      liquidationPriceUsd,
                      { digits: 2, trailingZeros: true },
                    )
                    : "−"}
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
                  <div>
                    {interestRate.parsed && borrowing.parsed
                      ? dn.format(
                        dn.mul(borrowing.parsed, dn.div(interestRate.parsed, 100)),
                        { digits: 2, trailingZeros: false },
                      )
                      : "−"} BOLD / year
                  </div>
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
            <Field.FooterInfoWarnLevel
              label={match(redemptionRisk)
                .with(P.nullish, () => "Redemption risk")
                .with("low", () => "Low redemption risk")
                .with("medium", () => "Medium redemption risk")
                .with("high", () => "High redemption risk")
                .exhaustive()}
              level={redemptionRisk ?? "none"}
              help={<InfoTooltip heading="Redemption risk" />}
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
