"use client";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InterestRateField } from "@/src/comps/InterestRateField/InterestRateField";
import { RedemptionInfo } from "@/src/comps/RedemptionInfo/RedemptionInfo";
import { Screen } from "@/src/comps/Screen/Screen";
import { DEBT_SUGGESTIONS, INTEREST_RATE_DEFAULT } from "@/src/constants";
import content from "@/src/content";
import { useDemoMode } from "@/src/demo-mode";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { getLiquidationRisk, getLoanDetails, getLtv } from "@/src/liquity-math";
import { useAccount, useBalance } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { useTroveCount } from "@/src/subgraph-hooks";
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
  PillButton,
  TextButton,
  TokenIcon,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { match, P } from "ts-pattern";

const COLLATERAL_SYMBOLS = COLLATERALS.map(({ symbol }) => symbol);

export function BorrowScreen() {
  const account = useAccount();

  const {
    currentStepIndex,
    discard,
    signAndSend,
    start,
    flow,
  } = useTransactionFlow();

  const router = useRouter();

  // useParams() can return an array, but not with the current
  // routing setup so we can safely assume it’s a string
  const collSymbol = String(useParams().collateral ?? "eth").toUpperCase();
  if (!isCollateralSymbol(collSymbol)) {
    throw new Error(`Invalid collateral symbol: ${collSymbol}`);
  }

  // this is not the collIndex as deployed, but rather the index of the collateral
  // in COLLATERALS, which is the list of collaterals known by the app.
  const knownCollIndex = COLLATERAL_SYMBOLS.indexOf(collSymbol);
  const collateral = COLLATERALS[knownCollIndex];

  const deposit = useInputFieldValue((value) => `${fmtnum(value)} ${collateral.name}`);
  const debt = useInputFieldValue((value) => `${fmtnum(value)} BOLD`);
  const [interestRate, setInterestRate] = useState(dn.div(dn.from(INTEREST_RATE_DEFAULT, 18), 100));

  const collPrice = usePrice(collateral.symbol);

  const balances = COLLATERAL_SYMBOLS.map((symbol) => {
    // collateral symbols are static so we always
    // call the same number of useBalance hooks
    return useBalance(account.address, symbol);
  });

  const collBalance = balances[knownCollIndex];

  const troveCount = useTroveCount(account.address);
  const newTroveIndex = troveCount.data ?? 0;

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

  const demoMode = useDemoMode();

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
      {!demoMode.enabled && (
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 16,
          })}
        >
          <div>
            <div>
              next available trove id: {match(troveCount)
                .with({ status: "pending" }, () => "fetching")
                .with({ status: "error" }, () => "error")
                .with({ status: "success" }, ({ data }) => data)
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
          {match([account, troveCount])
            .with([
              { status: "connected", address: P.nonNullable },
              { status: "success" },
            ], ([
              account,
              troveCount,
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
                      label={`openLoanPosition (#${troveCount.data})`}
                      onClick={() => {
                        if (deposit.parsed && debt.parsed && dn.gt(interestRate, 0)) {
                          start({
                            flowId: "openLoanPosition",
                            collIndex: 0,
                            owner: account.address,
                            ownerIndex: troveCount.data ?? 0,
                            collAmount: deposit.parsed,
                            boldAmount: debt.parsed,
                            upperHint: dn.from(0, 18),
                            lowerHint: dn.from(0, 18),
                            annualInterestRate: dn.div(interestRate, 100),
                            maxUpfrontFee: [2n ** 256n - 1n, 18], // type(uint256).max
                          });
                        }
                      }}
                    />
                    <Button
                      disabled={newTroveIndex < 0}
                      label={`updateLoanPosition (#${(troveCount.data ?? 0) - 1})`}
                      onClick={() => {
                        start({
                          flowId: "updateLoanPosition",
                          collIndex: 0,
                          owner: account.address,
                          ownerIndex: (troveCount.data ?? 0) - 1,
                          collChange: dn.from(1, 18),
                          boldChange: dn.from(0, 18),
                          maxUpfrontFee: dn.from(100, 18),
                        });
                      }}
                      size="mini"
                    />
                    <Button
                      disabled={newTroveIndex < 0}
                      label={`repayAndCloseLoanPosition (#${(troveCount.data ?? 0) - 1})`}
                      onClick={() => {
                        start({
                          flowId: "repayAndCloseLoanPosition",
                          collIndex: 0,
                          owner: account.address,
                          ownerIndex: (troveCount.data ?? 0) - 1,
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
                  items={COLLATERALS.map(({ symbol, name }, index) => ({
                    icon: <TokenIcon symbol={symbol} />,
                    label: name,
                    value: account.isConnected
                      ? fmtnum(balances[index].data ?? 0)
                      : "−",
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
                  selected={knownCollIndex}
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
                    label={`Max ${fmtnum(collBalance.data)} ${collateral.name}`}
                    onClick={() => {
                      deposit.setValue(
                        fmtnum(collBalance.data).replace(",", ""),
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
                    ? fmtnum(dn.mul(collPrice, debt.parsed), "2z")
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
              router.push("/transactions/borrow");
            }}
          />
        </div>
      </div>
    </Screen>
  );
}
