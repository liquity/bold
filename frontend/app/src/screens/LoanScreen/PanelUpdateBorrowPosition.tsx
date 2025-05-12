"use client";

import type { PositionLoanCommitted } from "@/src/types";

import { ARROW_RIGHT } from "@/src/characters";
import { Amount } from "@/src/comps/Amount/Amount";
import { Field } from "@/src/comps/Field/Field";
import { FlowButton } from "@/src/comps/FlowButton/FlowButton";
import { InputTokenBadge } from "@/src/comps/InputTokenBadge/InputTokenBadge";
import { UpdateBox } from "@/src/comps/UpdateBox/UpdateBox";
import { ETH_MAX_RESERVE, MIN_DEBT } from "@/src/constants";
import { dnum18, dnumMax, dnumMin } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum, formatRisk } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import { getCollToken } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { useAccount, useBalance } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import {
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
import { useState } from "react";

type ValueUpdateMode = "add" | "remove";

export function PanelUpdateBorrowPosition({
  loan,
}: {
  loan: PositionLoanCommitted;
}) {
  const account = useAccount();

  const collToken = getCollToken(loan.branchId);
  if (!collToken) {
    throw new Error("collToken not found");
  }

  // balances
  const collBalance = useBalance(account.address, collToken.symbol);
  const boldBalance = useBalance(account.address, "BOLD");

  // prices
  const collPrice = usePrice(collToken.symbol ?? null);
  const boldPriceUsd = usePrice("BOLD") ?? dnum18(0);

  // deposit change
  const [depositMode, setDepositMode] = useState<ValueUpdateMode>("add");
  const depositChange = useInputFieldValue((value) => fmtnum(value, "full"));

  // deposit update
  const newDeposit = depositChange.parsed && (
    depositMode === "remove"
      ? dn.sub(loan.deposit, depositChange.parsed)
      : dn.add(loan.deposit, depositChange.parsed)
  );

  // debt change
  const [debtMode, setDebtMode] = useState<ValueUpdateMode>("add");
  const debtChange = useInputFieldValue((value) => fmtnum(value, "full"));

  const newDebt = debtChange.parsed && (
    debtMode === "remove"
      ? dn.sub(loan.borrowed, debtChange.parsed)
      : dn.add(loan.borrowed, debtChange.parsed)
  );

  const collMax = depositMode === "remove" ? null : (
    collBalance.data && dnumMax(
      dn.sub(
        collBalance.data,
        collToken.symbol === "ETH" ? ETH_MAX_RESERVE : 0, // Only keep a reserve for ETH, not LSTs
      ),
      dnum18(0),
    )
  );

  const boldMax = debtMode === "remove" && boldBalance.data
    ? dnumMin(
      boldBalance.data,
      loan.borrowed,
    )
    : null;

  if (!collPrice.data || !boldPriceUsd.data) {
    return null;
  }

  const debtChangeUsd = debtChange.parsed && dn.mul(debtChange.parsed, boldPriceUsd.data);

  const loanDetails = getLoanDetails(
    loan.deposit,
    loan.borrowed,
    loan.interestRate,
    collToken.collateralRatio,
    collPrice.data,
  );

  const newLoanDetails = getLoanDetails(
    newDeposit,
    newDebt,
    loanDetails.interestRate,
    collToken.collateralRatio,
    collPrice.data,
  );

  const maxLtv = dn.div(dn.from(1, 18), collToken.collateralRatio);

  const isBelowMinDebt = debtChange.parsed && !debtChange.isEmpty && newDebt
    && dn.lt(newDebt, MIN_DEBT);

  const isAboveMaxLtv = newLoanDetails.ltv && dn.gt(newLoanDetails.ltv, maxLtv);

  const insufficientBold = debtMode === "remove"
    && debtChange.parsed
    && !debtChange.isEmpty
    && boldBalance.data
    && dn.gt(debtChange.parsed, boldBalance.data);

  const allowSubmit = account.isConnected
    // above min. debt
    && !isBelowMinDebt
    // the new deposit must be positive
    && dn.gt(newLoanDetails.deposit ?? dnum18(0), 0)
    // the account must have enough BOLD
    && !insufficientBold
    // there should be a change in the deposit or debt
    && (
      !dn.eq(loanDetails.deposit ?? dnum18(0), newLoanDetails.deposit ?? dnum18(0))
      || !dn.eq(loanDetails.debt ?? dnum18(0), newLoanDetails.debt ?? dnum18(0))
    )
    // the LTV is not above the maximum
    && !isAboveMaxLtv;

  return (
    <>
      <VFlex gap={32}>
        <Field
          field={
            <InputField
              {...depositChange.inputFieldProps}
              id="input-deposit-change"
              contextual={
                <InputTokenBadge
                  background={false}
                  icon={<TokenIcon symbol={collToken.symbol} />}
                  label={collToken.name}
                />
              }
              label={{
                start: depositMode === "remove"
                  ? "Decrease collateral"
                  : "Increase collateral",
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
                start: (
                  <Amount
                    value={depositChange.parsed
                      ? dn.mul(depositChange.parsed, collPrice.data)
                      : 0}
                    suffix="$"
                  />
                ),
                end: collMax && dn.gt(collMax, 0) && (
                  <TextButton
                    label={`Max ${fmtnum(collMax, 2)} ${TOKENS_BY_SYMBOL[collToken.symbol].name}`}
                    onClick={() => {
                      depositChange.setValue(dn.toString(collMax));
                    }}
                  />
                ),
              }}
            />
          }
          footer={{
            end: loanDetails.deposit && newLoanDetails.deposit && (
              <Field.FooterInfo
                label={
                  <HFlex alignItems="center" gap={8}>
                    <Amount
                      format={2}
                      value={loanDetails.deposit}
                    />
                    <div>{ARROW_RIGHT}</div>
                  </HFlex>
                }
                value={
                  <HFlex alignItems="center" gap={8}>
                    <div
                      className={css({
                        "--color-error": "token(colors.negativeStrong)",
                      })}
                      style={{
                        color: dn.lt(newLoanDetails.deposit, 0) ? "var(--color-error)" : "inherit",
                      }}
                    >
                      <Amount
                        format={2}
                        suffix={` ${collToken.name}`}
                        value={newLoanDetails.deposit}
                      />
                    </div>
                    <InfoTooltip heading="Collateral update">
                      <div>
                        Before:{" "}
                        <Amount
                          format={2}
                          suffix={` ${collToken.name}`}
                          value={loanDetails.deposit}
                        />
                        {" ("}
                        <Amount
                          format={2}
                          prefix="$"
                          value={dn.mul(loanDetails.deposit, collPrice.data)}
                        />
                        {")"}
                      </div>
                      <div>
                        After:{" "}
                        <Amount
                          format={2}
                          suffix={` ${collToken.name}`}
                          value={newLoanDetails.deposit}
                        />
                        {" ("}
                        <Amount
                          format={2}
                          prefix="$"
                          value={dn.mul(newLoanDetails.deposit, collPrice.data)}
                        />
                        {")"}
                      </div>
                    </InfoTooltip>
                  </HFlex>
                }
              />
            ),
          }}
        />

        <Field
          field={
            <InputField
              {...debtChange.inputFieldProps}
              id="input-debt-change"
              contextual={
                <InputTokenBadge
                  background={false}
                  icon={<TokenIcon symbol="BOLD" />}
                  label="BOLD"
                />
              }
              drawer={!debtChange.isFocused && isBelowMinDebt
                ? { mode: "error", message: `You must borrow at least ${fmtnum(MIN_DEBT, 2)} BOLD.` }
                : insufficientBold
                ? { mode: "error", message: "Insufficient BOLD balance." }
                : null}
              label={{
                start: debtMode === "remove"
                  ? "Decrease loan"
                  : "Increase loan",
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
                start: <Amount value={debtChangeUsd ?? 0} suffix="$" />,
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
          footer={{
            end: loanDetails.debt && newLoanDetails.debt && (
              <Field.FooterInfo
                label={
                  <HFlex alignItems="center" gap={8}>
                    <Amount value={loanDetails.debt} />
                    <div>{ARROW_RIGHT}</div>
                  </HFlex>
                }
                value={
                  <HFlex alignItems="center" gap={8}>
                    <div
                      className={css({
                        "--color-error": "token(colors.negativeStrong)",
                      })}
                      style={{
                        color: isBelowMinDebt ? "var(--color-error)" : "inherit",
                      }}
                    >
                      <Amount
                        value={newLoanDetails.debt}
                        suffix=" BOLD"
                      />
                    </div>
                    <InfoTooltip heading="Debt update">
                      <div>
                        Before: <Amount value={loanDetails.debt} suffix=" BOLD" />
                      </div>
                      <div>
                        After: <Amount value={newLoanDetails.debt} suffix=" BOLD" />
                      </div>
                    </InfoTooltip>
                  </HFlex>
                }
              />
            ),
          }}
        />

        <div
          className={css({
            paddingTop: 8,
            paddingBottom: 32,
          })}
        >
          <UpdateBox
            updates={[
              {
                label: "Liquidation risk",
                before: loanDetails.liquidationRisk && (
                  <>
                    <StatusDot mode={riskLevelToStatusMode(loanDetails.liquidationRisk)} />
                    {formatRisk(loanDetails.liquidationRisk)}
                  </>
                ),
                after: newLoanDetails.liquidationRisk && (
                  <>
                    <StatusDot mode={riskLevelToStatusMode(newLoanDetails.liquidationRisk)} />
                    {formatRisk(newLoanDetails.liquidationRisk)}
                  </>
                ),
              },
              {
                label: <abbr title="Loan-to-value ratio">LTV</abbr>,
                before: <Amount value={loanDetails.ltv} percentage />,
                after: newLoanDetails.ltv && dn.gt(newLoanDetails.ltv, 0)
                  ? isAboveMaxLtv
                    ? (
                      <div
                        className={css({
                          color: "negativeStrong",
                        })}
                      >
                        <Amount
                          value={maxLtv}
                          prefix=">"
                          percentage
                        />
                      </div>
                    )
                    : (
                      <Amount
                        value={newLoanDetails.ltv}
                        percentage
                      />
                    )
                  : "N/A",
              },
              {
                label: "Liquidation price",
                before: <Amount prefix="$" value={loanDetails.liquidationPrice} />,
                after: newLoanDetails.liquidationPrice
                  ? <Amount prefix="$" value={newLoanDetails.liquidationPrice} />
                  : "N/A",
              },
            ]}
          />
        </div>
      </VFlex>
      <FlowButton
        disabled={!allowSubmit}
        label="Update position"
        request={{
          flowId: "updateBorrowPosition",
          backLink: [`/loan?id=${loan.branchId}:${loan.troveId}`, "Back to editing"],
          successLink: ["/", "Go to the dashboard"],
          successMessage: "The position has been updated successfully.",
          prevLoan: { ...loan },
          loan: {
            ...loan,
            deposit: newDeposit ?? loan.deposit,
            borrowed: newDebt ?? loan.borrowed,
          },
          maxUpfrontFee: dnum18(maxUint256),
        }}
      />
    </>
  );
}
