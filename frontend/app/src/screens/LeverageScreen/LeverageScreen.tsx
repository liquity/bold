"use client";

import type { DelegateMode } from "@/src/comps/InterestRateField/InterestRateField";
import type { Address } from "@/src/types";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InterestRateField } from "@/src/comps/InterestRateField/InterestRateField";
import { LeverageField, useLeverageField } from "@/src/comps/LeverageField/LeverageField";
import { RedemptionInfo } from "@/src/comps/RedemptionInfo/RedemptionInfo";
import { Screen } from "@/src/comps/Screen/Screen";
import { ETH_MAX_RESERVE, INTEREST_RATE_DEFAULT } from "@/src/constants";
import content from "@/src/content";
import { getContracts } from "@/src/contracts";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { getRedemptionRisk } from "@/src/liquity-math";
import { useAccount, useBalance } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { useTrovesCount } from "@/src/subgraph-hooks";
import { isCollIndex } from "@/src/types";
import { infoTooltipProps } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  Button,
  COLLATERALS as COLL_TOKENS,
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

export function LeverageScreen() {
  const router = useRouter();
  const account = useAccount();
  const txFlow = useTransactionFlow();

  const contracts = getContracts();

  // useParams() can return an array but not with the current
  // routing setup, so we can safely cast it to a string
  const collSymbol = String(useParams().collateral ?? contracts.collaterals[0].symbol).toUpperCase();
  if (!isCollateralSymbol(collSymbol)) {
    throw new Error(`Invalid collateral symbol: ${collSymbol}`);
  }

  const collIndex = contracts.collaterals.findIndex(({ symbol }) => symbol === collSymbol);
  if (!isCollIndex(collIndex)) {
    throw new Error(`Unknown collateral symbol: ${collSymbol}`);
  }

  const collateralTokens = contracts.collaterals.map(({ symbol }) => {
    const collateral = COLL_TOKENS.find((c) => c.symbol === symbol);
    if (!collateral) {
      throw new Error(`Unknown collateral symbol: ${symbol}`);
    }
    return collateral;
  });

  const collToken = collateralTokens[collIndex];

  const balances = Object.fromEntries(collateralTokens.map(({ symbol }) => ([
    symbol,
    useBalance(account.address, symbol),
  ] as const)));

  const collBalance = balances[collToken.symbol];
  const troveCount = useTrovesCount(account.address ?? null, collIndex);

  const collPrice = usePrice(collToken.symbol);
  const depositPreLeverage = useInputFieldValue((value) => `${fmtnum(value)} ${collToken.name}`);
  const [interestRate, setInterestRate] = useState(dn.div(dn.from(INTEREST_RATE_DEFAULT, 18), 100));
  const [interestRateMode, setInterestRateMode] = useState<DelegateMode>("manual");
  const [interestRateDelegate, setInterestRateDelegate] = useState<Address | null>(null);

  const leverageField = useLeverageField({
    depositPreLeverage: depositPreLeverage.parsed,
    collPrice: collPrice ?? dn.from(0, 18),
    collToken,
  });

  useEffect(() => {
    // reset leverage when collateral changes
    leverageField.updateLeverageFactor(leverageField.leverageFactorSuggestions[0]);
  }, [collToken.symbol, leverageField.leverageFactorSuggestions]);

  if (!collPrice) {
    return null;
  }

  const redemptionRisk = getRedemptionRisk(interestRate);
  const depositUsd = depositPreLeverage.parsed && dn.mul(
    depositPreLeverage.parsed,
    collPrice,
  );

  const maxAmount = collBalance.data && dn.sub(collBalance.data, ETH_MAX_RESERVE);

  const allowSubmit = account.isConnected
    && depositPreLeverage.parsed
    && dn.gt(depositPreLeverage.parsed, 0)
    && interestRate
    && dn.gt(interestRate, 0)
    && leverageField.debt
    && dn.gt(leverageField.debt, 0);

  return (
    <Screen
      heading={{
        title: (
          <HFlex>
            {content.leverageScreen.headline(
              <TokenIcon.Group>
                {contracts.collaterals.map(({ symbol }) => (
                  <TokenIcon
                    key={symbol}
                    symbol={symbol}
                  />
                ))}
              </TokenIcon.Group>,
            )}
          </HFlex>
        ),
      }}
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
          field={
            <InputField
              contextual={
                <Dropdown
                  items={collateralTokens.map(({ symbol, name }) => ({
                    icon: <TokenIcon symbol={symbol} />,
                    label: name,
                    value: account.isConnected
                      ? fmtnum(balances[symbol].data ?? 0)
                      : "−",
                  }))}
                  menuPlacement="end"
                  menuWidth={300}
                  onSelect={(index) => {
                    setTimeout(() => {
                      depositPreLeverage.setValue("");
                      depositPreLeverage.focus();
                    }, 0);
                    const { symbol } = collateralTokens[index];
                    router.push(
                      `/leverage/${symbol.toLowerCase()}`,
                      { scroll: false },
                    );
                  }}
                  selected={collIndex}
                />
              }
              label={content.leverageScreen.depositField.label}
              placeholder="0.00"
              secondary={{
                start: depositUsd && `$${fmtnum(depositUsd, "2z")}`,
                end: maxAmount && (
                  <TextButton
                    label={`Max ${fmtnum(maxAmount)} ${collToken.name}`}
                    onClick={() => {
                      depositPreLeverage.setValue(dn.toString(maxAmount));
                    }}
                  />
                ),
              }}
              {...depositPreLeverage.inputFieldProps}
            />
          }
          footer={{
            start: (
              <Field.FooterInfoCollPrice
                collName={collToken.name}
                collPriceUsd={collPrice}
              />
            ),
            end: (
              <Field.FooterInfoMaxLtv
                maxLtv={dn.div(dn.from(1, 18), collToken.collateralRatio)}
              />
            ),
          }}
        />

        <Field
          field={<LeverageField {...leverageField} />}
          footer={{
            start: (
              <>
                <Field.FooterInfoLiquidationRisk
                  riskLevel={leverageField.liquidationRisk}
                />
                <Field.FooterInfoLoanToValue
                  ltvRatio={leverageField.ltv}
                  maxLtvRatio={leverageField.maxLtv}
                />
              </>
            ),
            end: (
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
                    ? `${fmtnum(leverageField.deposit, "2z")} ${collToken.name}`
                    : "−"}
                </span>
                <InfoTooltip {...infoTooltipProps(content.leverageScreen.infoTooltips.exposure)} />
              </HFlex>
            ),
          }}
        />

        <VFlex gap={0}>
          <Field
            field={
              <InterestRateField
                collIndex={collIndex}
                debt={leverageField.debt}
                delegate={interestRateDelegate}
                interestRate={interestRate}
                mode={interestRateMode}
                onChange={setInterestRate}
                onDelegateChange={setInterestRateDelegate}
                onModeChange={setInterestRateMode}
              />
            }
            footer={{
              start: (
                <Field.FooterInfoRedemptionRisk
                  riskLevel={redemptionRisk}
                />
              ),
              end: (
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
                </span>
              ),
            }}
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
            wide
            onClick={() => {
              if (depositPreLeverage.parsed && leverageField.debt && account.address) {
                txFlow.start({
                  flowId: "openLeveragePosition",
                  backLink: ["/leverage", "Back to editing"],
                  successLink: ["/", "Go to the Dashboard"],
                  successMessage: "The leveraged position has been created successfully.",

                  ownerIndex: troveCount.data ?? 0,
                  leverageFactor: leverageField.leverageFactor,
                  loan: {
                    type: "leverage",
                    batchManager: interestRateDelegate,
                    borrowed: leverageField.debt,
                    borrower: account.address,
                    collIndex,
                    deposit: dn.mul(
                      depositPreLeverage.parsed,
                      leverageField.leverageFactor,
                    ),
                    interestRate: interestRate,
                    troveId: null,
                  },
                });
              }
            }}
          />
        </div>
      </div>
    </Screen>
  );
}
