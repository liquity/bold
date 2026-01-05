import type { PositionLoanCommitted } from "@/src/types";

import { INFINITY } from "@/src/characters";
import { Amount } from "@/src/comps/Amount/Amount";
import { Field } from "@/src/comps/Field/Field";
import { FlowButton } from "@/src/comps/FlowButton/FlowButton";
import { InputTokenBadge } from "@/src/comps/InputTokenBadge/InputTokenBadge";
import { LeverageField, useLeverageField } from "@/src/comps/LeverageField/LeverageField";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { UpdateBox } from "@/src/comps/UpdateBox/UpdateBox";
import { Value } from "@/src/comps/Value/Value";
import { ValueUpdate } from "@/src/comps/ValueUpdate/ValueUpdate";
import { WarningBox } from "@/src/comps/WarningBox/WarningBox";
import { ETH_MAX_RESERVE, LEVERAGE_SLIPPAGE_TOLERANCE, MAX_LTV_RESERVE_RATIO } from "@/src/constants";
import content from "@/src/content";
import { dnum18, DNUM_0, dnumNeg } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum, formatRisk } from "@/src/formatting";
import { getLiquidationPriceFromLeverage, getLoanChanges, getLoanDetails } from "@/src/liquity-math";
import { getCollToken, useBranchCollateralRatios, useBranchDebt } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { useAccount, useBalance } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import {
  Checkbox,
  HFlex,
  IconExternal,
  InputField,
  StatusDot,
  Tabs,
  TextButton,
  TokenIcon,
  VFlex,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useEffect, useId, useState } from "react";

function formatFull(value: dn.Dnum) {
  return fmtnum(value, "full");
}

