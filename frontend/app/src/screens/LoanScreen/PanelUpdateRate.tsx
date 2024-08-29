import type { PositionLoan } from "@/src/types";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InfoBox } from "@/src/comps/InfoBox/InfoBox";
import { ValueUpdate } from "@/src/comps/ValueUpdate/ValueUpdate";
import { INTEREST_RATE_INCREMENT, INTEREST_RATE_MAX, INTEREST_RATE_MIN } from "@/src/constants";
import content from "@/src/content";
import { getDebtBeforeRateBucketIndex, INTEREST_CHART } from "@/src/demo-mode";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum, formatRisk } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import { useAccount } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { infoTooltipProps, riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  Button,
  HFlex,
  InfoTooltip,
  InputField,
  lerp,
  norm,
  Slider,
  StatusDot,
  TOKENS_BY_SYMBOL,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useRouter } from "next/navigation";

export function PanelUpdateRate({ loan }: { loan: PositionLoan }) {
  const router = useRouter();
  const account = useAccount();

  const collateral = TOKENS_BY_SYMBOL[loan.collateral];
  const collPrice = usePrice(collateral.symbol);

  const deposit = useInputFieldValue((value) => `${dn.format(value)} ${collateral.symbol}`, {
    defaultValue: dn.toString(loan.deposit),
  });
  const debt = useInputFieldValue((value) => `${dn.format(value)} BOLD`, {
    defaultValue: dn.toString(loan.borrowed),
  });
  const interestRate = useInputFieldValue((value) => `${dn.format(value)} %`, {
    defaultValue: dn.toString(dn.mul(loan.interestRate, 100)),
  });

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
    interestRate.parsed && dn.div(interestRate.parsed, 100),
    collateral.collateralRatio,
    collPrice,
  );

  const boldInterestPerYear = interestRate.parsed
    && debt.parsed
    && dn.mul(debt.parsed, dn.div(interestRate.parsed, 100));

  const boldRedeemableInFront = dn.format(
    getDebtBeforeRateBucketIndex(
      interestRate.parsed
        ? Math.round((dn.toNumber(interestRate.parsed) - INTEREST_RATE_MIN) / INTEREST_RATE_INCREMENT)
        : 0,
    ),
    { compact: true },
  );

  const allowSubmit = account.isConnected
    && deposit.parsed
    && dn.gt(deposit.parsed, 0)
    && debt.parsed
    && dn.gt(debt.parsed, 0)
    && interestRate.parsed
    && dn.gt(interestRate.parsed, 0);

  return (
    <>
      <Field
        // “Interest rate”
        field={
          <InputField
            contextual={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 300,
                }}
              >
                <Slider
                  gradient={[1 / 3, 2 / 3]}
                  chart={INTEREST_CHART}
                  onChange={(value) => {
                    interestRate.setValue(
                      String(Math.round(lerp(INTEREST_RATE_MIN, INTEREST_RATE_MAX, value) * 10) / 10),
                    );
                  }}
                  value={norm(
                    interestRate.parsed ? dn.toNumber(interestRate.parsed) : 0,
                    INTEREST_RATE_MIN,
                    INTEREST_RATE_MAX,
                  )}
                />
              </div>
            }
            label={content.borrowScreen.interestRateField.label}
            placeholder="0.00"
            secondary={{
              start: (
                <HFlex gap={4}>
                  <div>
                    {boldInterestPerYear
                      ? fmtnum(boldInterestPerYear, 2)
                      : "−"} BOLD / year
                  </div>
                  <InfoTooltip {...infoTooltipProps(content.borrowScreen.infoTooltips.interestRateBoldPerYear)} />
                </HFlex>
              ),
              end: (
                <span>
                  <span>{"Before you "}</span>
                  <span
                    className={css({
                      color: "content",
                    })}
                  >
                    <span
                      style={{
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {boldRedeemableInFront}
                    </span>
                    <span>{" BOLD to redeem"}</span>
                  </span>
                </span>
              ),
            }}
            {...interestRate.inputFieldProps}
            valueUnfocused={(!interestRate.isEmpty && interestRate.parsed)
              ? (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {fmtnum(interestRate.parsed, "1z")}
                  </span>
                  <span
                    style={{
                      color: "#878AA4",
                      fontSize: 24,
                    }}
                  >
                    % per year
                  </span>
                </span>
              )
              : null}
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
            router.push("/transactions/update-loan");
          }}
        />
      </div>
    </>
  );
}
