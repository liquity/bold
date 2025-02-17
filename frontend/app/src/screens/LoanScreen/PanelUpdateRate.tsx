import type { DelegateMode } from "@/src/comps/InterestRateField/InterestRateField";
import type { BranchId, PositionLoanCommitted, TroveId } from "@/src/types";

import { ARROW_RIGHT } from "@/src/characters";
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
import { useAccount } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { infoTooltipProps, riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { addressesEqual, Button, HFlex, InfoTooltip, StatusDot } from "@liquity2/uikit";
import * as dn from "dnum";
import { useEffect, useRef, useState } from "react";

export function PanelUpdateRate({
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

  const udpateRateCooldown = useUpdateRateCooldown(loan.branchId, loan.troveId);

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
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: "8px 0",
        })}
      >
        <div
          className={css({
            flexDirection: "column",
            gap: 16,
            padding: 16,
            fontSize: 16,
            color: "content",
            background: "infoSurface",
            border: "1px solid token(colors.infoSurfaceBorder)",
            borderRadius: 8,
          })}
          style={{
            display: udpateRateCooldown.showCooldown ? "flex" : "none",
          }}
        >
          <HFlex justifyContent="space-between">
            <HFlex gap={8}>
              Rate update fee reset
              <InfoTooltip
                content={{
                  heading: "Rate update fee",
                  body: (
                    <div>
                      {`A fee corresponding to 7 days of average interest is
                        charged on any rate adjustments that happen less than 7
                        days after the last adjustment. This is the remaining
                        time until the cooldown expires and the rate can be
                        updated without a fee.`}
                    </div>
                  ),
                  footerLink: {
                    href: "https://docs.liquity.org/v2-faq/borrowing-and-liquidations#can-i-adjust-the-rate",
                    label: "Learn more",
                  },
                }}
              />
            </HFlex>
            <div ref={udpateRateCooldown.cooldownRemainingRef} />
          </HFlex>
        </div>
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

  const cooldownRemainingRef = useRef<HTMLDivElement>(null);
  const [showCooldown, setShowCooldown] = useState(false);

  useEffect(() => {
    if (!cooldown.data) {
      return;
    }

    const update = () => {
      const remaining = cooldown.data(Date.now());

      if (remaining === 0) {
        if (showCooldown) {
          setShowCooldown(false);
        }
        return;
      }

      if (!showCooldown && remaining > 0) {
        setShowCooldown(true);
      }

      if (remaining > 0 && cooldownRemainingRef.current) {
        cooldownRemainingRef.current.innerHTML = formatRelativeTime(remaining);
      }
    };

    const timeout = setTimeout(update, 1000);
    update();

    return () => {
      clearTimeout(timeout);
    };
  }, [cooldown.data, showCooldown]);

  return { showCooldown, cooldownRemainingRef };
}
