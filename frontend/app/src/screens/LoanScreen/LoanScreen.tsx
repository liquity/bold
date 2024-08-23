"use client";

import type { PositionLoan } from "@/src/types";
import type { ReactNode } from "react";

import { ConnectWarningBox } from "@/src/comps/ConnectWarningBox/ConnectWarningBox";
import { Field } from "@/src/comps/Field/Field";
import { LeverageField, useLeverageField } from "@/src/comps/LeverageField/LeverageField";
import { Position } from "@/src/comps/Position/Position";
import { Screen } from "@/src/comps/Screen/Screen";
import { ETH_MAX_RESERVE, INTEREST_RATE_INCREMENT, INTEREST_RATE_MAX, INTEREST_RATE_MIN } from "@/src/constants";
import content from "@/src/content";
import { ACCOUNT_BALANCES, ACCOUNT_POSITIONS, getDebtBeforeRateBucketIndex, INTEREST_CHART } from "@/src/demo-mode";
import { useInputFieldValue } from "@/src/form-utils";
import { formatRisk } from "@/src/formatting";
import { getLoanDetails } from "@/src/liquity-math";
import { useAccount } from "@/src/services/Ethereum";
import { usePrice } from "@/src/services/Prices";
import { infoTooltipProps, riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  Button,
  Dropdown,
  HFlex,
  IconSettings,
  InfoTooltip,
  InputField,
  lerp,
  norm,
  Slider,
  StatusDot,
  Tabs,
  TextButton,
  TokenIcon,
  TOKENS_BY_SYMBOL,
  VFlex,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { notFound, useRouter, useSearchParams, useSelectedLayoutSegment } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const ARROW_RIGHT = "→";

const TABS = [
  { label: "Collateral & Debt", id: "colldebt" },
  { label: "Interest rate", id: "rate" },
  { label: "Close position", id: "close" },
];

export function LoanScreen() {
  const router = useRouter();
  const action = useSelectedLayoutSegment() ?? "colldebt";
  const searchParams = useSearchParams();
  const trove = useTrove(searchParams.get("id"));

  const [leverageMode, setLeverageMode] = useState(trove?.type === "leverage");

  if (!trove) {
    notFound();
  }

  const tab = TABS.findIndex(({ id }) => id === action);

  return (
    <Screen>
      <VFlex gap={0}>
        <Position
          troveId={trove.troveId}
          leverageMode={leverageMode}
          onLeverageModeChange={setLeverageMode}
        />
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            height: 48 + 24 + 24,
            paddingTop: 48,
            paddingBottom: 24,
            fontSize: 20,
          })}
        >
          <div>Manage your position</div>
          <div
            className={css({
              color: "contentAlt",
              cursor: "pointer",
            })}
          >
            <IconSettings />
          </div>
        </div>
        <VFlex gap={32}>
          <Tabs
            items={TABS.map(({ label, id }) => ({
              label,
              panelId: `p-${id}`,
              tabId: `t-${id}`,
            }))}
            selected={tab}
            onSelect={(index) => {
              router.push(`/loan/${TABS[index].id}?id=${trove.troveId}`, { scroll: false });
            }}
          />
          {action === "colldebt" && (
            leverageMode
              ? <UpdateLeveragePositionPanel loan={trove} />
              : <UpdateBorrowPositionPanel loan={trove} />
          )}
          {action === "rate" && <UpdateRatePanel loan={trove} />}
          {action === "close" && <ClosePositionPanel loan={trove} />}
        </VFlex>
      </VFlex>
    </Screen>
  );
}

type RelativeFieldMode = "add" | "remove";

