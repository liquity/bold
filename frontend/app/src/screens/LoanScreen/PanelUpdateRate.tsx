import type { DelegateMode } from "@/src/comps/InterestRateField/InterestRateField";
import type { PositionLoanCommitted } from "@/src/types";

import { ARROW_RIGHT } from "@/src/characters";
import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InterestRateField } from "@/src/comps/InterestRateField/InterestRateField";
import { UpdateBox } from "@/src/comps/UpdateBox/UpdateBox";
import content from "@/src/content";
import { useInputFieldValue } from "@/src/form-utils";
import { formatRisk } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import { getCollToken } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { infoTooltipProps } from "@/src/uikit-utils";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { Button, HFlex, InfoTooltip, StatusDot } from "@liquity2/uikit";
import * as dn from "dnum";
import { useState } from "react";

export function PanelUpdateRate({
  loan,
}: {
  loan: PositionLoanCommitted;
}) {
  const account = useAccount();
  const txFlow = useTransactionFlow();

  const collToken = getCollToken(loan.collIndex);

  if (!collToken) {
    return null;
  }

  const collPrice = usePrice(collToken.symbol);

  const deposit = useInputFieldValue((value) => `${dn.format(value)} ${collToken.symbol}`, {
    defaultValue: dn.toString(loan.deposit),
  });
  const debt = useInputFieldValue((value) => `${dn.format(value)} BOLD`, {
    defaultValue: dn.toString(loan.borrowed),
  });

  const [interestRate, setInterestRate] = useState(loan.interestRate);
  const [interestRateMode, setInterestRateMode] = useState<DelegateMode>(loan.batchManager ? "delegate" : "manual");
  const [interestRateDelegate, setInterestRateDelegate] = useState(loan.batchManager);

  const loanDetails = getLoanDetails(
    loan.deposit,
    loan.borrowed,
    loan.interestRate,
    collToken.collateralRatio,
    collPrice,
  );

  const newLoanDetails = getLoanDetails(
    deposit.isEmpty ? null : deposit.parsed,
    debt.isEmpty ? null : debt.parsed,
    interestRate,
    collToken.collateralRatio,
    collPrice,
  );

  const boldInterestPerYear = interestRate
    && debt.parsed
    && dn.mul(debt.parsed, interestRate);

  const boldInterestPerYearPrev = loan.interestRate
    && loan.borrowed
    && dn.mul(loan.borrowed, loan.interestRate);

  const allowSubmit = account.isConnected
    && deposit.parsed
    && dn.gt(deposit.parsed, 0)
    && debt.parsed
    && dn.gt(debt.parsed, 0)
    && interestRate
    && dn.gt(interestRate, 0);

  return (
    <>
      <Field
        // “Interest rate”
        field={
          <InterestRateField
            collIndex={loan.collIndex}
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
              before: <Amount value={boldInterestPerYearPrev} suffix="BOLD" />,
              after: <Amount value={boldInterestPerYear} suffix="BOLD" />,
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
                  `/loan/rate?id=${loan.collIndex}:${loan.troveId}`,
                  "Back to editing",
                ],
                successLink: ["/", "Go to the dashboard"],
                successMessage: "The position interest rate has been updated successfully.",

                prevLoan: { ...loan },
                loan: {
                  ...loan,
                  batchManager: interestRateMode === "delegate" ? interestRateDelegate : null,
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
