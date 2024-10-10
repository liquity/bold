"use client";

import type { PositionLoan } from "@/src/types";

import { ARROW_RIGHT } from "@/src/characters";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InfoBox } from "@/src/comps/InfoBox/InfoBox";
import { InputTokenBadge } from "@/src/comps/InputTokenBadge/InputTokenBadge";
import { ValueUpdate } from "@/src/comps/ValueUpdate/ValueUpdate";
import { ETH_MAX_RESERVE } from "@/src/constants";
import { dnum18, dnumMin } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum, formatRisk } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import { getPrefixedTroveId } from "@/src/liquity-utils";
import { useAccount, useBalance } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  Button,
  HFlex,
  InfoTooltip,
  InputField,
  StatusDot,
  Tabs,
  TextButton,
  TokenIcon,
  TOKENS_BY_SYMBOL,
  VFlex,
} from "@liquity2/uikit";
import { maxUint256 } from "viem";

import * as dn from "dnum";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ValueUpdateMode = "add" | "remove";

export function PanelUpdateBorrowPosition({
  loan,
}: {
  loan: PositionLoan;
}) {
  const router = useRouter();
  const account = useAccount();
  const txFlow = useTransactionFlow();

  const collateral = TOKENS_BY_SYMBOL[loan.collateral];
  const collPrice = usePrice(collateral.symbol);
  const boldPriceUsd = usePrice("BOLD") ?? dnum18(0);

  // deposit change
  const [depositMode, setDepositMode] = useState<ValueUpdateMode>("add");
  const depositChange = useInputFieldValue((value) => dn.format(value));

  // deposit update
  const newDeposit = depositChange.parsed && (
    depositMode === "remove"
      ? dn.sub(loan.deposit, depositChange.parsed)
      : dn.add(loan.deposit, depositChange.parsed)
  );

  // debt change
  const [debtMode, setDebtMode] = useState<ValueUpdateMode>("add");
  const debtChange = useInputFieldValue((value) => dn.format(value));
  const debtChangeUsd = debtChange.parsed && dn.mul(debtChange.parsed, boldPriceUsd);

  const newDebt = debtChange.parsed && (
    debtMode === "remove"
      ? dn.sub(loan.borrowed, debtChange.parsed)
      : dn.add(loan.borrowed, debtChange.parsed)
  );

  const collBalance = useBalance(account.address, collateral.symbol);
  const boldBalance = useBalance(account.address, "BOLD");

  const collMax = depositMode === "remove" ? loan.deposit : (
    collBalance.data
      ? dn.sub(collBalance.data, ETH_MAX_RESERVE)
      : dnum18(0)
  );

  const boldMax = debtMode === "remove" && boldBalance.data
    ? dnumMin(
      boldBalance.data,
      loan.borrowed,
    )
    : null;

  const loanDetails = getLoanDetails(
    loan.deposit,
    loan.borrowed,
    loan.interestRate,
    collateral.collateralRatio,
    collPrice,
  );

  const newLoanDetails = getLoanDetails(
    newDeposit,
    newDebt,
    loanDetails.interestRate,
    collateral.collateralRatio,
    collPrice,
  );

  const allowSubmit = account.isConnected && (
    !dn.eq(loanDetails.deposit ?? dnum18(0), newLoanDetails.deposit ?? dnum18(0))
    || !dn.eq(loanDetails.debt ?? dnum18(0), newLoanDetails.debt ?? dnum18(0))
  );

  return (
    <>
      <VFlex gap={32}>
        <Field
          field={
            <InputField
              {...depositChange.inputFieldProps}
              contextual={
                <InputTokenBadge
                  background={false}
                  icon={<TokenIcon symbol={collateral.symbol} />}
                  label={collateral.name}
                />
              }
              label={{
                start: depositMode === "remove"
                  ? "Decrease your collateral"
                  : "Increase your collateral",
                end: (
                  <Tabs
                    compact
                    items={[
                      { label: "Deposit", panelId: "panel-deposit", tabId: "tab-deposit" },
                      { label: "Withdraw", panelId: "panel-withdraw", tabId: "tab-withdraw" },
                    ]}
                    onSelect={(index, { origin, event }) => {
                      setDepositMode(index === 1 ? "remove" : "add");
                      depositChange.setValue("");
                      if (origin !== "keyboard") {
                        event.preventDefault();
                        depositChange.focus();
                      }
                    }}
                    selected={depositMode === "remove" ? 1 : 0}
                  />
                ),
              }}
              labelHeight={32}
              placeholder="0.00"
              secondary={{
                start: (depositChange.parsed && collPrice)
                  ? "$" + fmtnum(dn.mul(depositChange.parsed, collPrice))
                  : "$0.00",
                end: (
                  <TextButton
                    label={`Max ${fmtnum(collMax, 2)} ${TOKENS_BY_SYMBOL[collateral.symbol].name}`}
                    onClick={() => {
                      depositChange.setValue(dn.toString(collMax));
                    }}
                  />
                ),
              }}
            />
          }
          footer={[[
            <Field.FooterInfo label="Collateral after" />,
            loanDetails.deposit && newLoanDetails.deposit && (
              <Field.FooterInfo
                label={
                  <HFlex alignItems="center" gap={8}>
                    <div>{fmtnum(loanDetails.deposit, 2)}</div>
                    <div>{ARROW_RIGHT}</div>
                  </HFlex>
                }
                value={
                  <HFlex alignItems="center" gap={8}>
                    <div>
                      {fmtnum(newLoanDetails.deposit, 2)} {TOKENS_BY_SYMBOL[collateral.symbol].name}
                    </div>
                    <InfoTooltip heading="Collateral update" />
                  </HFlex>
                }
              />
            ),
          ]]}
        />

        <Field
          field={
            <InputField
              {...debtChange.inputFieldProps}
              contextual={
                <InputTokenBadge
                  background={false}
                  icon={<TokenIcon symbol="BOLD" />}
                  label="BOLD"
                />
              }
              label={{
                start: debtMode === "remove"
                  ? "Decrease your debt"
                  : "Increase your debt",
                end: (
                  <Tabs
                    compact
                    items={[
                      { label: "Borrow", panelId: "panel-borrow", tabId: "tab-borrow" },
                      { label: "Repay", panelId: "panel-repay", tabId: "tab-repay" },
                    ]}
                    onSelect={(index, { origin, event }) => {
                      setDebtMode(index === 1 ? "remove" : "add");
                      debtChange.setValue("");
                      if (origin !== "keyboard") {
                        event.preventDefault();
                        debtChange.focus();
                      }
                    }}
                    selected={debtMode === "remove" ? 1 : 0}
                  />
                ),
              }}
              labelHeight={32}
              placeholder="0.00"
              secondary={{
                start: debtChangeUsd
                  ? "$" + fmtnum(debtChangeUsd)
                  : "$0.00",
                end: (
                  boldMax && (
                    <TextButton
                      label={`Max ${fmtnum(boldMax)} BOLD`}
                      onClick={() => {
                        debtChange.setValue(dn.toString(boldMax));
                      }}
                    />
                  )
                ),
              }}
            />
          }
          footer={[
            [
              <Field.FooterInfo label="Debt after" />,
              loanDetails.debt && newLoanDetails.debt && (
                <Field.FooterInfo
                  label={
                    <HFlex alignItems="center" gap={8}>
                      <div>{fmtnum(loanDetails.debt)}</div>
                      <div>{ARROW_RIGHT}</div>
                    </HFlex>
                  }
                  value={
                    <HFlex alignItems="center" gap={8}>
                      <div>{fmtnum(newLoanDetails.debt)} BOLD</div>
                      <InfoTooltip heading="Debt update" />
                    </HFlex>
                  }
                />
              ),
            ],
          ]}
        />

        <div
          className={css({
            paddingTop: 8,
            paddingBottom: 32,
          })}
        >
          <InfoBox>
            <HFlex justifyContent="space-between" gap={16}>
              <div>Liquidation risk</div>
              <ValueUpdate
                before={loanDetails.liquidationRisk && (
                  <HFlex gap={4} justifyContent="flex-start">
                    <StatusDot mode={riskLevelToStatusMode(loanDetails.liquidationRisk)} />
                    {formatRisk(loanDetails.liquidationRisk)}
                  </HFlex>
                )}
                after={newLoanDetails.liquidationRisk && (
                  <HFlex gap={4} justifyContent="flex-start">
                    <StatusDot mode={riskLevelToStatusMode(newLoanDetails.liquidationRisk)} />
                    {formatRisk(newLoanDetails.liquidationRisk)}
                  </HFlex>
                )}
              />
            </HFlex>
            <HFlex justifyContent="space-between" gap={16}>
              <div>
                <abbr title="Loan-to-value ratio">LTV</abbr>
              </div>
              <HFlex
                gap={8}
                className={css({
                  fontVariantNumeric: "tabular-nums",
                })}
              >
                {loanDetails.ltv && (
                  <div
                    className={css({
                      color: "contentAlt",
                    })}
                  >
                    {fmtnum(dn.mul(loanDetails.ltv, 100))}%
                  </div>
                )}
                <div
                  className={css({
                    color: "contentAlt",
                  })}
                >
                  {ARROW_RIGHT}
                </div>
                {newLoanDetails.ltv && (
                  <div>
                    {fmtnum(dn.mul(newLoanDetails.ltv, dn.lt(newLoanDetails.ltv, 0) ? 0 : 100))}%
                  </div>
                )}
              </HFlex>
            </HFlex>
            <HFlex justifyContent="space-between" gap={16}>
              <div>Liquidation price</div>
              <HFlex
                gap={8}
                className={css({
                  fontVariantNumeric: "tabular-nums",
                })}
              >
                {loanDetails.liquidationPrice && (
                  <div
                    className={css({
                      color: "contentAlt",
                    })}
                  >
                    ${fmtnum(loanDetails.liquidationPrice)}
                  </div>
                )}
                <div
                  className={css({
                    color: "contentAlt",
                  })}
                >
                  {ARROW_RIGHT}
                </div>
                {newLoanDetails.liquidationPrice && (
                  <div>
                    ${fmtnum(newLoanDetails.liquidationPrice)}
                  </div>
                )}
              </HFlex>
            </HFlex>
          </InfoBox>
        </div>
      </VFlex>

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
          label="Update position"
          mode="primary"
          size="large"
          wide
          onClick={() => {
            if (account.address) {
              txFlow.start({
                flowId: "updateLoanPosition",
                backLink: [`/loan?id=${loan.collIndex}:${loan.troveId}`, "Back to editing"],
                successLink: ["/", "Go to the dashboard"],
                successMessage: "The position has been updated successfully.",

                collIndex: loan.collIndex,
                prefixedTroveId: getPrefixedTroveId(loan.collIndex, loan.troveId),
                owner: account.address,
                collChange: dn.sub(newDeposit ?? dnum18(0), loan.deposit),
                debtChange: dn.sub(newDebt ?? dnum18(0), loan.borrowed),
                maxUpfrontFee: dnum18(maxUint256),
              });
              router.push("/transactions");
            }
          }}
        />
      </div>
    </>
  );
}
