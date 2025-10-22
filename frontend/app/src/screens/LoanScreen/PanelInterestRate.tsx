import type { DelegateMode } from "@/src/comps/InterestRateField/InterestRateField";
import type { BranchId, PositionLoanCommitted, TroveId } from "@/src/types";

import { ARROW_RIGHT, NBSP } from "@/src/characters";
import { Amount } from "@/src/comps/Amount/Amount";
import { Field } from "@/src/comps/Field/Field";
import { FlowButton } from "@/src/comps/FlowButton/FlowButton";
import { InterestRateField } from "@/src/comps/InterestRateField/InterestRateField";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { UpdateBox } from "@/src/comps/UpdateBox/UpdateBox";
import { WarningBox } from "@/src/comps/WarningBox/WarningBox";
import { INTEREST_RATE_ADJ_COOLDOWN } from "@/src/constants";
import content from "@/src/content";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum, formatRelativeTime } from "@/src/formatting";
import { formatRisk } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import {
  getCollToken,
  useBranchCollateralRatios,
  useRedemptionRiskOfInterestRate,
  useRedemptionRiskOfLoan,
  useTroveRateUpdateCooldown,
} from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { infoTooltipProps, riskLevelToStatusMode } from "@/src/uikit-utils";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { addressesEqual, Checkbox, HFlex, IconExternal, IconSuggestion, InfoTooltip, StatusDot } from "@liquity2/uikit";
import * as dn from "dnum";
import { useEffect, useId, useRef, useState } from "react";

