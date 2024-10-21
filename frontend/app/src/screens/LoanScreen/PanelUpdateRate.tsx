import type { DelegateMode } from "@/src/comps/InterestRateField/InterestRateField";
import type { PositionLoan } from "@/src/types";

import { ARROW_RIGHT } from "@/src/characters";
import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InterestRateField } from "@/src/comps/InterestRateField/InterestRateField";
import { UpdateBox } from "@/src/comps/UpdateBox/UpdateBox";
import { MAX_ANNUAL_INTEREST_RATE, MIN_ANNUAL_INTEREST_RATE } from "@/src/constants";
import content from "@/src/content";
import { dnum18 } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { formatRisk } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import { getPrefixedTroveId } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { infoTooltipProps } from "@/src/uikit-utils";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { Button, HFlex, InfoTooltip, StatusDot, TOKENS_BY_SYMBOL } from "@liquity2/uikit";
import * as dn from "dnum";
import { useState } from "react";
import { maxUint256 } from "viem";

export function PanelUpdateRate({
  loan,
}: {
  loan: PositionLoan;
}) {
  const account = useAccount();
  const txFlow = useTransactionFlow();

  const { collIndex } = loan;
  const collateral = TOKENS_BY_SYMBOL[loan.collateral];
  const collPrice = usePrice(collateral.symbol);

  const deposit = useInputFieldValue((value) => `${dn.format(value)} ${collateral.symbol}`, {
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
    collateral.collateralRatio,
    collPrice,
  );

  const newLoanDetails = getLoanDetails(
    deposit.isEmpty ? null : deposit.parsed,
    debt.isEmpty ? null : debt.parsed,
    interestRate,
    collateral.collateralRatio,
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
            collIndex={collIndex}
            debt={debt.parsed}
            delegate={interestRateDelegate}
            interestRate={interestRate}
            mode={interestRateMode}
            onChange={setInterestRate}
            onDelegateChange={setInterestRateDelegate}
            onModeChange={setInterestRateMode}
          />
        }
        footer={[
          [
            null,
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
            />,
          ],
        ]}
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
                  `/loan/rate?id=${collIndex}:${loan.troveId}`,
                  "Back to editing",
                ],
                successLink: ["/", "Go to the dashboard"],
                successMessage: "The position interest rate has been updated successfully.",

                collIndex,
                owner: account.address,
                prefixedTroveId: getPrefixedTroveId(collIndex, loan.troveId),
                upperHint: dnum18(0),
                lowerHint: dnum18(0),
                annualInterestRate: interestRate,
                maxUpfrontFee: dnum18(maxUint256),
                interestRateDelegate: interestRateMode === "manual" || !interestRateDelegate ? null : [
                  interestRateDelegate,
                  MIN_ANNUAL_INTEREST_RATE,
                  MAX_ANNUAL_INTEREST_RATE,
                ],
              });
            }
          }}
        />
      </div>
    </>
  );
}