function UpdateBorrowPositionPanel({ loan }: { loan: PositionLoan }) {
  const router = useRouter();
  const account = useAccount();

  const collateral = TOKENS_BY_SYMBOL[loan.collateral];
  const collPrice = usePrice(collateral.symbol);
  const boldPriceUsd = usePrice("BOLD") ?? dn.from(0, 18);

  // deposit change
  const [depositMode, setDepositMode] = useState<RelativeFieldMode>("add");
  const depositChange = useInputFieldValue((value) => dn.format(value));

  // deposit update
  const newDeposit = depositChange.parsed && (
    depositMode === "remove"
      ? dn.sub(loan.deposit, depositChange.parsed)
      : dn.add(loan.deposit, depositChange.parsed)
  );

  const collMax = depositMode === "remove" ? loan.deposit : dn.sub(
    ACCOUNT_BALANCES[collateral.symbol],
    ETH_MAX_RESERVE,
  );

  // debt change
  const [debtMode, setDebtMode] = useState<RelativeFieldMode>("add");
  const debtChange = useInputFieldValue((value) => dn.format(value));
  const debtChangeUsd = debtChange.parsed && dn.mul(debtChange.parsed, boldPriceUsd);

  const newDebt = debtChange.parsed && (
    debtMode === "remove"
      ? dn.sub(loan.borrowed, debtChange.parsed)
      : dn.add(loan.borrowed, debtChange.parsed)
  );

  const boldMax = debtMode === "remove" ? ACCOUNT_BALANCES["BOLD"] : null;

  const loanDetails = getLoanDetails(
    loan.deposit,
    loan.borrowed,
    loan.interestRate,
    collateral.collateralRatio,
    collPrice,
  );

  const newLoanDetails = getLoanDetails(
    newDeposit,
    newDebt,
    loanDetails.interestRate,
    collateral.collateralRatio,
    collPrice,
  );

  const allowSubmit = account.isConnected && (
    !dn.eq(loanDetails.deposit ?? dn.from(0, 18), newLoanDetails.deposit ?? dn.from(0, 18))
    || !dn.eq(loanDetails.debt ?? dn.from(0, 18), newLoanDetails.debt ?? dn.from(0, 18))
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
                  ? "Decrease your collateral"
                  : "Increase your collateral",
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
                start: (depositChange.parsed && collPrice)
                  ? "$" + dn.format(dn.mul(depositChange.parsed, collPrice), 2)
                  : "$0.00",
                end: (
                  <TextButton
                    label={`Max ${dn.format(collMax, 2)} ${TOKENS_BY_SYMBOL[collateral.symbol].name}`}
                    onClick={() => {
                      depositChange.setValue(dn.toString(collMax));
                    }}
                  />
                ),
              }}
            />
          }
          footer={[[
            // eslint-disable-next-line react/jsx-key
            <Field.FooterInfo label="Collateral after" />,

            // eslint-disable-next-line react/jsx-key
            loanDetails.deposit && newLoanDetails.deposit && (
              <Field.FooterInfo
                label={
                  <HFlex alignItems="center" gap={8}>
                    <div>{dn.format(loanDetails.deposit, 2)}</div>
                    <div>{ARROW_RIGHT}</div>
                  </HFlex>
                }
                value={
                  <HFlex alignItems="center" gap={8}>
                    <div>
                      {dn.format(newLoanDetails.deposit, 2)} {TOKENS_BY_SYMBOL[collateral.symbol].name}
                    </div>
                    <InfoTooltip heading="Collateral update" />
                  </HFlex>
                }
              />
            ),
          ]]}
        />

        <Field
          field={
            <InputField
              {...debtChange.inputFieldProps}
              contextual={
                <InputTokenBadge
                  background={false}
                  icon={<TokenIcon symbol="BOLD" />}
                  label="BOLD"
                />
              }
              label={{
                start: debtMode === "remove"
                  ? "Decrease your debt"
                  : "Increase your debt",
                end: (
                  <Tabs
                    compact
                    items={[
                      { label: "Borrow", panelId: "panel-borrow", tabId: "tab-borrow" },
                      { label: "Repay", panelId: "panel-repay", tabId: "tab-repay" },
                    ]}
                    onSelect={(index) => {
                      setDebtMode(index === 1 ? "remove" : "add");
                      debtChange.setValue("0");
                    }}
                    selected={debtMode === "remove" ? 1 : 0}
                  />
                ),
              }}
              labelHeight={32}
              placeholder="0.00"
              secondary={{
                start: debtChangeUsd
                  ? "$" + dn.format(debtChangeUsd, 2)
                  : "$0.00",
                end: (
                  boldMax && (
                    <TextButton
                      label={`Max ${dn.format(boldMax, 2)} BOLD`}
                      onClick={() => {
                        debtChange.setValue(dn.toString(boldMax));
                      }}
                    />
                  )
                ),
              }}
            />
          }
          footer={[
            [
              // eslint-disable-next-line react/jsx-key
              <Field.FooterInfo label="Debt after" />,
              // eslint-disable-next-line react/jsx-key
              loanDetails.debt && newLoanDetails.debt && (
                <Field.FooterInfo
                  label={
                    <HFlex alignItems="center" gap={8}>
                      <div>{dn.format(loanDetails.debt, 2)}</div>
                      <div>{ARROW_RIGHT}</div>
                    </HFlex>
                  }
                  value={
                    <HFlex alignItems="center" gap={8}>
                      <div>{dn.format(newLoanDetails.debt, 2)} BOLD</div>
                      <InfoTooltip heading="Debt update" />
                    </HFlex>
                  }
                />
              ),
            ],
          ]}
        />

        <div
          className={css({
            paddingTop: 8,
            paddingBottom: 32,
          })}
        >
          <InfoBox>
            <HFlex justifyContent="space-between" gap={16}>
              <div>Liquidation risk</div>
              <HFlex gap={8}>
                {loanDetails.liquidationRisk && (
                  <HFlex gap={4} justifyContent="flex-start">
                    <StatusDot mode={riskLevelToStatusMode(loanDetails.liquidationRisk)} />
                    {formatRisk(loanDetails.liquidationRisk)}
                  </HFlex>
                )}
                <div
                  className={css({
                    color: "contentAlt",
                  })}
                >
                  {ARROW_RIGHT}
                </div>
                {newLoanDetails.liquidationRisk && (
                  <HFlex gap={4} justifyContent="flex-start">
                    <StatusDot mode={riskLevelToStatusMode(newLoanDetails.liquidationRisk)} />
                    {formatRisk(newLoanDetails.liquidationRisk)}
                  </HFlex>
                )}
              </HFlex>
            </HFlex>
            <HFlex justifyContent="space-between" gap={16}>
              <div>
                <abbr title="Loan-to-value ratio">LTV</abbr>
              </div>
              <HFlex
                gap={8}
                className={css({
                  fontVariantNumeric: "tabular-nums",
                })}
              >
                {loanDetails.ltv && (
                  <div
                    className={css({
                      color: "contentAlt",
                    })}
                  >
                    {dn.format(dn.mul(loanDetails.ltv, 100), {
                      digits: 2,
                      trailingZeros: true,
                    })}%
                  </div>
                )}
                <div
                  className={css({
                    color: "contentAlt",
                  })}
                >
                  {ARROW_RIGHT}
                </div>
                {newLoanDetails.ltv && (
                  <div>
                    {dn.format(dn.mul(newLoanDetails.ltv, dn.lt(newLoanDetails.ltv, 0) ? 0 : 100), {
                      digits: 2,
                      trailingZeros: true,
                    })}%
                  </div>
                )}
              </HFlex>
            </HFlex>
            <HFlex justifyContent="space-between" gap={16}>
              <div>Liquidation price</div>
              <HFlex
                gap={8}
                className={css({
                  fontVariantNumeric: "tabular-nums",
                })}
              >
                {loanDetails.liquidationPrice && (
                  <div
                    className={css({
                      color: "contentAlt",
                    })}
                  >
                    ${dn.format(loanDetails.liquidationPrice, { digits: 2, trailingZeros: true })}
                  </div>
                )}
                <div
                  className={css({
                    color: "contentAlt",
                  })}
                >
                  {ARROW_RIGHT}
                </div>
                {newLoanDetails.liquidationPrice && (
                  <div>
                    ${dn.format(newLoanDetails.liquidationPrice, { digits: 2, trailingZeros: true })}
                  </div>
                )}
              </HFlex>
            </HFlex>
          </InfoBox>
        </div>
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