export function PanelUpdateLeveragePosition({
  loan,
}: {
  loan: PositionLoanCommitted;
}) {
  const account = useAccount();

  const collToken = getCollToken(loan.branchId);
  if (!collToken) {
    throw new Error("collToken not found");
  }

  const collPrice = usePrice(collToken.symbol);

  // loan details before the update
  const initialLoanDetails = getLoanDetails(
    loan.deposit,
    loan.borrowed,
    loan.interestRate,
    collToken.collateralRatio,
    collPrice.data ?? null,
  );

  // deposit change
  const [depositMode, setDepositMode] = useState<"add" | "remove">("add");
  const depositChange = useInputFieldValue(formatFull);

  const newDeposit = depositChange.parsed
    ? (depositMode === "remove" ? dn.sub : dn.add)(loan.deposit, depositChange.parsed)
    : loan.deposit;

  const newDepositPreLeverage = initialLoanDetails.depositPreLeverage && depositChange.parsed
    ? (depositMode === "remove" ? dn.sub : dn.add)(initialLoanDetails.depositPreLeverage, depositChange.parsed)
    : initialLoanDetails.depositPreLeverage;

  const leverageField = useLeverageField({
    collPrice: collPrice.data ?? null,
    collToken,
    positionDeposit: newDeposit,
    positionDebt: loan.borrowed,
    maxLtvAllowedRatio: 1 - MAX_LTV_RESERVE_RATIO,
  });

  const newLoanDetails = getLoanDetails(
    leverageField.deposit,
    leverageField.debt,
    initialLoanDetails.interestRate,
    collToken.collateralRatio,
    collPrice.data ?? null,
  );

  const liquidationPrice = getLiquidationPriceFromLeverage(
    leverageField.leverageFactor,
    collPrice.data ?? DNUM_0,
    collToken.collateralRatio,
  );

  const collBalance = useBalance(account.address, collToken.symbol);

  const collMax = depositMode === "remove" ? null : (
    collBalance.data && dn.sub(
      collBalance.data,
      collToken?.symbol === "ETH" ? ETH_MAX_RESERVE : 0, // Only keep a reserve for ETH, not LSTs
    )
  );

  const [agreeToLiquidationRisk, setAgreeToLiquidationRisk] = useState(false);

  useEffect(() => {
    setAgreeToLiquidationRisk(false);
  }, [newLoanDetails.status]);

  const agreeCheckboxId = useId();

  const insufficientColl = depositMode === "add"
    && depositChange.parsed
    && collBalance.data
    && (dn.gt(depositChange.parsed, collBalance.data));

  const branchDebt = useBranchDebt(loan.branchId);
  const collateralRatios = useBranchCollateralRatios(loan.branchId);

  const loanChanges = newDeposit && leverageField.debt && collPrice.data
    ? getLoanChanges(loan.deposit, newDeposit, loan.borrowed, leverageField.debt, collPrice.data)
    : null;

  const newTcr = branchDebt.data
      && collateralRatios.data?.tcr
      && loanChanges
    ? (() => {
      const branchColl = dn.mul(collateralRatios.data.tcr, branchDebt.data);

      const totalCollAfter = dn.add(branchColl, loanChanges.loanCollChange);
      const totalDebtAfter = dn.add(branchDebt.data, loanChanges.loanDebtChange);

      return dn.div(totalCollAfter, totalDebtAfter);
    })()
    : null;

  const isNewTcrLtCcr = newTcr
    && collateralRatios.data?.ccr
    && dn.lt(newTcr, collateralRatios.data.ccr);

  const isNewTcrLteCcr = newTcr
    && collateralRatios.data?.ccr
    && dn.lte(newTcr, collateralRatios.data.ccr);

  const isOldTcrLtCcr = collateralRatios.data?.ccr
    && collateralRatios.data?.tcr
    && dn.lt(collateralRatios.data.tcr, collateralRatios.data.ccr);

  const isDebtChangeGteCollChange = dn.gte(
    loanChanges?.loanDebtChange ?? dnum18(0),
    loanChanges?.loanCollChange ?? dnum18(0),
  );

  const isCcrConditionsNotMet = ((depositChange.parsed && dn.gt(depositChange.parsed, 0))
    || (leverageField.leverageFactorChange && leverageField.leverageFactorChange !== 0)) && (
      !isOldTcrLtCcr
        ? isNewTcrLtCcr
        : (leverageField.leverageFactorChange && leverageField.leverageFactorChange > 0)
        ? isNewTcrLteCcr || isDebtChangeGteCollChange
        : isDebtChangeGteCollChange
    );

  const allowSubmit = account.isConnected
    && (newLoanDetails.status !== "at-risk" || (!loan.batchManager && agreeToLiquidationRisk))
    && newLoanDetails.status !== "underwater"
    && newLoanDetails.status !== "liquidatable"
    && (
      // either the deposit or the leverage factor has changed
      !dn.eq(initialLoanDetails.deposit ?? DNUM_0, newLoanDetails.deposit ?? DNUM_0)
      || initialLoanDetails.leverageFactor !== newLoanDetails.leverageFactor
    )
    && leverageField.isValid
    && !isCcrConditionsNotMet
    && !insufficientColl;

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
              drawer={!depositChange.isFocused && insufficientColl
                ? { mode: "error", message: `Insufficient ${collToken.name} balance.` }
                : null}
              label={{
                start: depositMode === "remove"
                  ? "Decrease deposit"
                  : "Increase deposit",
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
                start: collPrice.data && (
                  fmtnum(
                    depositChange.parsed
                      ? dn.mul(depositChange.parsed, collPrice.data)
                      : 0,
                    { preset: "2z", prefix: "$" },
                  )
                ),
                end: collMax && dn.gt(collMax, 0) && (
                  <TextButton
                    label={`Max ${fmtnum(collMax, 2)} ${collToken.name}`}
                    onClick={() => {
                      depositChange.setValue(dn.toString(collMax));
                    }}
                  />
                ),
              }}
            />
          }
          footer={{
            end: initialLoanDetails.depositPreLeverage && newDepositPreLeverage && (
              <Field.FooterInfo
                value={
                  <HFlex alignItems="center" gap={8}>
                    <ValueUpdate
                      before={
                        <Value
                          negative={initialLoanDetails.depositPreLeverage && dn.lt(
                            initialLoanDetails.depositPreLeverage,
                            0,
                          )}
                          title={`${
                            fmtnum(
                              initialLoanDetails.depositPreLeverage,
                              "full",
                            )
                          } ${collToken.name}`}
                        >
                          {fmtnum(initialLoanDetails.depositPreLeverage)}
                        </Value>
                      }
                      after={
                        <Value
                          negative={newLoanDetails.deposit && dn.lt(newDepositPreLeverage, 0)}
                          title={`${fmtnum(newDepositPreLeverage, "full")} ${collToken.name}`}
                        >
                          {fmtnum(newDepositPreLeverage)} {collToken.name}
                        </Value>
                      }
                      fontSize={14}
                    />
                  </HFlex>
                }
              />
            ),
          }}
        />

        <Field
          field={<LeverageField inputId="input-liquidation-price" {...leverageField} />}
          footer={[
            {
              start: leverageField.leverageFactorChange === 0
                ? <Field.FooterInfoPriceImpactNone />
                : leverageField.leverageFactorChange > 0
                ? (
                  <Field.FooterInfoPriceImpact
                    inputTokenName="BOLD"
                    outputTokenName={collToken.name}
                    priceImpact={leverageField.priceImpact}
                  />
                )
                : (
                  <Field.FooterInfoPriceImpact
                    inputTokenName={collToken.name}
                    outputTokenName="BOLD"
                    priceImpact={leverageField.priceImpact}
                  />
                ),

              end: (
                <ValueUpdate
                  fontSize={14}
                  before={fmtnum(initialLoanDetails.liquidationPrice, { preset: "2z", prefix: "$" })}
                  after={fmtnum(liquidationPrice, { preset: "2z", prefix: "$" })}
                />
              ),
            },
            {
              start: leverageField.leverageFactorChange > 0
                ? (
                  <Field.FooterInfoSlippageRefundLeverUp
                    slippageProtection={leverageField.slippageProtection}
                    collateralName={collToken.name}
                  />
                )
                : <Field.FooterInfoSlippageRefundNone />,
            },
          ]}
        />

        <VFlex
          gap={16}
          className={css({
            paddingTop: 8,
            paddingBottom: 32,
          })}
        >
          <UpdateBox
            updates={[
              {
                label: "Liquidation risk",
                before: (
                  <>
                    <StatusDot
                      mode={riskLevelToStatusMode(
                        initialLoanDetails.liquidationRisk,
                      )}
                    />
                    {formatRisk(initialLoanDetails.liquidationRisk)}
                  </>
                ),
                after: (
                  <>
                    <StatusDot
                      mode={riskLevelToStatusMode(
                        newLoanDetails.liquidationRisk,
                      )}
                    />
                    {formatRisk(newLoanDetails.liquidationRisk)}
                  </>
                ),
              },
              {
                label: <abbr title="Loan-to-value ratio">LTV</abbr>,
                before: <Amount value={initialLoanDetails.ltv} percentage />,
                after: <Amount value={newLoanDetails.ltv} percentage />,
              },
              {
                label: "Multiply",
                before: (
                  initialLoanDetails.status === "underwater"
                    ? INFINITY
                    : <Amount value={initialLoanDetails.leverageFactor} format="1z" suffix="x" />
                ),
                after: <Amount value={leverageField.leverageFactor} format="1z" suffix="x" />,
              },
              {
                label: "Exposure",
                before: (
                  <Amount
                    title={`${fmtnum(initialLoanDetails.deposit, "full")} ${collToken.name}`}
                    value={initialLoanDetails.deposit}
                  />
                ),
                after: (
                  <Amount
                    value={newLoanDetails.deposit}
                    suffix={` ${collToken.name}`}
                  />
                ),
              },
              {
                label: "Debt",
                before: (
                  <Amount
                    title={`${fmtnum(initialLoanDetails.debt, "full")} JPYDF`}
                    value={initialLoanDetails.debt}
                  />
                ),
                after: (
                  <Amount
                    value={newLoanDetails.debt}
                    suffix=" JPYDF"
                  />
                ),
              },
            ]}
          />

          {isCcrConditionsNotMet && collateralRatios.data
            ? (
              <WarningBox>
                <div>
                  <div
                    className={css({
                      fontSize: 16,
                      fontWeight: 600,
                      marginBottom: 12,
                    })}
                  >
                    {content.ccrWarning.title}
                  </div>
                  <div
                    className={css({
                      fontSize: 15,
                      marginBottom: 12,
                    })}
                  >
                    {!isOldTcrLtCcr
                      ? content.ccrWarning.updatePushBelow({
                        newTcr: <Amount value={newTcr} percentage format={0} />,
                        ccr: <Amount value={collateralRatios.data.ccr} percentage format={0} />,
                      })
                      : leverageField.leverageFactorChange && leverageField.leverageFactorChange > 0
                      ? content.ccrWarning.updateBorrowMore({
                        tcr: <Amount value={collateralRatios.data.tcr} percentage format={0} />,
                        ccr: <Amount value={collateralRatios.data.ccr} percentage format={0} />,
                        newTcr: <Amount value={newTcr} percentage format={0} />,
                        isNewTcrLteCcr: Boolean(isNewTcrLteCcr),
                      })
                      : content.ccrWarning.updateWithdrawColl({
                        tcr: <Amount value={collateralRatios.data.tcr} percentage format={0} />,
                        ccr: <Amount value={collateralRatios.data.ccr} percentage format={0} />,
                      })}
                  </div>
                  <LinkTextButton
                    href={content.ccrWarning.learnMoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    label={
                      <span
                        className={css({
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          color: "white",
                        })}
                      >
                        <span>{content.ccrWarning.learnMoreLabel}</span>
                        <IconExternal size={16} />
                      </span>
                    }
                  />
                </div>
              </WarningBox>
            )
            : newLoanDetails.status === "underwater" || newLoanDetails.status === "liquidatable"
            ? (
              <WarningBox>
                <div>
                  Your position is above the maximum <abbr title="Loan-to-value ratio">LTV</abbr> of{" "}
                  <Amount value={newLoanDetails.maxLtv} percentage />. You need to add at least{" "}
                  <Amount value={newLoanDetails.depositToZero && dn.mul(newLoanDetails.depositToZero, -1)} format={4} />
                  {" "}
                  {collToken.name} to prevent liquidation.
                </div>
              </WarningBox>
            )
            : newLoanDetails.status === "at-risk"
            ? (
              <WarningBox>
                {loan.batchManager
                  ? content.atRiskWarning.delegated(`${fmtnum(newLoanDetails.maxLtvAllowed, "pct2z")}%`)
                  : (
                    <>
                      {content.atRiskWarning.manual(
                        `${fmtnum(newLoanDetails.ltv, "pct2z")}%`,
                        `${fmtnum(newLoanDetails.maxLtv, "pct2z")}%`,
                      ).message}
                      <label
                        htmlFor={agreeCheckboxId}
                        className={css({
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          cursor: "pointer",
                        })}
                      >
                        <Checkbox
                          id={agreeCheckboxId}
                          checked={agreeToLiquidationRisk}
                          onChange={(checked) => {
                            setAgreeToLiquidationRisk(checked);
                          }}
                        />
                        {content.atRiskWarning.manual("", "").checkboxLabel}
                      </label>
                    </>
                  )}
              </WarningBox>
            )
            : null}
        </VFlex>
      </VFlex>
      <FlowButton
        disabled={!allowSubmit}
        label="Update position"
        request={{
          flowId: "updateLeveragePosition",
          backLink: [
            `/loan?id=${loan.branchId}:${loan.troveId}`,
            "Back to editing",
          ],
          successLink: ["/", "Go to the dashboard"],
          successMessage: "The position has been updated successfully.",

          loan: { ...loan, deposit: leverageField.deposit ?? DNUM_0, borrowed: leverageField.debt ?? DNUM_0 },
          prevLoan: loan,
          depositChange: depositChange.parsed && !dn.eq(depositChange.parsed, DNUM_0)
            ? (depositMode === "remove" ? dnumNeg(depositChange.parsed) : depositChange.parsed)
            : null,
          debtChange: leverageField.debtChange,
          leverageFactorChange: [initialLoanDetails.leverageFactor, leverageField.leverageFactor],

          leverage: leverageField.leverageFactorChange !== 0
            ? (leverageField.leverageFactorChange > 0
              ? {
                direction: "up",
                flashloanAmount: leverageField.depositChange ?? DNUM_0,
                boldAmount: leverageField.debtChange ?? DNUM_0,
              }
              : {
                direction: "down",
                flashloanAmount: dn.abs(leverageField.depositChange ?? DNUM_0),
                minBoldAmount: dn.mul(dn.abs(leverageField.debtChange ?? DNUM_0), 1 - LEVERAGE_SLIPPAGE_TOLERANCE),
              })
            : null,
        }}
      />
    </>
  );
}
