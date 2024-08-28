import type { PositionLoan } from "@/src/types";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InfoBox } from "@/src/comps/InfoBox/InfoBox";
import { InputTokenBadge } from "@/src/comps/InputTokenBadge/InputTokenBadge";
import { LeverageField, useLeverageField } from "@/src/comps/LeverageField/LeverageField";
import { ValueUpdate } from "@/src/comps/ValueUpdate/ValueUpdate";
import { WarningBox } from "@/src/comps/WarningBox/WarningBox";
import { ETH_MAX_RESERVE } from "@/src/constants";
import { ACCOUNT_BALANCES } from "@/src/demo-mode";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum, formatRisk } from "@/src/formatting";
import { getLiquidationPriceFromLeverage, getLoanDetails } from "@/src/liquity-math";
import { useAccount } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  Button,
  Checkbox,
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
import { useEffect, useRef, useState } from "react";

type RelativeFieldMode = "add" | "remove";

export function PanelUpdateLeveragePosition({ loan }: { loan: PositionLoan }) {
  const router = useRouter();
  const account = useAccount();

  const collateral = TOKENS_BY_SYMBOL[loan.collateral];
  const collPrice = usePrice(collateral.symbol);

  // loan details before the update
  const initialLoanDetails = getLoanDetails(
    loan.deposit,
    loan.borrowed,
    loan.interestRate,
    collateral.collateralRatio,
    collPrice,
  );

  // deposit change
  const [depositMode, setDepositMode] = useState<RelativeFieldMode>("add");
  const depositChange = useInputFieldValue((value) => dn.format(value));
  const [userLeverageFactor, setUserLeverageFactor] = useState(initialLoanDetails.leverageFactor ?? 1);

  const newDepositPreLeverage = depositChange.parsed
    ? (depositMode === "remove"
      ? dn.sub(initialLoanDetails.depositPreLeverage ?? dn.from(0, 18), depositChange.parsed)
      : dn.add(initialLoanDetails.depositPreLeverage ?? dn.from(0, 18), depositChange.parsed))
    : initialLoanDetails.depositPreLeverage;

  const newDeposit = dn.mul(newDepositPreLeverage ?? dn.from(0, 18), userLeverageFactor);

  const totalPositionValue = dn.mul(newDeposit, collPrice ?? dn.from(0, 18));

  const newDebt = dn.sub(
    totalPositionValue,
    dn.mul(newDepositPreLeverage ?? dn.from(0, 18), collPrice ?? dn.from(0, 18)),
  );

  const newLoanDetails = getLoanDetails(
    newDeposit,
    newDebt,
    initialLoanDetails.interestRate,
    collateral.collateralRatio,
    collPrice,
  );

  const liquidationPrice = getLiquidationPriceFromLeverage(
    userLeverageFactor,
    collPrice ?? dn.from(0, 18),
    collateral.collateralRatio,
  );

  const newDepositUsd = collPrice && dn.mul(newDeposit, collPrice);

  const ltv = newDeposit && newLoanDetails.debt && newDepositUsd && dn.gt(newDepositUsd, 0)
    ? dn.div(newLoanDetails.debt, dn.mul(newDeposit, newDepositUsd))
    : null;

  // leverage factor
  const leverageField = useLeverageField({
    collPrice: collPrice ?? dn.from(0, 18),
    collToken: collateral,
    depositPreLeverage: newDepositPreLeverage,
    maxLtvAllowedRatio: 1, // allow up to the max. LTV
  });

  useEffect(() => {
    if (leverageField.leverageFactor !== userLeverageFactor) {
      setUserLeverageFactor(leverageField.leverageFactor);
    }
  }, [leverageField.leverageFactor]);

  const initialLeverageFactorSet = useRef(false);
  useEffect(() => {
    if (initialLoanDetails.leverageFactor && !initialLeverageFactorSet.current) {
      leverageField.updateLeverageFactor(initialLoanDetails.leverageFactor);
      initialLeverageFactorSet.current = true;
    }
  }, [leverageField.updateLeverageFactor, initialLoanDetails.leverageFactor]);

  const depositMax = depositMode === "remove"
    ? initialLoanDetails.depositPreLeverage
    : dn.sub(ACCOUNT_BALANCES[collateral.symbol], ETH_MAX_RESERVE);

  const [agreeToLiquidationRisk, setAgreeToLiquidationRisk] = useState(false);

  const showAgreeToLiquidationRisk = ltv
    ? dn.gt(ltv, newLoanDetails.maxLtvAllowed)
    : false;

  const allowSubmit = account.isConnected && (
    !showAgreeToLiquidationRisk || agreeToLiquidationRisk
  ) && (
    !dn.eq(
      initialLoanDetails.deposit ?? dn.from(0, 18),
      newLoanDetails.deposit ?? dn.from(0, 18),
    ) || (
      initialLoanDetails.leverageFactor !== newLoanDetails.leverageFactor
    )
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
                  ? "Decrease your deposit"
                  : "Increase your deposit",
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
                start: collPrice && (
                  depositChange.parsed
                    ? "$" + fmtnum(dn.mul(depositChange.parsed, collPrice))
                    : "$0.00"
                ),
                end: depositMax && (
                  <TextButton
                    label={`Max ${fmtnum(depositMax)} ${collateral.name}`}
                    onClick={() => {
                      depositChange.setValue(dn.toString(depositMax));
                    }}
                  />
                ),
              }}
            />
          }
          footer={[[
            <Field.FooterInfo label="Deposit after" />,
            initialLoanDetails.depositPreLeverage && newDepositPreLeverage && (
              <Field.FooterInfo
                value={
                  <HFlex alignItems="center" gap={8}>
                    <ValueUpdate
                      before={
                        <div
                          title={`${fmtnum(initialLoanDetails.depositPreLeverage, "full")} ${collateral.name}`}
                        >
                          {fmtnum(initialLoanDetails.depositPreLeverage)}
                        </div>
                      }
                      after={
                        <HFlex alignItems="center" gap={8}>
                          <div
                            title={`${fmtnum(newDepositPreLeverage, "full")} ${collateral.name}`}
                          >
                            {fmtnum(newDepositPreLeverage)} {collateral.name}
                          </div>
                          <InfoTooltip heading="Collateral update" />
                        </HFlex>
                      }
                      fontSize={14}
                    />
                  </HFlex>
                }
              />
            ),
          ]]}
        />

        <Field
          field={<LeverageField {...leverageField} />}
          footer={[
            [
              <Field.FooterInfo label="ETH liquidation price" />,
              <ValueUpdate
                fontSize={14}
                before={initialLoanDetails.liquidationPrice && (
                  `$${fmtnum(initialLoanDetails.liquidationPrice)}`
                )}
                after={liquidationPrice && (
                  `$${fmtnum(liquidationPrice)}`
                )}
              />,
            ],
            [
              <Field.FooterInfo label="ETH exposure" />,
              <ValueUpdate
                fontSize={14}
                before={initialLoanDetails.depositPreLeverage && (
                  <div
                    title={`${fmtnum(initialLoanDetails.deposit, "full")} ${collateral.name}`}
                  >
                    {fmtnum(initialLoanDetails.deposit)} {collateral.name}
                  </div>
                )}
                after={newDepositPreLeverage && (
                  <div title={`${fmtnum(newLoanDetails.deposit, "full")} ${collateral.name}`}>
                    {fmtnum(newLoanDetails.deposit)} {collateral.name}
                  </div>
                )}
              />,
            ],
            [
              <Field.FooterInfo label="Leverage" />,
              <ValueUpdate
                fontSize={14}
                before={<>{fmtnum(initialLoanDetails.leverageFactor, "1z")}x</>}
                after={newLoanDetails.isUnderwater
                  ? "N/A"
                  : <>{fmtnum(newLoanDetails.leverageFactor, "1z")}x</>}
              />,
            ],
            [
              <Field.FooterInfo label="Implied total debt" />,
              <ValueUpdate
                fontSize={14}
                before={initialLoanDetails.debt && (
                  `${fmtnum(initialLoanDetails.debt)} BOLD`
                )}
                after={newLoanDetails.debt && (
                  `${fmtnum(newLoanDetails.debt)} BOLD`
                )}
              />,
            ],
          ]}
        />

        <VFlex
          gap={16}
          className={css({
            paddingTop: 8,
            paddingBottom: 32,
          })}
        >
          <InfoBox gap={8}>
            <HFlex justifyContent="space-between" gap={16}>
              <div>Liquidation risk</div>
              <ValueUpdate
                before={initialLoanDetails.liquidationRisk && (
                  <HFlex gap={4} justifyContent="flex-start">
                    <StatusDot mode={riskLevelToStatusMode(initialLoanDetails.liquidationRisk)} />
                    {formatRisk(initialLoanDetails.liquidationRisk)}
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
            <HFlex
              justifyContent="space-between"
              gap={16}
              className={css({
                fontSize: 14,
              })}
            >
              <div
                className={css({
                  color: "contentAlt",
                })}
              >
                <abbr title="Loan-to-value ratio">LTV</abbr>
              </div>
              <ValueUpdate
                fontSize={14}
                before={initialLoanDetails.ltv && `${fmtnum(dn.mul(initialLoanDetails.ltv, 100))}%`}
                after={
                  <span
                    className={css({
                      "--color-negative": "token(colors.negative)",
                    })}
                    style={{
                      color: newLoanDetails.ltv && dn.gt(newLoanDetails.ltv, newLoanDetails.maxLtvAllowed)
                        ? "var(--color-negative)"
                        : "inherit",
                    }}
                  >
                    {newLoanDetails.ltv && `${fmtnum(dn.mul(newLoanDetails.ltv, 100))}%`}
                  </span>
                }
              />
            </HFlex>
          </InfoBox>

          {newLoanDetails.isUnderwater
            ? (
              <WarningBox>
                <div>
                  Your position is currently underwater. You need to add at least{" "}
                  {fmtnum(newLoanDetails.requiredCollateralToRecover)}
                  {" "}
                  {collateral.name} to bring it back above water.
                </div>
              </WarningBox>
            )
            : showAgreeToLiquidationRisk
            ? (
              <WarningBox>
                <div>
                  The maximum LTV for the position is{"  "}
                  {fmtnum(dn.mul(newLoanDetails.maxLtv, 100))}%. Your updated position may be liquidated immediately.
                </div>
                <label
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                  })}
                >
                  <Checkbox
                    checked={agreeToLiquidationRisk}
                    onChange={(checked) => {
                      setAgreeToLiquidationRisk(checked);
                    }}
                  />
                  I understand. Let’s continue.
                </label>
              </WarningBox>
            )
            : null}
        </VFlex>
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
