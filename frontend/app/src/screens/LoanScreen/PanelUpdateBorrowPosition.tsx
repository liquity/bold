"use client";

import type { PositionLoan } from "@/src/types";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InfoBox } from "@/src/comps/InfoBox/InfoBox";
import { InputTokenBadge } from "@/src/comps/InputTokenBadge/InputTokenBadge";
import { ValueUpdate } from "@/src/comps/ValueUpdate/ValueUpdate";
import { ETH_MAX_RESERVE } from "@/src/constants";
import { ACCOUNT_BALANCES } from "@/src/demo-mode";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum, formatRisk } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import { useAccount } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
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

import * as dn from "dnum";
import { useRouter } from "next/navigation";
import { useState } from "react";

type RelativeFieldMode = "add" | "remove";

const ARROW_RIGHT = "→";

export function PanelUpdateBorrowPosition({ loan }: { loan: PositionLoan }) {
  const router = useRouter();
  const account = useAccount();

  const collateral = TOKENS_BY_SYMBOL[loan.collateral];
  const collPrice = usePrice(collateral.symbol);
  const boldPriceUsd = usePrice("BOLD") ?? dn.from(0, 18);

  // deposit change
  const [depositMode, setDepositMode] = useState<RelativeFieldMode>("add");
  const depositChange = useInputFieldValue((value) => dn.format(value));

  // deposit update
  const newDeposit = depositChange.parsed && (
    depositMode === "remove"
      ? dn.sub(loan.deposit, depositChange.parsed)
      : dn.add(loan.deposit, depositChange.parsed)
  );

  const collMax = depositMode === "remove" ? loan.deposit : dn.sub(
    ACCOUNT_BALANCES[collateral.symbol],
    ETH_MAX_RESERVE,
  );

  // debt change
  const [debtMode, setDebtMode] = useState<RelativeFieldMode>("add");
  const debtChange = useInputFieldValue((value) => dn.format(value));
  const debtChangeUsd = debtChange.parsed && dn.mul(debtChange.parsed, boldPriceUsd);

  const newDebt = debtChange.parsed && (
    debtMode === "remove"
      ? dn.sub(loan.borrowed, debtChange.parsed)
      : dn.add(loan.borrowed, debtChange.parsed)
  );

  const boldMax = debtMode === "remove" ? ACCOUNT_BALANCES["BOLD"] : null;

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
    !dn.eq(loanDetails.deposit ?? dn.from(0, 18), newLoanDetails.deposit ?? dn.from(0, 18))
    || !dn.eq(loanDetails.debt ?? dn.from(0, 18), newLoanDetails.debt ?? dn.from(0, 18))
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
                    onSelect={(index) => {
                      setDepositMode(index === 1 ? "remove" : "add");
                      depositChange.setValue("0");
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
                    onSelect={(index) => {
                      setDebtMode(index === 1 ? "remove" : "add");
                      debtChange.setValue("0");
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
            router.push("/transactions/update-loan");
          }}
        />
      </div>
    </>
  );
}
