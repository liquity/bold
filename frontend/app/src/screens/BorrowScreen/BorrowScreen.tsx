"use client";

import type { DelegateMode } from "@/src/comps/InterestRateField/InterestRateField";
import type { Address, Dnum } from "@/src/types";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InterestRateField } from "@/src/comps/InterestRateField/InterestRateField";
import { RedemptionInfo } from "@/src/comps/RedemptionInfo/RedemptionInfo";
import { Screen } from "@/src/comps/Screen/Screen";
import { DEBT_SUGGESTIONS, ETH_MAX_RESERVE, MAX_COLLATERAL_DEPOSITS, MIN_DEBT } from "@/src/constants";
import content from "@/src/content";
import { dnum18, dnumMax } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { getLiquidationRisk, getLoanDetails, getLtv } from "@/src/liquity-math";
import { getBranch, getBranches, getCollToken } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { useNextOwnerIndex } from "@/src/subgraph-hooks";
import { infoTooltipProps } from "@/src/uikit-utils";
import { useAccount, useBalance } from "@/src/wagmi-utils";
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
  const branches = getBranches();
  // useParams() can return an array but not with the current
  // routing setup, so we can safely cast it to a string
  const collSymbol = `${useParams().collateral ?? branches[0]?.symbol}`.toUpperCase();
  if (!isCollateralSymbol(collSymbol)) {
    throw new Error(`Invalid collateral symbol: ${collSymbol}`);
  }

  const router = useRouter();
  const account = useAccount();
  const txFlow = useTransactionFlow();

  const branch = getBranch(collSymbol);
  const collateral = getCollToken(branch.id);
  const collaterals = branches.map((b) => getCollToken(b.branchId));

  const maxCollDeposit = MAX_COLLATERAL_DEPOSITS[collSymbol] ?? null;

  const deposit = useInputFieldValue(fmtnum, {
    validate: (parsed, value) => {
      const isAboveMax = maxCollDeposit && parsed && dn.gt(parsed, maxCollDeposit);
      return {
        parsed: isAboveMax ? maxCollDeposit : parsed,
        value: isAboveMax ? dn.toString(maxCollDeposit) : value,
      };
    },
  });

  const debt = useInputFieldValue(fmtnum);

  const [interestRate, setInterestRate] = useState<null | Dnum>(null);
  const [interestRateMode, setInterestRateMode] = useState<DelegateMode>("manual");
  const [interestRateDelegate, setInterestRateDelegate] = useState<Address | null>(null);

  const collPrice = usePrice(collateral.symbol);

  const balances = Object.fromEntries(KNOWN_COLLATERAL_SYMBOLS.map((symbol) => ([
    symbol,
    // known collaterals are static so we can safely call this hook in a .map()
    useBalance(account.address, symbol),
  ] as const)));

  const collBalance = balances[collateral.symbol];
  if (!collBalance) {
    throw new Error(`Unknown collateral symbol: ${collateral.symbol}`);
  }

  const nextOwnerIndex = useNextOwnerIndex(account.address ?? null, branch.id);

  const loanDetails = getLoanDetails(
    deposit.isEmpty ? null : deposit.parsed,
    debt.isEmpty ? null : debt.parsed,
    interestRate,
    collateral.collateralRatio,
    collPrice.data ?? null,
  );

  const debtSuggestions = loanDetails.maxDebt
      && loanDetails.depositUsd
      && loanDetails.deposit
      && dn.gt(loanDetails.deposit, 0)
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

      const ltv = debt && loanDetails.deposit && collPrice.data && getLtv(
        loanDetails.deposit,
        debt,
        collPrice.data,
      );

      // don’t show if ltv > max LTV
      if (ltv && dn.gt(ltv, loanDetails.maxLtv)) {
        return null;
      }

      const risk = ltv && getLiquidationRisk(ltv, loanDetails.maxLtv);

      return { debt, ltv, risk };
    })
    : null;

  const maxAmount = collBalance.data && dnumMax(
    dn.sub(collBalance.data, collSymbol === "ETH" ? ETH_MAX_RESERVE : 0), // Only keep a reserve for ETH, not LSTs
    dnum18(0),
  );

  const isBelowMinDebt = debt.parsed && !debt.isEmpty && dn.lt(debt.parsed, MIN_DEBT);

  const allowSubmit = account.isConnected
    && deposit.parsed
    && dn.gt(deposit.parsed, 0)
    && debt.parsed
    && dn.gt(debt.parsed, 0)
    && interestRate
    && dn.gt(interestRate, 0)
    && !isBelowMinDebt;

  return (
    <Screen
      heading={{
        title: (
          <HFlex>
            {content.borrowScreen.headline(
              <TokenIcon.Group>
                {collaterals.map(({ symbol }) => (
                  <TokenIcon
                    key={symbol}
                    symbol={symbol}
                  />
                ))}
              </TokenIcon.Group>,
              <TokenIcon symbol="BOLD" />,
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
              id="input-deposit"
              contextual={
                <Dropdown
                  items={collaterals.map(({ symbol, name }) => ({
                    icon: <TokenIcon symbol={symbol} />,
                    label: name,
                    value: account.isConnected
                      ? fmtnum(balances[symbol]?.data ?? 0)
                      : "−",
                  }))}
                  menuPlacement="end"
                  menuWidth={300}
                  onSelect={(index) => {
                    const coll = collaterals[index];
                    if (!coll) {
                      throw new Error(`Unknown branch: ${index}`);
                    }

                    deposit.setValue("");
                    router.push(
                      `/borrow/${coll.symbol.toLowerCase()}`,
                      { scroll: false },
                    );
                  }}
                  selected={branch.id}
                />
              }
              label="Collateral"
              placeholder="0.00"
              secondary={{
                start: `$${
                  deposit.parsed && collPrice.data
                    ? fmtnum(dn.mul(collPrice.data, deposit.parsed), "2z")
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
            start: collPrice.data && (
              <Field.FooterInfoCollPrice
                collPriceUsd={collPrice.data}
                collName={collateral.name}
              />
            ),
            end: (
              <Field.FooterInfoMaxLtv
                maxLtv={loanDetails.maxLtv}
              />
            ),
          }}
        />

        <Field
          // “You borrow”
          field={
            <InputField
              id="input-debt"
              contextual={
                <InputField.Badge
                  icon={<TokenIcon symbol="BOLD" />}
                  label="BOLD"
                />
              }
              drawer={debt.isFocused || !isBelowMinDebt ? null : {
                mode: "error",
                message: `You must borrow at least ${fmtnum(MIN_DEBT, 2)} BOLD.`,
              }}
              label="Loan"
              placeholder="0.00"
              secondary={{
                start: `$${
                  debt.parsed
                    ? fmtnum(debt.parsed)
                    : "0.00"
                }`,
                end: debtSuggestions && (
                  <HFlex gap={6}>
                    {debtSuggestions.map((s) => {
                      return s && (
                        s.debt && s.risk && (
                          <PillButton
                            key={dn.toString(s.debt)}
                            label={fmtnum(s.debt, {
                              compact: true,
                              digits: 0,
                              prefix: "$",
                            })}
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
              branchId={branch.id}
              debt={debt.parsed}
              delegate={interestRateDelegate}
              inputId="input-interest-rate"
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
                <>You can adjust this rate at any time</>
                <InfoTooltip {...infoTooltipProps(content.generalInfotooltips.interestRateAdjustment)} />
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
            mode="primary"
            size="large"
            wide
            onClick={() => {
              if (
                deposit.parsed
                && debt.parsed
                && account.address
                && typeof nextOwnerIndex.data === "number"
              ) {
                txFlow.start({
                  flowId: "openBorrowPosition",
                  backLink: [
                    `/borrow/${collSymbol.toLowerCase()}`,
                    "Back to editing",
                  ],
                  successLink: ["/", "Go to the Dashboard"],
                  successMessage: "The position has been created successfully.",

                  branchId: branch.id,
                  owner: account.address,
                  ownerIndex: nextOwnerIndex.data,
                  collAmount: deposit.parsed,
                  boldAmount: debt.parsed,
                  annualInterestRate: interestRate,
                  maxUpfrontFee: dnum18(maxUint256),
                  interestRateDelegate: interestRateMode === "manual" || !interestRateDelegate
                    ? null
                    : interestRateDelegate,
                });
              }
            }}
          />
        </div>
      </div>
    </Screen>
  );
}
