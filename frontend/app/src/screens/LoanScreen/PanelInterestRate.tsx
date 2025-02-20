import type { DelegateMode } from "@/src/comps/InterestRateField/InterestRateField";
import type { BranchId, PositionLoanCommitted, TroveId } from "@/src/types";

import { ARROW_RIGHT, NBSP } from "@/src/characters";
import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InterestRateField } from "@/src/comps/InterestRateField/InterestRateField";
import { UpdateBox } from "@/src/comps/UpdateBox/UpdateBox";
import content from "@/src/content";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum, formatRelativeTime } from "@/src/formatting";
import { formatRisk } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import { getBranch, getCollToken, useTroveRateUpdateCooldown } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { infoTooltipProps, riskLevelToStatusMode } from "@/src/uikit-utils";
import { useAccount } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { addressesEqual, Button, HFlex, IconSuggestion, InfoTooltip, StatusDot } from "@liquity2/uikit";
import * as dn from "dnum";
import { useEffect, useRef, useState } from "react";

export function PanelInterestRate({
  loan,
}: {
  loan: PositionLoanCommitted;
}) {
  const account = useAccount();
  const txFlow = useTransactionFlow();

  const collToken = getCollToken(loan.branchId);
  const collPrice = usePrice(collToken.symbol);

  const deposit = useInputFieldValue((value) => `${fmtnum(value, "full")} ${collToken.symbol}`, {
    defaultValue: dn.toString(loan.deposit),
  });
  const debt = useInputFieldValue((value) => `${fmtnum(value, "full")} BOLD`, {
    defaultValue: dn.toString(loan.borrowed),
  });

  const { strategies } = getBranch(loan.branchId);

  const { batchManager } = loan;
  const isIcpDelegated = batchManager && strategies.some((s) => addressesEqual(s.address, batchManager));

  const [interestRate, setInterestRate] = useState(loan.interestRate);
  const [interestRateMode, setInterestRateMode] = useState<DelegateMode>(
    isIcpDelegated
      ? "strategy"
      : loan.batchManager
      ? "delegate"
      : "manual",
  );
  const [interestRateDelegate, setInterestRateDelegate] = useState(
    loan.batchManager,
  );

  const updateRateCooldown = useUpdateRateCooldown(loan.branchId, loan.troveId);

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

  const boldInterestPerYear = interestRate
    && debt.parsed
    && dn.mul(debt.parsed, interestRate);

  const boldInterestPerYearPrev = loan.interestRate
    && loan.borrowed
    && dn.mul(loan.borrowed, loan.interestRate);

  const allowSubmit = Boolean(
    account.address && addressesEqual(
      loan.borrower,
      account.address,
    ),
  )
    && deposit.parsed && dn.gt(deposit.parsed, 0)
    && debt.parsed && dn.gt(debt.parsed, 0)
    && interestRate && dn.gt(interestRate, 0)
    && (
      !dn.eq(interestRate, loan.interestRate)
      || loan.batchManager !== interestRateDelegate
    );

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
          />
        }
        footer={{
          start: (
            <Field.FooterInfo
              label={updateRateCooldown.status === "success" && (
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
                  {updateRateCooldown.active
                    ? (
                      <>
                        Adjust without fee
                        <div ref={updateRateCooldown.remainingRef} />
                      </>
                    )
                    : <>No fee for rate adjustment</>}
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
                </span>
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
              before: loanDetails.redemptionRisk && (
                <>
                  <StatusDot mode={riskLevelToStatusMode(loanDetails.redemptionRisk)} />
                  {formatRisk(loanDetails.redemptionRisk)}
                </>
              ),
              after: newLoanDetails.redemptionRisk && (
                <>
                  <StatusDot mode={riskLevelToStatusMode(newLoanDetails.redemptionRisk)} />
                  {formatRisk(newLoanDetails.redemptionRisk)}
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
                flowId: "updateLoanInterestRate",
                backLink: [
                  `/loan/rate?id=${loan.branchId}:${loan.troveId}`,
                  "Back to editing",
                ],
                successLink: ["/", "Go to the dashboard"],
                successMessage: "The position interest rate has been updated successfully.",

                prevLoan: { ...loan },
                loan: {
                  ...loan,
                  batchManager: interestRateMode === "delegate" || interestRateMode === "strategy"
                    ? interestRateDelegate
                    : null,
                  interestRate,
                },
              });
            }
          }}
        />
      </div>
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
