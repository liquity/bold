import type { PositionLoan } from "@/src/types";

import { INFINITY } from "@/src/characters";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InfoBox } from "@/src/comps/InfoBox/InfoBox";
import { InputTokenBadge } from "@/src/comps/InputTokenBadge/InputTokenBadge";
import { LeverageField, useLeverageField } from "@/src/comps/LeverageField/LeverageField";
import { Value } from "@/src/comps/Value/Value";
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
  const [depositMode, setDepositMode] = useState<"add" | "remove">("add");
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
    ? (
      initialLoanDetails.depositPreLeverage && dn.gt(initialLoanDetails.depositPreLeverage, 0)
        ? initialLoanDetails.depositPreLeverage
        : null
    )
    : dn.sub(ACCOUNT_BALANCES[collateral.symbol], ETH_MAX_RESERVE);

  const [agreeToLiquidationRisk, setAgreeToLiquidationRisk] = useState(false);

  useEffect(() => {
    setAgreeToLiquidationRisk(false);
  }, [newLoanDetails.status]);

  const allowSubmit = account.isConnected
      && newLoanDetails.status !== "at-risk" || agreeToLiquidationRisk
      && newLoanDetails.status !== "underwater" && newLoanDetails.status !== "liquidatable"
      && (
        // either the deposit or the leverage factor has changed
        !dn.eq(
          initialLoanDetails.deposit ?? dn.from(0, 18),
          newLoanDetails.deposit ?? dn.from(0, 18),
        ) || (
          initialLoanDetails.leverageFactor !== newLoanDetails.leverageFactor
        )
      )
      && false;

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
                          } ${collateral.name}`}
                        >
                          {fmtnum(initialLoanDetails.depositPreLeverage)}
                        </Value>
                      }
                      after={
                        <HFlex alignItems="center" gap={8}>
                          <Value
                            negative={newLoanDetails.deposit && dn.lt(
                              newDepositPreLeverage,
                              0,
                            )}
                            title={`${fmtnum(newDepositPreLeverage, "full")} ${collateral.name}`}
                          >
                            {fmtnum(newDepositPreLeverage)} {collateral.name}
                          </Value>
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
                after={liquidationPrice && newLoanDetails.deposit && dn.gt(newLoanDetails.deposit, 0)
                  ? `$${fmtnum(liquidationPrice)}`
                  : "N/A"}
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
                  <Value
                    negative={newLoanDetails.deposit && dn.lt(newLoanDetails.deposit, 0)}
                    title={`${fmtnum(newLoanDetails.deposit, "full")} ${collateral.name}`}
                  >
                    {fmtnum(newLoanDetails.deposit)} {collateral.name}
                  </Value>
                )}
              />,
            ],
            [
              <Field.FooterInfo label="Leverage" />,
              <ValueUpdate
                fontSize={14}
                before={
                  <Value negative={initialLoanDetails.status === "underwater"}>
                    {initialLoanDetails.status === "underwater" ? INFINITY : (
                      `${fmtnum(initialLoanDetails.leverageFactor, 4)}x`
                    )}
                  </Value>
                }
                after={
                  <>
                    {fmtnum(userLeverageFactor, "1z")}x
                  </>
                }
              />,
            ],
            [
              <Field.FooterInfo label="Implied total debt" />,
              <ValueUpdate
                fontSize={14}
                before={initialLoanDetails.debt && (
                  `${fmtnum(initialLoanDetails.debt)} BOLD`
                )}
                after={newLoanDetails.debt && dn.gt(newLoanDetails.debt, 0)
                  ? (
                    `${fmtnum(newLoanDetails.debt)} BOLD`
                  )
                  : (
                    `N/A`
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
                before={initialLoanDetails.ltv && (
                  <Value
                    negative={dn.gt(
                      initialLoanDetails.ltv,
                      initialLoanDetails.maxLtvAllowed,
                    )}
                  >
                    {fmtnum(dn.mul(initialLoanDetails.ltv, 100))}%
                  </Value>
                )}
                after={
                  <Value
                    negative={(
                      newLoanDetails.status === "underwater" || newLoanDetails.status === "liquidatable"
                    ) || (
                      newLoanDetails.ltv && dn.gt(
                        newLoanDetails.ltv,
                        newLoanDetails.maxLtvAllowed,
                      )
                    )}
                  >
                    {newLoanDetails.status === "underwater" || newLoanDetails.status === "liquidatable"
                      ? "N/A"
                      : newLoanDetails.ltv && `${fmtnum(dn.mul(newLoanDetails.ltv, 100))}%`}
                  </Value>
                }
              />
            </HFlex>
          </InfoBox>

          {newLoanDetails.status === "underwater" || newLoanDetails.status === "liquidatable"
            ? (
              <WarningBox>
                <div>
                  Your position is above the maximum <abbr title="Loan-to-value ratio">LTV</abbr> of {fmtnum(
                    newLoanDetails.maxLtv && dn.mul(newLoanDetails.maxLtv, 100),
                  )}%. You need to add at least{" "}
                  {fmtnum(newLoanDetails.depositToZero && dn.mul(newLoanDetails.depositToZero, -1), 4)}
                  {" "}
                  {collateral.name} to prevent liquidation.
                </div>
              </WarningBox>
            )
            : newLoanDetails.status === "at-risk"
            ? (
              <WarningBox>
                <div>
                  The maximum <abbr title="Loan-to-value ratio">LTV</abbr> for the position is{" "}
                  {fmtnum(dn.mul(newLoanDetails.maxLtv, 100))}%. Your updated position is close and is at risk of being
                  liquidated.
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
