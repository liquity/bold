"use client";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InterestRateField } from "@/src/comps/InterestRateField/InterestRateField";
import { RedemptionInfo } from "@/src/comps/RedemptionInfo/RedemptionInfo";
import { Screen } from "@/src/comps/Screen/Screen";
import { DEBT_SUGGESTIONS, INTEREST_RATE_DEFAULT } from "@/src/constants";
import content from "@/src/content";
import { useCollateralContracts } from "@/src/contracts";
import { dnum18 } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { getLiquidationRisk, getLoanDetails, getLtv } from "@/src/liquity-math";
import { useAccount, useBalance } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { useTroveCount } from "@/src/subgraph-hooks";
import { isCollIndex } from "@/src/types";
import { infoTooltipProps } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  Button,
  COLLATERALS as KNOWN_COLLATERALS,
  Dropdown,
  HFlex,
  IconSuggestion,
  InfoTooltip,
  InputField,
  isCollateralSymbol,
  PillButton,
  TextButton,
  TokenIcon,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { maxUint256 } from "viem";

const KNOWN_COLLATERAL_SYMBOLS = KNOWN_COLLATERALS.map(({ symbol }) => symbol);

export function BorrowScreen() {
  const router = useRouter();

  const account = useAccount();
  const txFlow = useTransactionFlow();
  const allCollContracts = useCollateralContracts();

  // useParams() can return an array but not with the current
  // routing setup, so we can safely cast it to a string
  const collSymbol = String(useParams().collateral ?? allCollContracts[0].symbol).toUpperCase();
  if (!isCollateralSymbol(collSymbol)) {
    throw new Error(`Invalid collateral symbol: ${collSymbol}`);
  }

  const collIndex = allCollContracts.findIndex(({ symbol }) => symbol === collSymbol);
  if (!isCollIndex(collIndex)) {
    throw new Error(`Unknown collateral symbol: ${collSymbol}`);
  }

  const collaterals = allCollContracts.map(({ symbol }) => {
    const collateral = KNOWN_COLLATERALS.find((c) => c.symbol === symbol);
    if (!collateral) {
      throw new Error(`Unknown collateral symbol: ${symbol}`);
    }
    return collateral;
  });

  const collateral = collaterals[collIndex];

  const deposit = useInputFieldValue((value) => `${fmtnum(value)} ${collateral.name}`);
  const debt = useInputFieldValue((value) => `${fmtnum(value)} BOLD`);
  const [interestRate, setInterestRate] = useState(dn.div(dn.from(INTEREST_RATE_DEFAULT, 18), 100));

  const collPrice = usePrice(collateral.symbol);

  const balances = Object.fromEntries(KNOWN_COLLATERAL_SYMBOLS.map((symbol) => ([
    symbol,
    // known collaterals are static so we can safely call this hook in a .map()
    useBalance(account.address, symbol),
  ] as const)));

  const collBalance = balances[collateral.symbol];

  const troveCount = useTroveCount(account.address, collIndex);

  if (!collPrice) {
    return null;
  }

  const loanDetails = getLoanDetails(
    deposit.isEmpty ? null : deposit.parsed,
    debt.isEmpty ? null : debt.parsed,
    interestRate,
    collateral.collateralRatio,
    collPrice,
  );

  const debtSuggestions = loanDetails.maxDebt
      && loanDetails.depositUsd
      && loanDetails.deposit
      && dn.gt(loanDetails.deposit, 0)
    ? DEBT_SUGGESTIONS.map((ratio) => {
      const debt = loanDetails.maxDebt && dn.mul(loanDetails.maxDebt, ratio);
      const ltv = debt && loanDetails.deposit && getLtv(loanDetails.deposit, debt, collPrice);
      const risk = ltv && getLiquidationRisk(ltv, loanDetails.maxLtv);
      return { debt, ltv, risk };
    })
    : null;

  const allowSubmit = account.isConnected
    && deposit.parsed
    && dn.gt(deposit.parsed, 0)
    && debt.parsed
    && dn.gt(debt.parsed, 0)
    && interestRate
    && dn.gt(interestRate, 0);

  return (
    <Screen
      title={
        <HFlex>
          {content.borrowScreen.headline(
            <TokenIcon.Group>
              {allCollContracts.map(({ symbol }) => (
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
                  items={collaterals.map(({ symbol, name }) => ({
                    icon: <TokenIcon symbol={symbol} />,
                    label: name,
                    value: account.isConnected
                      ? fmtnum(balances[symbol].data ?? 0)
                      : "−",
                  }))}
                  menuPlacement="end"
                  menuWidth={300}
                  onSelect={(index) => {
                    deposit.setValue("");
                    const { symbol } = collaterals[index];
                    router.push(
                      `/borrow/${symbol.toLowerCase()}`,
                      { scroll: false },
                    );
                  }}
                  selected={collIndex}
                />
              }
              label={content.borrowScreen.depositField.label}
              placeholder="0.00"
              secondary={{
                start: `$${
                  deposit.parsed
                    ? fmtnum(dn.mul(collPrice, deposit.parsed), "2z")
                    : "0.00"
                }`,
                end: account.isConnected && (
                  <TextButton
                    label={`Max ${fmtnum(collBalance.data ?? 0)} ${collateral.name}`}
                    onClick={() => {
                      deposit.setValue(
                        fmtnum(collBalance.data ?? 0).replace(",", ""),
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
              <Field.FooterInfoCollPrice
                collPriceUsd={collPrice}
                collName={collateral.name}
              />,
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
                    ? fmtnum(debt.parsed, "2z")
                    : "0.00"
                }`,
                end: debtSuggestions && (
                  <HFlex gap={6}>
                    {debtSuggestions.map((s) => (
                      s.debt && s.risk && (
                        <PillButton
                          key={dn.toString(s.debt)}
                          label={`$${fmtnum(s.debt, { compact: true, digits: 0 })}`}
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
              <Field.FooterInfoLiquidationRisk
                riskLevel={loanDetails.liquidationRisk}
              />,
              <Field.FooterInfoLiquidationPrice
                liquidationPrice={loanDetails.liquidationPrice}
              />,
            ],
            [
              null,
              <Field.FooterInfoLoanToValue
                ltvRatio={loanDetails.ltv}
                maxLtvRatio={loanDetails.maxLtv}
              />,
            ],
          ]}
        />

        <Field
          // “Interest rate”
          field={
            <InterestRateField
              debt={debt.parsed}
              interestRate={interestRate}
              onChange={setInterestRate}
            />
          }
          footer={[
            [
              <Field.FooterInfoRedemptionRisk riskLevel={loanDetails.redemptionRisk} />,
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
            label={content.borrowScreen.action}
            mode="primary"
            size="large"
            wide
            onClick={() => {
              if (deposit.parsed && debt.parsed && account.address) {
                txFlow.start({
                  flowId: "openLoanPosition",
                  backLink: ["/borrow", "Back to editing"],
                  successLink: ["/", "Go to the Dashboard"],
                  successMessage: "The position has been created successfully.",

                  collIndex,
                  owner: account.address,
                  ownerIndex: troveCount.data ?? 0,
                  collAmount: deposit.parsed,
                  boldAmount: debt.parsed,
                  upperHint: dnum18(0),
                  lowerHint: dnum18(0),
                  annualInterestRate: interestRate,
                  maxUpfrontFee: dnum18(maxUint256),
                });
                router.push("/transactions");
              }
            }}
          />
        </div>
      </div>
    </Screen>
  );
}