function UpdateLeveragePositionPanel({ loan }: { loan: PositionLoan }) {
  const router = useRouter();
  const account = useAccount();

  const collateral = TOKENS_BY_SYMBOL[loan.collateral];
  const collPrice = usePrice(collateral.symbol);

  // loan details, before the updates
  const loanDetails = getLoanDetails(
    loan.deposit,
    loan.borrowed,
    loan.interestRate,
    collateral.collateralRatio,
    collPrice,
  );

  // deposit change
  const [depositMode, setDepositMode] = useState<RelativeFieldMode>("add");
  const depositChange = useInputFieldValue((value) => dn.format(value));

  const newDepositPreLeverage = depositChange.parsed && loanDetails.depositPreLeverage && (
    depositMode === "remove"
      ? dn.sub(loanDetails.depositPreLeverage, depositChange.parsed)
      : dn.add(loanDetails.depositPreLeverage, depositChange.parsed)
  );

  // leverage factor
  const leverageField = useLeverageField({
    collPrice: collPrice ?? dn.from(0, 18),
    collToken: collateral,
    depositPreLeverage: newDepositPreLeverage,
    updatePriority: "leverageFactor",
  });

  const initialLeverageFactorSet = useRef(false);
  useEffect(() => {
    if (loanDetails.leverageFactor && !initialLeverageFactorSet.current) {
      leverageField.updateLeverageFactor(loanDetails.leverageFactor);
      initialLeverageFactorSet.current = true;
    }
  }, [leverageField.updateLeverageFactor, loanDetails.leverageFactor]);

  const newLoanDetails = getLoanDetails(
    newDepositPreLeverage && dn.mul(
      newDepositPreLeverage,
      leverageField.leverageFactor,
    ),
    newDepositPreLeverage && collPrice && dn.mul(
      dn.sub(leverageField.leverageFactor, dn.from(1, 18)),
      dn.mul(newDepositPreLeverage, collPrice),
    ),
    loanDetails.interestRate,
    collateral.collateralRatio,
    collPrice,
  );

  const depositMax = depositMode === "remove"
    ? loanDetails.depositPreLeverage
    : dn.sub(ACCOUNT_BALANCES[collateral.symbol], ETH_MAX_RESERVE);

  const allowSubmit = account.isConnected && (
    !dn.eq(
      loanDetails.deposit ?? dn.from(0, 18),
      newLoanDetails.deposit ?? dn.from(0, 18),
    ) || (
      loanDetails.leverageFactor !== newLoanDetails.leverageFactor
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
                    ? "$" + dn.format(dn.mul(depositChange.parsed, collPrice), 2)
                    : "$0.00"
                ),
                end: depositMax && (
                  <TextButton
                    label={`Max ${dn.format(depositMax, 2)} ${TOKENS_BY_SYMBOL[collateral.symbol].name}`}
                    onClick={() => {
                      depositChange.setValue(dn.toString(depositMax));
                    }}
                  />
                ),
              }}
            />
          }
          footer={[[
            // eslint-disable-next-line react/jsx-key
            <Field.FooterInfo label="Deposit after" />,

            // eslint-disable-next-line react/jsx-key
            loanDetails.depositPreLeverage && newDepositPreLeverage && (
              <Field.FooterInfo
                value={
                  <HFlex alignItems="center" gap={8}>
                    <ValueUpdate
                      before={dn.format(loanDetails.depositPreLeverage, 2)}
                      after={
                        <>
                          <HFlex alignItems="center" gap={8}>
                            <div>
                              {dn.format(newDepositPreLeverage, 2)} {TOKENS_BY_SYMBOL[collateral.symbol].name}
                            </div>
                            <InfoTooltip heading="Collateral update" />
                          </HFlex>
                        </>
                      }
                      fontSize={14}
                    />
                  </HFlex>
                }
              />
            ),
          ]]}
        />

        <LeverageField {...leverageField} />

        <div
          className={css({
            paddingTop: 8,
            paddingBottom: 32,
          })}
        >
          <InfoBox>
            <HFlex justifyContent="space-between" gap={16}>
              <div>Liquidation risk</div>
              <ValueUpdate
                before={loanDetails.liquidationRisk && (
                  <HFlex gap={4} justifyContent="flex-start">
                    <StatusDot mode={riskLevelToStatusMode(loanDetails.liquidationRisk)} />
                    {formatRisk(loanDetails.liquidationRisk)}
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
            <HFlex justifyContent="space-between" gap={16}>
              <div>
                <abbr title="Loan-to-value ratio">LTV</abbr>
              </div>
              <ValueUpdate
                before={!loanDetails.ltv || dn.gt(loanDetails.ltv, loanDetails.maxLtv)
                  ? `>${dn.format(dn.mul(loanDetails.maxLtv, 100), { digits: 2, trailingZeros: true })}%`
                  : `${dn.format(dn.mul(loanDetails.ltv, 100), { digits: 2, trailingZeros: true })}%`}
                after={newLoanDetails.ltv
                  && `${dn.format(dn.mul(newLoanDetails.ltv, 100), { digits: 2, trailingZeros: true })}%`}
              />
            </HFlex>
            <HFlex justifyContent="space-between" gap={16}>
              <div>Liquidation price</div>
              <ValueUpdate
                before={loanDetails.liquidationPrice
                  ? `$${dn.format(loanDetails.liquidationPrice, { digits: 2, trailingZeros: true })}`
                  : "N/A"}
                after={newLoanDetails.liquidationPrice
                  ? `$${dn.format(newLoanDetails.liquidationPrice, { digits: 2, trailingZeros: true })}`
                  : "N/A"}
              />
            </HFlex>
          </InfoBox>
        </div>
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

function UpdateRatePanel({ loan }: { loan: PositionLoan }) {
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
                      ? dn.format(boldInterestPerYear, { digits: 2, trailingZeros: false })
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
                    {dn.format(interestRate.parsed, { digits: 1, trailingZeros: true })}
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
            <HFlex gap={8}>
              {loanDetails.redemptionRisk && (
                <HFlex gap={4} justifyContent="flex-start">
                  <StatusDot mode={riskLevelToStatusMode(loanDetails.redemptionRisk)} />
                  {formatRisk(loanDetails.redemptionRisk)}
                </HFlex>
              )}
              <div
                className={css({
                  color: "contentAlt",
                })}
              >
                {ARROW_RIGHT}
              </div>
              {newLoanDetails.redemptionRisk && (
                <HFlex gap={4} justifyContent="flex-start">
                  <StatusDot mode={riskLevelToStatusMode(newLoanDetails.redemptionRisk)} />
                  {formatRisk(newLoanDetails.redemptionRisk)}
                </HFlex>
              )}
            </HFlex>
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
                ~{dn.format(dn.div(boldInterestPerYear, 365), { digits: 2, trailingZeros: true })} BOLD
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

function ClosePositionPanel({ loan }: { loan: PositionLoan }) {
  const router = useRouter();
  const account = useAccount();
  const collPrice = usePrice(loan.collateral);
  const boldPriceUsd = usePrice("BOLD");
  const [tokenIndex, setTokenIndex] = useState(0);

  const collateral = TOKENS_BY_SYMBOL[loan.collateral];

  if (!collPrice || !boldPriceUsd) {
    return null;
  }

  const loanDetails = getLoanDetails(
    loan.deposit,
    loan.borrowed,
    loan.interestRate,
    collateral.collateralRatio,
    collPrice,
  );

  const repayWith = tokenIndex === 0 ? "BOLD" : collateral.symbol;

  const amountToRepay = repayWith === "BOLD"
    ? (loanDetails.debt ?? dn.from(0))
    : (dn.div(loanDetails.debt ?? dn.from(0), collPrice));

  const collToReclaim = repayWith === "BOLD"
    ? loan.deposit
    : dn.sub(loan.deposit, amountToRepay);

  const allowSubmit = account.isConnected;

  return (
    <>
      <VFlex gap={48}>
        <Field
          field={
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 16,
                justifyContent: "space-between",
              })}
            >
              <div
                className={css({
                  display: "flex",
                  gap: 16,
                  fontSize: 28,
                  lineHeight: 1,
                })}
              >
                <div>
                  {dn.format(amountToRepay, { digits: 2, trailingZeros: true })}
                </div>
              </div>
              <Dropdown
                buttonDisplay={() => ({
                  label: (
                    <>
                      {TOKENS_BY_SYMBOL[(["BOLD", collateral.symbol] as const)[tokenIndex]].name}
                      <span
                        className={css({
                          color: "contentAlt",
                          fontWeight: 400,
                        })}
                      >
                        {TOKENS_BY_SYMBOL[(["BOLD", collateral.symbol] as const)[tokenIndex]].symbol === "BOLD"
                          ? " account"
                          : " loan"}
                      </span>
                    </>
                  ),
                  icon: <TokenIcon symbol={(["BOLD", collateral.symbol] as const)[tokenIndex]} />,
                })}
                items={(["BOLD", collateral.symbol] as const).map((symbol) => ({
                  icon: <TokenIcon symbol={symbol} />,
                  label: (
                    <>
                      {TOKENS_BY_SYMBOL[symbol].name} {symbol === "BOLD" ? "(account balance)" : "(loan collateral)"}
                    </>
                  ),
                }))}
                menuWidth={300}
                onSelect={setTokenIndex}
                selected={tokenIndex}
              />
            </div>
          }
          footer={[[
            // eslint-disable-next-line react/jsx-key
            <Field.FooterInfo
              label={`$${dn.format(dn.mul(loan.borrowed, boldPriceUsd), 2)}`}
              value={null}
            />,
            null,
          ]]}
          label="You repay with"
        />
        <Field
          field={
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 16,
                justifyContent: "space-between",
              })}
            >
              <div
                className={css({
                  display: "flex",
                  gap: 16,
                  fontSize: 28,
                  lineHeight: 1,
                })}
              >
                <div>
                  {dn.format(
                    collToReclaim,
                    { digits: 2, trailingZeros: true },
                  )}
                </div>
              </div>
              <div>
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    height: 40,
                    padding: "0 16px 0 8px",
                    fontSize: 24,
                    background: "fieldSurface",
                    borderRadius: 20,
                    userSelect: "none",
                  })}
                >
                  <TokenIcon symbol={collateral.symbol} />
                  <div>{collateral.name}</div>
                </div>
              </div>
            </div>
          }
          label="You reclaim"
          footer={[[
            // eslint-disable-next-line react/jsx-key
            <Field.FooterInfo
              label={`$${dn.format(dn.mul(loan.deposit, collPrice), 2)}`}
              value={null}
            />,
            null,
          ]]}
        />
      </VFlex>
      <div
        className={css({
          padding: 20,
          textAlign: "center",
          background: "yellow:200",
          borderRadius: 8,
        })}
      >
        You are repaying your debt and closing the position. {repayWith === "BOLD"
          ? `The deposit will be returned to your wallet.`
          : `To close yor position, a part of your collateral will be sold to pay back the debt. The rest of your collateral will be returned to your wallet.`}
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
          label="Repay & close"
          mode="primary"
          size="large"
          wide
          onClick={() => {
            router.push("/transactions/close-loan");
          }}
        />
      </div>
    </>
  );
}

