"use client";

import type { DelegateMode } from "@/src/comps/InterestRateField/InterestRateField";
import type { Address } from "@/src/types";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InterestRateField } from "@/src/comps/InterestRateField/InterestRateField";
import { RedemptionInfo } from "@/src/comps/RedemptionInfo/RedemptionInfo";
import { Screen } from "@/src/comps/Screen/Screen";
import {
  DEBT_SUGGESTIONS,
  ETH_MAX_RESERVE,
  INTEREST_RATE_DEFAULT,
  MAX_ANNUAL_INTEREST_RATE,
  MAX_COLLATERAL_DEPOSITS,
  MIN_ANNUAL_INTEREST_RATE,
  MIN_DEBT,
} from "@/src/constants";
import content from "@/src/content";
import { getContracts } from "@/src/contracts";
import { dnum18, dnumMax } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { getLiquidationRisk, getLoanDetails, getLtv } from "@/src/liquity-math";
import { useAccount, useBalance } from "@/src/services/Arbitrum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { useTrovesCount } from "@/src/subgraph-hooks";
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
  const contracts = getContracts();

  // useParams() can return an array but not with the current
  // routing setup, so we can safely cast it to a string
  const collSymbol = String(
    useParams().collateral ?? contracts.collaterals[0].symbol
  ).toUpperCase();
  if (!isCollateralSymbol(collSymbol)) {
    throw new Error(`Invalid collateral symbol: ${collSymbol}`);
  }

  const collIndex = contracts.collaterals.findIndex(
    ({ symbol }) => symbol === collSymbol
  );
  if (!isCollIndex(collIndex)) {
    throw new Error(`Unknown collateral symbol: ${collSymbol}`);
  }

  const collaterals = contracts.collaterals.map(({ symbol }) => {
    const collateral = KNOWN_COLLATERALS.find((c) => c.symbol === symbol);
    if (!collateral) {
      throw new Error(`Unknown collateral symbol: ${symbol}`);
    }
    return collateral;
  });

  const collateral = collaterals[collIndex];

  const maxCollDeposit = MAX_COLLATERAL_DEPOSITS[collSymbol] ?? null;

  const deposit = useInputFieldValue(fmtnum, {
    validate: (parsed, value) => {
      const isAboveMax =
        maxCollDeposit && parsed && dn.gt(parsed, maxCollDeposit);
      return {
        parsed: isAboveMax ? maxCollDeposit : parsed,
        value: isAboveMax ? dn.toString(maxCollDeposit) : value,
      };
    },
  });

  const debt = useInputFieldValue(fmtnum);

  const [interestRate, setInterestRate] = useState(
    dn.div(dn.from(INTEREST_RATE_DEFAULT, 18), 100)
  );
  const [interestRateMode, setInterestRateMode] =
    useState<DelegateMode>("manual");
  const [interestRateDelegate, setInterestRateDelegate] =
    useState<Address | null>(null);

  const collPrice = usePrice(collateral.symbol);

  const balances = Object.fromEntries(
    KNOWN_COLLATERAL_SYMBOLS.map(
      (symbol) =>
        [
          symbol,
          // known collaterals are static so we can safely call this hook in a .map()
          useBalance(account.address, symbol),
        ] as const
    )
  );

  const collBalance = balances[collateral.symbol];

  const troveCount = useTrovesCount(account.address ?? null, collIndex);

  const loanDetails = getLoanDetails(
    deposit.isEmpty ? null : deposit.parsed,
    debt.isEmpty ? null : debt.parsed,
    interestRate,
    collateral.collateralRatio,
    collPrice
  );

  const debtSuggestions =
    loanDetails.maxDebt &&
    loanDetails.depositUsd &&
    loanDetails.deposit &&
    dn.gt(loanDetails.deposit, 0)
      ? DEBT_SUGGESTIONS.map((ratio, index) => {
          let debt = loanDetails.maxDebt && dn.mul(loanDetails.maxDebt, ratio);

          // debt < MIN_DEBT
          if (debt && dn.lt(debt, MIN_DEBT)) {
            if (index === 0) {
              // if it’s the first suggestion, set it to MIN_DEBT
              debt = MIN_DEBT;
            } else {
              // otherwise don’t show it
              return null;
            }
          }

          const ltv =
            debt &&
            loanDetails.deposit &&
            collPrice &&
            getLtv(loanDetails.deposit, debt, collPrice);

          // don’t show if ltv > max LTV
          if (ltv && dn.gt(ltv, loanDetails.maxLtv)) {
            return null;
          }

          const risk = ltv && getLiquidationRisk(ltv, loanDetails.maxLtv);

          return { debt, ltv, risk };
        })
      : null;

  const maxAmount =
    collBalance.data &&
    dnumMax(
      dn.sub(collBalance.data, collSymbol === "ETH" ? ETH_MAX_RESERVE : 0), // Only keep a reserve for ETH, not LSTs
      dnum18(0)
    );

  const isBelowMinDebt =
    debt.parsed && !debt.isEmpty && dn.lt(debt.parsed, MIN_DEBT);

  const allowSubmit =
    account.isConnected &&
    deposit.parsed &&
    dn.gt(deposit.parsed, 0) &&
    debt.parsed &&
    dn.gt(debt.parsed, 0) &&
    interestRate &&
    dn.gt(interestRate, 0);

  return (
    <Screen
      heading={{
        title: (
          <HFlex>
            {content.borrowScreen.headline(
              <TokenIcon.Group>
                {contracts.collaterals.map(({ symbol }) => (
                  <TokenIcon key={symbol} symbol={symbol} />
                ))}
              </TokenIcon.Group>,
              <TokenIcon symbol='USDN' />
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
          // “You deposit”
          field={
            <InputField
              id='input-deposit'
              contextual={
                <Dropdown
                  items={collaterals.map(({ symbol, name }) => ({
                    icon: <TokenIcon symbol={symbol} />,
                    label: name,
                    value: account.isConnected
                      ? fmtnum(balances[symbol].data ?? 0)
                      : "−",
                  }))}
                  menuPlacement='end'
                  menuWidth={300}
                  onSelect={(index) => {
                    deposit.setValue("");
                    router.push(
                      `/borrow/${collaterals[index].symbol.toLowerCase()}`,
                      { scroll: false }
                    );
                  }}
                  selected={collIndex}
                />
              }
              label='Collateral'
              placeholder='0.00'
              secondary={{
                start: `$${
                  deposit.parsed && collPrice
                    ? fmtnum(dn.mul(collPrice, deposit.parsed), "2z")
                    : "0.00"
                }`,
                end: maxAmount && dn.gt(maxAmount, 0) && (
                  <TextButton
                    label={`Max ${fmtnum(maxAmount)} ${collateral.name}`}
                    onClick={() => {
                      deposit.setValue(dn.toString(maxAmount));
                    }}
                  />
                ),
              }}
              {...deposit.inputFieldProps}
            />
          }
          footer={{
            start: collPrice && (
              <Field.FooterInfoCollPrice
                collPriceUsd={collPrice}
                collName={collateral.name}
              />
            ),
            end: <Field.FooterInfoMaxLtv maxLtv={loanDetails.maxLtv} />,
          }}
        />

        <Field
          // “You borrow”
          field={
            <InputField
              id='input-debt'
              contextual={
                <InputField.Badge
                  icon={<TokenIcon symbol='USDN' />}
                  label='USDN'
                />
              }
              drawer={
                debt.isFocused || !isBelowMinDebt
                  ? null
                  : {
                      mode: "error",
                      message: `You must borrow at least ${fmtnum(
                        MIN_DEBT,
                        2
                      )} USDN.`,
                    }
              }
              label='Loan'
              placeholder='0.00'
              secondary={{
                start: `$${debt.parsed ? fmtnum(debt.parsed, "2z") : "0.00"}`,
                end: debtSuggestions && (
                  <HFlex gap={6}>
                    {debtSuggestions.map((s) => {
                      return (
                        s &&
                        s.debt &&
                        s.risk && (
                          <PillButton
                            key={dn.toString(s.debt)}
                            label={`$${fmtnum(s.debt, {
                              compact: true,
                              digits: 0,
                            })}`}
                            onClick={() => {
                              if (s.debt) {
                                debt.setValue(dn.toString(s.debt, 0));
                              }
                            }}
                            warnLevel={s.risk}
                          />
                        )
                      );
                    })}
                  </HFlex>
                ),
              }}
              {...debt.inputFieldProps}
            />
          }
          footer={[
            {
              start: (
                <Field.FooterInfoLiquidationRisk
                  riskLevel={loanDetails.liquidationRisk}
                />
              ),
              end: (
                <Field.FooterInfoLiquidationPrice
                  liquidationPrice={loanDetails.liquidationPrice}
                />
              ),
            },
            {
              end: (
                <Field.FooterInfoLoanToValue
                  ltvRatio={loanDetails.ltv}
                  maxLtvRatio={loanDetails.maxLtv}
                />
              ),
            },
          ]}
        />

        <Field
          // “Interest rate”
          field={
            <InterestRateField
              collIndex={collIndex}
              debt={debt.parsed}
              delegate={interestRateDelegate}
              inputId='input-interest-rate'
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
                riskLevel={loanDetails.redemptionRisk}
              />
            ),
            end: (
              <span
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  color: "contentAlt",
                  fontSize: 14,
                })}
              >
                <IconSuggestion size={16} />
                <>The interest rate can be adjusted</>
                <InfoTooltip
                  {...infoTooltipProps(
                    content.generalInfotooltips.interestRateAdjustment
                  )}
                />
              </span>
            ),
          }}
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
            mode='primary'
            size='large'
            wide
            onClick={() => {
              if (deposit.parsed && debt.parsed && account.address) {
                txFlow.start({
                  flowId: "openBorrowPosition",
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
                  interestRateDelegate:
                    interestRateMode === "manual" || !interestRateDelegate
                      ? null
                      : [
                          interestRateDelegate,
                          MIN_ANNUAL_INTEREST_RATE,
                          MAX_ANNUAL_INTEREST_RATE,
                        ],
                });
              }
            }}
          />
        </div>
      </div>
    </Screen>
  );
}
