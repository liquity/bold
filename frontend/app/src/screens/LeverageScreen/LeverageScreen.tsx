"use client";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InterestRateField } from "@/src/comps/InterestRateField/InterestRateField";
import { LeverageField, useLeverageField } from "@/src/comps/LeverageField/LeverageField";
import { RedemptionInfo } from "@/src/comps/RedemptionInfo/RedemptionInfo";
import { Screen } from "@/src/comps/Screen/Screen";
import { INTEREST_RATE_DEFAULT } from "@/src/constants";
import content from "@/src/content";
import { ACCOUNT_BALANCES } from "@/src/demo-mode";
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
  isCollateralSymbol,
  TextButton,
  TokenIcon,
  VFlex,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const collateralSymbols = COLLATERALS.map(({ symbol }) => symbol);

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

  const collPrice = usePrice(collateral.symbol) ?? dn.from(0, 18);
  const depositPreLeverage = useInputFieldValue((value) => `${dn.format(value)} ${collateral.name}`);
  const [interestRate, setInterestRate] = useState(dn.div(dn.from(INTEREST_RATE_DEFAULT, 18), 100));

  const leverageField = useLeverageField({
    depositPreLeverage: depositPreLeverage.parsed,
    collPrice,
    collToken: COLLATERALS[collateralIndex],
  });
  useEffect(() => {
    // reset leverage when collateral changes
    leverageField.updateLeverageFactor(leverageField.leverageFactorSuggestions[0]);
  }, [collateral.symbol, leverageField.leverageFactorSuggestions]);

  const redemptionRisk = getRedemptionRisk(interestRate);
  const depositUsd = depositPreLeverage.parsed && dn.mul(depositPreLeverage.parsed, collPrice);

  const allowSubmit = account.isConnected
    && depositPreLeverage.parsed
    && dn.gt(depositPreLeverage.parsed, 0)
    && interestRate
    && dn.gt(interestRate, 0)
    && false;

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
            <Field.FooterInfoCollPrice
              collName={collateral.name}
              collPriceUsd={collPrice}
            />,
            <Field.FooterInfoMaxLtv
              maxLtv={dn.div(dn.from(1, 18), collateral.collateralRatio)}
            />,
          ]]}
        />

        <Field
          field={<LeverageField {...leverageField} />}
          footer={[[
            <>
              <Field.FooterInfoLiquidationRisk
                riskLevel={leverageField.liquidationRisk}
              />
              <Field.FooterInfoLoanToValue
                ltvRatio={leverageField.ltv}
                maxLtvRatio={leverageField.maxLtv}
              />
            </>,
            <HFlex>
              <span
                className={css({
                  color: "contentAlt",
                })}
              >
                Exposure
              </span>
              <span
                className={css({
                  fontVariantNumeric: "tabular-nums",
                })}
              >
                {(leverageField.deposit && dn.gt(leverageField.deposit, 0))
                  ? `${dn.format(leverageField.deposit, { digits: 2, trailingZeros: true })} ETH`
                  : "−"}
              </span>
              <InfoTooltip {...infoTooltipProps(content.leverageScreen.infoTooltips.exposure)} />
            </HFlex>,
          ]]}
        />

        <VFlex gap={0}>
          <Field
            // “Interest rate”
            field={
              <InterestRateField
                debt={leverageField.debt}
                interestRate={interestRate}
                onChange={setInterestRate}
              />
            }
            footer={[
              [
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
