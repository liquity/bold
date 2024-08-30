"use client";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InterestRateField } from "@/src/comps/InterestRateField/InterestRateField";
import { RedemptionInfo } from "@/src/comps/RedemptionInfo/RedemptionInfo";
import { Screen } from "@/src/comps/Screen/Screen";
import { DEBT_SUGGESTIONS, INTEREST_RATE_DEFAULT } from "@/src/constants";
import content from "@/src/content";
import { ACCOUNT_BALANCES } from "@/src/demo-mode";
import { useInputFieldValue } from "@/src/form-utils";
import { getLiquidationRisk, getLoanDetails, getLtv } from "@/src/liquity-math";
import { useFindAvailableTroveIndex } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
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
  PillButton,
  TextButton,
  TokenIcon,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { match, P } from "ts-pattern";

const collateralSymbols = COLLATERALS.map(({ symbol }) => symbol);

function isCollateralSymbol(symbol: string): symbol is typeof collateralSymbols[number] {
  const c: string[] = collateralSymbols;
  return c.includes(symbol);
}

export function BorrowScreen() {
  const account = useAccount();

  const {
    currentStepIndex,
    discard,
    signAndSend,
    start,
    flow,
  } = useTransactionFlow();

  const availableTroveIndex = useFindAvailableTroveIndex(account.address);
  const openedTroveIndex = (availableTroveIndex.data ?? 0) - 1;

  const router = useRouter();

  // useParams() can return an array, but not with the current
  // routing setup so we can safely assume it’s a string
  const collSymbol = String(useParams().collateral ?? "eth").toUpperCase();
  if (!isCollateralSymbol(collSymbol)) {
    throw new Error(`Invalid collateral symbol: ${collSymbol}`);
  }
  const collateralIndex = collateralSymbols.indexOf(collSymbol);
  const collateral = COLLATERALS[collateralIndex];

  const deposit = useInputFieldValue((value) => `${dn.format(value)} ${collateral.name}`);
  const debt = useInputFieldValue((value) => `${dn.format(value)} BOLD`);
  const [interestRate, setInterestRate] = useState(dn.div(dn.from(INTEREST_RATE_DEFAULT, 18), 100));

  const collPrice = usePrice(collateral.symbol);

  if (!collPrice) {
    return null;
  }

  const loanDetails = getLoanDetails(
    deposit.isEmpty ? null : deposit.parsed,
    debt.isEmpty ? null : debt.parsed,
    interestRate && dn.div(interestRate, 100),
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

  const currentStepId = flow?.steps?.[currentStepIndex]?.id;

  const txMode = false;

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
      {txMode && (
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 16,
          })}
        >
          <div>
            <div>
              next available trove: {match(availableTroveIndex)
                .with({ status: "idle" }, () => "−")
                .with({ status: "loading" }, () => "fetching")
                .with({ status: "error" }, () => "error")
                .with({ status: "success" }, ({ data }) => `#${data}`)
                .exhaustive()}
            </div>
            <div>flow: {flow?.request.flowId}</div>
            <div>
              flow steps:{" "}
              {flow?.steps && <>[{flow?.steps.map(({ id, txHash }) => txHash ? `${id} (ok)` : id).join(", ")}]</>}
            </div>
            <div>
              current flow step: {currentStepIndex} ({flow?.steps && flow?.steps[currentStepIndex]?.id})
            </div>
            <div>
              flow step error: <pre>{flow?.steps?.[currentStepIndex]?.error}</pre>
            </div>
          </div>
          {match([account, availableTroveIndex])
            .with([
              { status: "connected", address: P.nonNullable },
              { status: "success" },
            ], ([
              account,
              availableTroveIndex,
            ]) => (
              (
                <div
                  className={css({
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                  })}
                >
                  <div
                    className={css({
                      display: "flex",
                      gap: 16,
                    })}
                  >
                    <Button
                      size="mini"
                      label={`openLoanPosition (#${availableTroveIndex.data})`}
                      onClick={() => {
                        start({
                          flowId: "openLoanPosition",
                          collIndex: 0,
                          owner: account.address,
                          ownerIndex: availableTroveIndex.data,
                          collAmount: dn.from(25, 18),
                          boldAmount: dn.from(2800, 18),
                          upperHint: dn.from(0, 18),
                          lowerHint: dn.from(0, 18),
                          annualInterestRate: dn.from(0.05, 18),
                          maxUpfrontFee: dn.from(100, 18),
                        });
                      }}
                    />
                    <Button
                      disabled={openedTroveIndex < 0}
                      label={`updateLoanPosition (#${availableTroveIndex.data - 1})`}
                      onClick={() => {
                        start({
                          flowId: "updateLoanPosition",
                          collIndex: 0,
                          owner: account.address,
                          ownerIndex: availableTroveIndex.data - 1,
                          collChange: dn.from(1, 18),
                          boldChange: dn.from(0, 18),
                          maxUpfrontFee: dn.from(100, 18),
                        });
                      }}
                      size="mini"
                    />
                    <Button
                      disabled={openedTroveIndex < 0}
                      label={`repayAndCloseLoanPosition (#${availableTroveIndex.data - 1})`}
                      onClick={() => {
                        start({
                          flowId: "repayAndCloseLoanPosition",
                          collIndex: 0,
                          owner: account.address,
                          ownerIndex: availableTroveIndex.data - 1,
                        });
                      }}
                      size="mini"
                    />
                  </div>
                  <div
                    className={css({
                      display: "flex",
                      gap: 16,
                    })}
                  >
                    <Button
                      size="mini"
                      label="discard"
                      onClick={discard}
                      disabled={!flow}
                    />
                    <Button
                      size="mini"
                      label={`sign & send${currentStepId ? ` (${currentStepId})` : ""}`}
                      onClick={() => {
                        if (currentStepIndex >= 0) {
                          signAndSend();
                        }
                      }}
                      disabled={!flow || currentStepIndex < 0}
                    />
                  </div>
                </div>
              )
            ))
            .otherwise(() => null)}
        </div>
      )}
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
              secondary={{
                start: `$${
                  deposit.parsed
                    ? dn.format(dn.mul(collPrice, deposit.parsed), { digits: 2, trailingZeros: true })
                    : "0.00"
                }`,
                end: account.isConnected && (
                  <TextButton
                    label={`Max ${dn.format(ACCOUNT_BALANCES[collateral.symbol])} ${collateral.name}`}
                    onClick={() => {
                      deposit.setValue(
                        dn.format(ACCOUNT_BALANCES[collateral.symbol]).replace(",", ""),
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
                    ? dn.format(dn.mul(collPrice, debt.parsed), {
                      digits: 2,
                      trailingZeros: true,
                    })
                    : "0.00"
                }`,
                end: debtSuggestions && (
                  <HFlex gap={6}>
                    {debtSuggestions.map((s) => (
                      s.debt && s.risk && (
                        <PillButton
                          key={dn.toString(s.debt)}
                          label={`$${dn.format(s.debt, { compact: true, digits: 0 })}`}
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
              router.push("/transactions/borrow");
            }}
          />
        </div>
      </div>
    </Screen>
  );
}
