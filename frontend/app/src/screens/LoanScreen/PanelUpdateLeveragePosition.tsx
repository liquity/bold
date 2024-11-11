import type { PositionLoanCommitted } from "@/src/types";

import { INFINITY } from "@/src/characters";
import { Amount } from "@/src/comps/Amount/Amount";
import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { InputTokenBadge } from "@/src/comps/InputTokenBadge/InputTokenBadge";
import { LeverageField, useLeverageField } from "@/src/comps/LeverageField/LeverageField";
import { UpdateBox } from "@/src/comps/UpdateBox/UpdateBox";
import { Value } from "@/src/comps/Value/Value";
import { ValueUpdate } from "@/src/comps/ValueUpdate/ValueUpdate";
import { WarningBox } from "@/src/comps/WarningBox/WarningBox";
import { ETH_MAX_RESERVE } from "@/src/constants";
import { dnum18 } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum, formatRisk } from "@/src/formatting";
import { getLiquidationPriceFromLeverage, getLoanDetails } from "@/src/liquity-math";
import { getCollToken } from "@/src/liquity-utils";
import { useAccount, useBalance } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
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
  VFlex,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useEffect, useRef, useState } from "react";

export function PanelUpdateLeveragePosition({
  loan,
}: {
  loan: PositionLoanCommitted;
}) {
  const account = useAccount();
  const txFlow = useTransactionFlow();

  const collToken = getCollToken(loan.collIndex);

  if (!collToken) {
    throw new Error("collToken not found");
  }

  const collPrice = usePrice(collToken.symbol ?? null);

  // loan details before the update
  const initialLoanDetails = getLoanDetails(
    loan.deposit,
    loan.borrowed,
    loan.interestRate,
    collToken?.collateralRatio,
    collPrice,
  );

  // deposit change
  const [depositMode, setDepositMode] = useState<"add" | "remove">("add");
  const depositChange = useInputFieldValue((value) => dn.format(value));
  const [userLeverageFactor, setUserLeverageFactor] = useState(
    initialLoanDetails.leverageFactor ?? 1,
  );

  let newDepositPreLeverage = depositChange.parsed
    ? (
      depositMode === "remove"
        ? dn.sub(
          initialLoanDetails.depositPreLeverage ?? dnum18(0),
          depositChange.parsed,
        )
        : dn.add(
          initialLoanDetails.depositPreLeverage ?? dnum18(0),
          depositChange.parsed,
        )
    )
    : initialLoanDetails.depositPreLeverage;

  if (newDepositPreLeverage && dn.lt(newDepositPreLeverage, 0)) {
    newDepositPreLeverage = dnum18(0);
  }

  const newDeposit = dn.mul(
    newDepositPreLeverage ?? dnum18(0),
    userLeverageFactor,
  );

  const totalPositionValue = dn.mul(newDeposit, collPrice ?? dnum18(0));

  const newDebt = dn.sub(
    totalPositionValue,
    dn.mul(newDepositPreLeverage ?? dnum18(0), collPrice ?? dnum18(0)),
  );

  const newLoanDetails = getLoanDetails(
    newDeposit,
    newDebt,
    initialLoanDetails.interestRate,
    collToken.collateralRatio,
    collPrice,
  );

  const liquidationPrice = getLiquidationPriceFromLeverage(
    userLeverageFactor,
    collPrice ?? dnum18(0),
    collToken.collateralRatio,
  );

  // leverage factor
  const leverageField = useLeverageField({
    collPrice: collPrice ?? dnum18(0),
    collToken,
    depositPreLeverage: newDepositPreLeverage,
    maxLtvAllowedRatio: 1, // allow up to the max. LTV
  });

  const collBalance = useBalance(account.address, collToken.symbol);

  const collMax = depositMode === "remove" ? initialLoanDetails.depositPreLeverage : (
    collBalance.data
      ? dn.sub(collBalance.data, ETH_MAX_RESERVE)
      : dnum18(0)
  );

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

  const [agreeToLiquidationRisk, setAgreeToLiquidationRisk] = useState(false);

  useEffect(() => {
    setAgreeToLiquidationRisk(false);
  }, [newLoanDetails.status]);

  const allowSubmit = account.isConnected
    && (newLoanDetails.status !== "at-risk" || agreeToLiquidationRisk)
    && newLoanDetails.status !== "underwater"
    && newLoanDetails.status !== "liquidatable"
    && (
      // either the deposit or the leverage factor has changed
      !dn.eq(
        initialLoanDetails.deposit ?? dnum18(0),
        newLoanDetails.deposit ?? dnum18(0),
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
                  icon={<TokenIcon symbol={collToken.symbol} />}
                  label={collToken.name}
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
                start: collPrice && (
                  depositChange.parsed
                    ? "$" + fmtnum(dn.mul(depositChange.parsed, collPrice))
                    : "$0.00"
                ),
                end: (
                  <TextButton
                    label={`Max ${fmtnum(collMax, 2)} ${collToken.name}`}
                    onClick={() => {
                      if (collMax) {
                        depositChange.setValue(dn.toString(collMax));
                      }
                    }}
                  />
                ),
              }}
            />
          }
          footer={{
            start: <Field.FooterInfo label="Deposit after" />,
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
                        <HFlex alignItems="center" gap={8}>
                          <Value
                            negative={newLoanDetails.deposit && dn.lt(newDepositPreLeverage, 0)}
                            title={`${fmtnum(newDepositPreLeverage, "full")} ${collToken.name}`}
                          >
                            {fmtnum(newDepositPreLeverage)} {collToken.name}
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
          }}
        />

        <Field
          field={<LeverageField {...leverageField} />}
          footer={[
            {
              start: <Field.FooterInfo label="ETH liquidation price" />,
              end: (
                <ValueUpdate
                  fontSize={14}
                  before={initialLoanDetails.liquidationPrice && (
                    `$${fmtnum(initialLoanDetails.liquidationPrice)}`
                  )}
                  after={liquidationPrice && newLoanDetails.deposit && dn.gt(newLoanDetails.deposit, 0)
                    ? `$${fmtnum(liquidationPrice)}`
                    : "N/A"}
                />
              ),
            },
            {
              start: <Field.FooterInfo label="ETH exposure" />,
              end: (
                <ValueUpdate
                  fontSize={14}
                  before={initialLoanDetails.depositPreLeverage && (
                    <div
                      title={`${fmtnum(initialLoanDetails.deposit, "full")} ${collToken.name}`}
                    >
                      {fmtnum(initialLoanDetails.deposit)} {collToken.name}
                    </div>
                  )}
                  after={newDepositPreLeverage && (
                    <Value
                      negative={newLoanDetails.deposit && dn.lt(newLoanDetails.deposit, 0)}
                      title={`${fmtnum(newLoanDetails.deposit, "full")} ${collToken.name}`}
                    >
                      {fmtnum(newLoanDetails.deposit)} {collToken.name}
                    </Value>
                  )}
                />
              ),
            },
            {
              start: <Field.FooterInfo label="Leverage" />,
              end: (
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
                />
              ),
            },
            {
              start: <Field.FooterInfo label="Implied total debt" />,
              end: (
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
                />
              ),
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
                before: initialLoanDetails.liquidationRisk && (
                  <>
                    <StatusDot
                      mode={riskLevelToStatusMode(
                        initialLoanDetails.liquidationRisk,
                      )}
                    />
                    {formatRisk(initialLoanDetails.liquidationRisk)}
                  </>
                ),
                after: newLoanDetails.liquidationRisk && (
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
                before: initialLoanDetails.ltv && (
                  <Value
                    negative={dn.gt(
                      initialLoanDetails.ltv,
                      initialLoanDetails.maxLtvAllowed,
                    )}
                  >
                    <Amount value={initialLoanDetails.ltv} percentage />
                  </Value>
                ),
                after: (
                  <Value
                    negative={(
                      newLoanDetails.status === "underwater"
                      || newLoanDetails.status === "liquidatable"
                    ) || (
                      newLoanDetails.ltv && dn.gt(
                        newLoanDetails.ltv,
                        newLoanDetails.maxLtvAllowed,
                      )
                    )}
                  >
                    {newLoanDetails.status === "underwater"
                        || newLoanDetails.status === "liquidatable"
                      ? "N/A"
                      : <Amount value={newLoanDetails.ltv} percentage />}
                  </Value>
                ),
              },
            ]}
          />

          {newLoanDetails.status === "underwater" || newLoanDetails.status === "liquidatable"
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
            if (account.address) {
              txFlow.start({
                flowId: "updateLeveragePosition",
                backLink: [
                  `/loan?id=${loan.collIndex}:${loan.troveId}`,
                  "Back to editing",
                ],
                successLink: ["/", "Go to the dashboard"],
                successMessage: "The position has been updated successfully.",

                depositChange: (!depositChange.parsed || dn.eq(depositChange.parsed, 0))
                  ? null
                  : dn.mul(depositChange.parsed, depositMode === "remove" ? -1 : 1),

                leverageFactorChange: (
                    !initialLoanDetails.leverageFactor
                    || userLeverageFactor === initialLoanDetails.leverageFactor
                  )
                  ? null
                  : [initialLoanDetails.leverageFactor, userLeverageFactor],

                prevLoan: { ...loan },
                loan: {
                  ...loan,
                  deposit: newDeposit,
                  borrowed: newDebt,
                },
              });
            }
          }}
        />
      </div>
    </>
  );
}