export function PanelInterestRate({
  loan,
  loanMode,
}: {
  loan: PositionLoanCommitted;
  loanMode: "borrow" | "multiply";
}) {
  const account = useAccount();

  const collToken = getCollToken(loan.branchId);
  const collPrice = usePrice(collToken.symbol);

  const deposit = useInputFieldValue((value) => `${fmtnum(value, "full")} ${collToken.symbol}`, {
    defaultValue: dn.toString(loan.deposit),
  });
  const debt = useInputFieldValue((value) => `${fmtnum(value, "full")} BOLD`, {
    defaultValue: dn.toString(loan.borrowed),
  });

  const [interestRate, setInterestRate] = useState(loan.interestRate);
  const [interestRateMode, setInterestRateMode] = useState<DelegateMode>(
    loan.batchManager
      ? "delegate"
      : "manual",
  );
  const [interestRateDelegate, setInterestRateDelegate] = useState(
    loan.batchManager,
  );

  const [agreeToLiquidationRisk, setAgreeToLiquidationRisk] = useState(false);
  const agreeCheckboxId = useId();

  const updateRateCooldown = useUpdateRateCooldown(loan.branchId, loan.troveId);

  const collateralRatios = useBranchCollateralRatios(loan.branchId);
  const isZombieTrove = loan.isZombie;

  const currentRedemptionRisk = useRedemptionRiskOfLoan(loan);
  const newRedemptionRisk = useRedemptionRiskOfInterestRate(loan.branchId, interestRate, loan);

  const loanDetails = getLoanDetails(
    loan.deposit,
    loan.borrowed,
    loan.interestRate,
    collToken.collateralRatio,
    collPrice.data ?? null,
  );

  const newLoanDetails = getLoanDetails(
    deposit.isEmpty ? null : deposit.parsed,
    debt.isEmpty ? null : debt.parsed,
    interestRate,
    collToken.collateralRatio,
    collPrice.data ?? null,
  );

  useEffect(() => {
    setAgreeToLiquidationRisk(false);
  }, [newLoanDetails.status]);

  const boldInterestPerYear = interestRate
    && debt.parsed
    && dn.mul(debt.parsed, interestRate);

  const boldInterestPerYearPrev = loan.interestRate
    && loan.borrowed
    && dn.mul(loan.borrowed, loan.interestRate);

  const isCcrConditionsNotMet = collateralRatios.data?.tcr
    && collateralRatios.data?.ccr
    && updateRateCooldown
    && dn.lt(collateralRatios.data.tcr, collateralRatios.data.ccr)
    && updateRateCooldown.active;

  const isDelegated = interestRateMode === "delegate" && interestRateDelegate;
  const allowSubmit = Boolean(
    account.address && addressesEqual(
      loan.borrower,
      account.address,
    ),
  )
    && !isZombieTrove
    && deposit.parsed && dn.gt(deposit.parsed, 0)
    && debt.parsed && dn.gt(debt.parsed, 0)
    && interestRate && dn.gt(interestRate, 0)
    && (
      !dn.eq(interestRate, loan.interestRate)
      || loan.batchManager !== interestRateDelegate
    )
    && !isCcrConditionsNotMet
    && (newLoanDetails.status !== "at-risk" || (!isDelegated && agreeToLiquidationRisk));

  return (
    <>
      <Field
        // “Interest rate”
        field={
          <InterestRateField
            inputId="input-interest-rate"
            branchId={loan.branchId}
            debt={debt.parsed}
            delegate={interestRateDelegate}
            interestRate={interestRate}
            mode={interestRateMode}
            onChange={setInterestRate}
            onDelegateChange={setInterestRateDelegate}
            onModeChange={setInterestRateMode}
            loan={loan}
          />
        }
        footer={{
          start: (
            <Field.FooterInfo
              label={updateRateCooldown.status === "success" && (
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: "contentAlt",
                    fontSize: 14,
                  })}
                >
                  <div
                    className={css({
                      flexShrink: 0,
                    })}
                  >
                    <IconSuggestion size={16} />
                  </div>
                  <div
                    className={css({
                      flexShrink: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                    })}
                  >
                    {updateRateCooldown.active
                      ? (
                        <>
                          {"Adjust without fee "}
                          <span ref={updateRateCooldown.remainingRef} />
                        </>
                      )
                      : <>No fee for rate adjustment</>}
                  </div>
                  <InfoTooltip
                    content={{
                      heading: "Interest rate updates",
                      body: (
                        <div>
                          Rate adjustments made within 7{NBSP}days of the last change incur a fee equal to 7{NBSP}days
                          of average interest.
                        </div>
                      ),
                      footerLink: {
                        href: "https://docs.liquity.org/v2-faq/borrowing-and-liquidations#can-i-adjust-the-rate",
                        label: "Learn more",
                      },
                    }}
                  />
                </div>
              )}
            />
          ),
          end: (
            <Field.FooterInfo
              label={
                <HFlex alignItems="center" gap={8}>
                  <Amount
                    value={loanDetails.interestRate}
                    percentage
                  />
                  <div>{ARROW_RIGHT}</div>
                </HFlex>
              }
              value={
                <HFlex alignItems="center" gap={8}>
                  <Amount
                    value={newLoanDetails.interestRate}
                    percentage
                  />
                </HFlex>
              }
            />
          ),
        }}
      />

      <div
        className={css({
          padding: "8px 0",
        })}
      >
        <UpdateBox
          updates={[
            {
              label: "Redemption risk",
              before: currentRedemptionRisk.data && (
                <>
                  <StatusDot mode={riskLevelToStatusMode(currentRedemptionRisk.data)} />
                  {formatRisk(currentRedemptionRisk.data)}
                </>
              ),
              after: newRedemptionRisk.data && (
                <>
                  <StatusDot mode={riskLevelToStatusMode(newRedemptionRisk.data)} />
                  {formatRisk(newRedemptionRisk.data)}
                </>
              ),
            },
            {
              label: (
                <>
                  <div>BOLD interest per year</div>
                  <InfoTooltip {...infoTooltipProps(content.generalInfotooltips.interestRateBoldPerYear)} />
                </>
              ),
              before: <Amount value={boldInterestPerYearPrev} suffix=" BOLD" />,
              after: <Amount value={boldInterestPerYear} suffix=" BOLD" />,
            },
          ]}
        />
      </div>

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
                {content.ccrWarning.interestRateAdjustment({
                  tcr: <Amount value={collateralRatios.data.tcr} percentage format={0} />,
                  ccr: <Amount value={collateralRatios.data.ccr} percentage format={0} />,
                  cooldownDays: INTEREST_RATE_ADJ_COOLDOWN / (24 * 60 * 60),
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
        : newLoanDetails.status === "at-risk" && (
          <WarningBox>
            {isDelegated
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
        )}

      {isZombieTrove && (
        <WarningBox>
          <div>
            Interest rate can't be adjusted on loans with debt below 2,000 BOLD. Please adjust your debt first.
          </div>
        </WarningBox>
      )}

      <FlowButton
        disabled={!allowSubmit}
        label="Update position"
        request={{
          flowId: "updateLoanInterestRate",
          backLink: [
            `/loan/rate?id=${loan.branchId}:${loan.troveId}`,
            "Back to editing",
          ],
          successLink: ["/", "Go to the dashboard"],
          successMessage: "The position interest rate has been updated successfully.",

          leverageMode: loanMode === "multiply",
          prevLoan: { ...loan },
          loan: {
            ...loan,
            batchManager: interestRateMode === "delegate"
              ? interestRateDelegate
              : null,
            interestRate,
          },
        }}
      />
    </>
  );
}

function useUpdateRateCooldown(branchId: BranchId, troveId: TroveId) {
  const cooldown = useTroveRateUpdateCooldown(branchId, troveId);

  const remainingRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!cooldown.data) {
      return;
    }

    const update = () => {
      const remaining = cooldown.data(Date.now());

      if (remaining === 0) {
        if (active) {
          setActive(false);
        }
        return;
      }

      if (!active && remaining > 0) {
        setActive(true);
      }

      if (remaining > 0 && remainingRef.current) {
        remainingRef.current.innerHTML = formatRelativeTime(remaining);
      }
    };

    const timeout = setTimeout(update, 1000);
    update();

    return () => {
      clearTimeout(timeout);
    };
  }, [cooldown.data, active]);

  return {
    active,
    remainingRef,
    status: cooldown.status,
  };
}