function InputTokenBadge({
  background = true,
  icon,
  label,
}: {
  background?: boolean;
  icon?: ReactNode;
  label: ReactNode;
}) {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 40,
        fontSize: 24,
        userSelect: "none",
      })}
      style={{
        paddingLeft: icon ? 8 : 16,
        background: background ? "#FFF" : "transparent",
        borderRadius: background ? 20 : 0,
        padding: background ? "0 16px" : 0,
      }}
    >
      {icon}
      <div>
        {label}
      </div>
    </div>
  );
}

function useTrove(troveId: string | null) {
  return useMemo(() => {
    if (troveId === null) {
      return null;
    }
    let troveIdInt: bigint;
    try {
      troveIdInt = BigInt(troveId);
    } catch {
      return null;
    }
    const position = ACCOUNT_POSITIONS.find((position) => ((
      position.type === "borrow" || position.type === "leverage"
    ) && position.troveId === troveIdInt)) ?? null;
    return position as PositionLoan | null;
  }, [troveId]);
}

function InfoBox({ children }: { children: ReactNode }) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 16,
        fontSize: 16,
        background: "infoSurface",
        border: "1px solid token(colors.infoSurfaceBorder)",
        borderRadius: 8,
      })}
    >
      {children}
    </div>
  );
}

function ValueUpdate({
  after,
  before,
  fontSize = 16,
  tabularNums = true,
}: {
  after: ReactNode;
  before: ReactNode;
  fontSize?: number;
  tabularNums?: boolean;
}) {
  return (
    <HFlex
      gap={8}
      style={{
        fontSize,
        fontVariantNumeric: tabularNums ? "tabular-nums" : "inherit",
      }}
    >
      <div className={css({ color: "contentAlt" })}>{before}</div>
      <div className={css({ color: "contentAlt" })}>{ARROW_RIGHT}</div>
      <div>{after}</div>
    </HFlex>
  );
}
