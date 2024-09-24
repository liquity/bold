import type { PositionLoan } from "@/src/types";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InfoBox } from "@/src/comps/InfoBox/InfoBox";
import { InterestRateField } from "@/src/comps/InterestRateField/InterestRateField";
import { ValueUpdate } from "@/src/comps/ValueUpdate/ValueUpdate";
import { dnum18 } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum, formatRisk } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import { getPrefixedTroveId } from "@/src/liquity-utils";
import { useAccount } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { Button, HFlex, InfoTooltip, StatusDot, TOKENS_BY_SYMBOL } from "@liquity2/uikit";
import * as dn from "dnum";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { maxUint256 } from "viem";

export function PanelUpdateRate({ loan }: { loan: PositionLoan }) {
  const router = useRouter();
  const account = useAccount();
  const txFlow = useTransactionFlow();

  const collateral = TOKENS_BY_SYMBOL[loan.collateral];
  const collPrice = usePrice(collateral.symbol);

  const deposit = useInputFieldValue((value) => `${dn.format(value)} ${collateral.symbol}`, {
    defaultValue: dn.toString(loan.deposit),
  });
  const debt = useInputFieldValue((value) => `${dn.format(value)} BOLD`, {
    defaultValue: dn.toString(loan.borrowed),
  });

  const [interestRate, setInterestRate] = useState(loan.interestRate);

  const loanDetails = getLoanDetails(
    loan.deposit,
    loan.borrowed,
    dn.div(loan.interestRate, 100),
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
            debt={debt.parsed}
            interestRate={interestRate}
            onChange={setInterestRate}
          />
        }
      />

      <div
        className={css({
          padding: "8px 0",
        })}
      >
        <InfoBox>
          <HFlex justifyContent="space-between" gap={16}>
            <div>Redemption risk</div>
            <ValueUpdate
              before={loanDetails.redemptionRisk && (
                <HFlex gap={4} justifyContent="flex-start">
                  <StatusDot mode={riskLevelToStatusMode(loanDetails.redemptionRisk)} />
                  {formatRisk(loanDetails.redemptionRisk)}
                </HFlex>
              )}
              after={newLoanDetails.redemptionRisk && (
                <HFlex gap={4} justifyContent="flex-start">
                  <StatusDot mode={riskLevelToStatusMode(newLoanDetails.redemptionRisk)} />
                  {formatRisk(newLoanDetails.redemptionRisk)}
                </HFlex>
              )}
            />
          </HFlex>
          <HFlex justifyContent="space-between" gap={16}>
            <HFlex gap={4}>
              <div>Interest rate / day</div>
              <InfoTooltip heading="Interest rate / day" />
            </HFlex>
            {boldInterestPerYear && (
              <HFlex
                gap={8}
                className={css({
                  fontVariantNumeric: "tabular-nums",
                })}
              >
                ~{fmtnum(dn.div(boldInterestPerYear, 365))} BOLD
              </HFlex>
            )}
          </HFlex>
          <HFlex
            justifyContent="space-between"
            gap={16}
            className={css({
              marginTop: -12,
              fontSize: 14,
              color: "contentAlt",
            })}
          >
            <div>Annual interest rate is charged daily on the debt</div>
            <div>per day</div>
          </HFlex>
        </InfoBox>
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

                collIndex: loan.collIndex,
                interestRate,
                lowerHint: dnum18(0),
                maxUpfrontFee: dnum18(maxUint256),
                owner: account.address,
                prefixedTroveId: getPrefixedTroveId(loan.collIndex, loan.troveId),
                upperHint: dnum18(0),
              });
              router.push("/transactions");
            }
          }}
        />
      </div>
    </>
  );
}
