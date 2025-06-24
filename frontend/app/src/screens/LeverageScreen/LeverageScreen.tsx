"use client";

import type { DelegateMode } from "@/src/comps/InterestRateField/InterestRateField";
import type { Address, Dnum, PositionLoanUncommitted } from "@/src/types";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Amount } from "@/src/comps/Amount/Amount";
import { Field } from "@/src/comps/Field/Field";
import { InterestRateField } from "@/src/comps/InterestRateField/InterestRateField";
import { LeverageField, useLeverageField } from "@/src/comps/LeverageField/LeverageField";
import { RedemptionInfo } from "@/src/comps/RedemptionInfo/RedemptionInfo";
import { Screen } from "@/src/comps/Screen/Screen";
import { ETH_MAX_RESERVE, LEVERAGE_MAX_SLIPPAGE, MAX_COLLATERAL_DEPOSITS, MIN_DEBT } from "@/src/constants";
import content from "@/src/content";
import { dnum18, dnumMax } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { useCheckLeverageSlippage } from "@/src/liquity-leverage";
import { getRedemptionRisk } from "@/src/liquity-math";
import { getBranch, getBranches, getCollToken, useNextOwnerIndex, useDebtPositioning } from "@/src/liquity-utils";
import { usePrice } from "@/src/services/Prices";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { infoTooltipProps } from "@/src/uikit-utils";
import { useAccount, useBalance } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import {
  ADDRESS_ZERO,
  Button,
  Dropdown,
  HFlex,
  IconSuggestion,
  InfoTooltip,
  InputField,
  isCollateralSymbol,
  TextButton,
  TokenIcon,
  VFlex,
} from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function LeverageScreen() {
  const branches = getBranches();

  // useParams() can return an array but not with the current
  // routing setup, so we can safely cast it to a string
  const collSymbol = `${useParams().collateral ?? branches[0]?.symbol}`.toUpperCase();
  if (!isCollateralSymbol(collSymbol)) {
    throw new Error(`Invalid collateral symbol: ${collSymbol}`);
  }

  const router = useRouter();
  const account = useAccount();
  const txFlow = useTransactionFlow();

  const branch = getBranch(collSymbol);
  const collaterals = branches.map((b) => getCollToken(b.branchId));
  const collateral = getCollToken(branch.id);

  const balances = Object.fromEntries(collaterals.map(({ symbol }) => (
    [symbol, useBalance(account.address, symbol)] as const
  )));

  const nextOwnerIndex = useNextOwnerIndex(account.address ?? null, branch.id);

  const collPrice = usePrice(collateral.symbol);

  const maxCollDeposit = MAX_COLLATERAL_DEPOSITS[collSymbol] ?? null;
  const depositPreLeverage = useInputFieldValue(fmtnum, {
    validate: (parsed, value) => {
      const isAboveMax = maxCollDeposit && parsed && dn.gt(parsed, maxCollDeposit);
      return {
        parsed: isAboveMax ? maxCollDeposit : parsed,
        value: isAboveMax ? dn.toString(maxCollDeposit) : value,
      };
    },
  });

  const [interestRate, setInterestRate] = useState<null | Dnum>(null);
  const [interestRateMode, setInterestRateMode] = useState<DelegateMode>("manual");
  const [interestRateDelegate, setInterestRateDelegate] = useState<Address | null>(null);

  const leverageField = useLeverageField({
    depositPreLeverage: depositPreLeverage.parsed,
    collPrice: collPrice.data ?? dn.from(0, 18),
    collToken: collateral,
  });

  // reset leverage when collateral changes
  useEffect(() => {
    leverageField.updateLeverageFactor(leverageField.leverageFactorSuggestions[0] ?? 1.1);
  }, [collateral.symbol, leverageField.leverageFactorSuggestions]);

  const debtPositioning = useDebtPositioning(branch.id, interestRate);
  const redemptionRisk = getRedemptionRisk(debtPositioning.debtInFront, debtPositioning.totalDebt);
  const depositUsd = depositPreLeverage.parsed && collPrice.data && dn.mul(
    depositPreLeverage.parsed,
    collPrice.data,
  );

  const collBalance = balances[collateral.symbol]?.data;

  const maxAmount = collBalance && dnumMax(
    dn.sub(collBalance, collSymbol === "ETH" ? ETH_MAX_RESERVE : 0), // Only keep a reserve for ETH, not LSTs
    dnum18(0),
  );

  const newLoan: PositionLoanUncommitted = {
    type: "multiply",
    status: "active",
    batchManager: interestRateDelegate,
    borrowed: leverageField.debt ?? dn.from(0, 18),
    borrower: account.address ?? ADDRESS_ZERO,
    branchId: branch.id,
    deposit: depositPreLeverage.parsed
      ? dn.mul(depositPreLeverage.parsed, leverageField.leverageFactor)
      : dn.from(0, 18),
    interestRate: interestRate ?? dn.from(0, 18),
    troveId: null,
  };

  const hasDeposit = Boolean(depositPreLeverage.parsed && dn.gt(depositPreLeverage.parsed, 0));

  const leverageSlippage = useCheckLeverageSlippage({
    branchId: branch.id,
    initialDeposit: depositPreLeverage.parsed,
    leverageFactor: leverageField.leverageFactor,
    ownerIndex: nextOwnerIndex.data ?? null,
  });

  const leverageSlippageElements = useSlippageElements(
    leverageSlippage,
    hasDeposit && account.isConnected,
  );

  const hasAllowedSlippage = leverageSlippage.data
    && dn.lte(leverageSlippage.data, LEVERAGE_MAX_SLIPPAGE);

  const leverageFieldDrawer = (hasDeposit && newLoan.borrowed && dn.lt(newLoan.borrowed, MIN_DEBT))
    ? { mode: "error" as const, message: `You must borrow at least ${fmtnum(MIN_DEBT, 2)} BOLD.` }
    : leverageSlippageElements.drawer;

  const allowSubmit = account.isConnected
    && hasDeposit
    && interestRate && dn.gt(interestRate, 0)
    && leverageField.debt && dn.gt(leverageField.debt, 0)
    && hasAllowedSlippage;

  return (
    <Screen
      heading={{
        title: (
          <HFlex>
            {content.leverageScreen.headline(
              <TokenIcon.Group>
                {collaterals.map(({ symbol }) => (
                  <TokenIcon
                    key={symbol}
                    symbol={symbol}
                  />
                ))}
              </TokenIcon.Group>,
            )}
          </HFlex>
        ),
      }}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 48,
          width: 534,
        })}
      >
        <Field
          field={
            <InputField
              id="input-deposit"
              contextual={
                <Dropdown
                  items={collaterals.map(({ symbol, name }) => ({
                    icon: <TokenIcon symbol={symbol} />,
                    label: name,
                    value: account.isConnected
                      ? fmtnum(balances[symbol]?.data ?? 0)
                      : "−",
                  }))}
                  menuPlacement="end"
                  menuWidth={300}
                  onSelect={(index) => {
                    setTimeout(() => {
                      depositPreLeverage.setValue("");
                      depositPreLeverage.focus();
                    }, 0);
                    const collToken = collaterals[index];
                    if (!collToken) {
                      throw new Error(`Unknown branch: ${index}`);
                    }
                    const { symbol } = collToken;
                    router.push(
                      `/multiply/${symbol.toLowerCase()}`,
                      { scroll: false },
                    );
                  }}
                  selected={branch.id}
                />
              }
              label={content.leverageScreen.depositField.label}
              placeholder="0.00"
              secondary={{
                start: fmtnum(depositUsd, { prefix: "$", preset: "2z" }),
                end: maxAmount
                  ? (
                    <TextButton
                      label={`Max ${fmtnum(maxAmount)} ${collateral.name}`}
                      onClick={() => {
                        depositPreLeverage.setValue(dn.toString(maxAmount));
                      }}
                    />
                  )
                  : "Fetching balance…",
              }}
              {...depositPreLeverage.inputFieldProps}
            />
          }
          footer={{
            start: collPrice.data && (
              <Field.FooterInfoCollPrice
                collName={collateral.name}
                collPriceUsd={collPrice.data}
              />
            ),
            end: (
              <Field.FooterInfoMaxLtv
                maxLtv={dn.div(dn.from(1, 18), collateral.collateralRatio)}
              />
            ),
          }}
        />

        <Field
          field={
            <LeverageField
              drawer={leverageFieldDrawer}
              inputId="input-liquidation-price"
              onDrawerClose={leverageSlippageElements.onClose}
              {...leverageField}
            />
          }
          footer={{
            start: (
              <>
                <Field.FooterInfoLiquidationRisk
                  riskLevel={leverageField.liquidationRisk}
                />
                <Field.FooterInfoLoanToValue
                  ltvRatio={leverageField.ltv}
                  maxLtvRatio={leverageField.maxLtv}
                />
              </>
            ),
            end: (
              <Field.FooterInfo
                label="Exposure"
                value={
                  <HFlex gap={8}>
                    <div
                      className={css({
                        flexShrink: 1,
                        display: "flex",
                        fontVariantNumeric: "tabular-nums",
                      })}
                    >
                      <Amount
                        value={leverageField.deposit && dn.gt(leverageField.deposit, 0) ? leverageField.deposit : null}
                        format="2z"
                        fallback="−"
                        suffix={` ${collateral.name}`}
                      />
                    </div>
                    <InfoTooltip {...infoTooltipProps(content.leverageScreen.infoTooltips.exposure)} />
                  </HFlex>
                }
              />
            ),
          }}
        />

        <Field
          field={
            <InterestRateField
              branchId={branch.id}
              debt={leverageField.debt}
              delegate={interestRateDelegate}
              inputId="input-interest-rate"
              interestRate={interestRate}
              mode={interestRateMode}
              onAverageInterestRateLoad={setInterestRate}
              onChange={setInterestRate}
              onDelegateChange={setInterestRateDelegate}
              onModeChange={setInterestRateMode}
            />
          }
          footer={{
            start: (
              <Field.FooterInfoRedemptionRisk
                riskLevel={redemptionRisk}
              />
            ),
            end: (
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
                <>You can adjust this rate at any time</>
                <InfoTooltip {...infoTooltipProps(content.generalInfotooltips.interestRateAdjustment)} />
              </span>
            ),
          }}
        />

        <RedemptionInfo />

        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 32,
            width: "100%",
          })}
        >
          {/*<ConnectWarningBox />*/}
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: 16,
            })}
          >
            <Button
              // oxlint-disable-next-line
              disabled={true || !allowSubmit}
              label="Coming Soon"
              mode="primary"
              size="large"
              wide
              onClick={() => {
                if (
                  depositPreLeverage.parsed
                  && leverageField.debt
                  && account.address
                  && typeof nextOwnerIndex.data === "number"
                ) {
                  txFlow.start({
                    flowId: "openLeveragePosition",
                    backLink: ["/multiply", "Back to editing"],
                    successLink: ["/", "Go to the Dashboard"],
                    successMessage: "The leveraged position has been created successfully.",

                    ownerIndex: nextOwnerIndex.data,
                    leverageFactor: leverageField.leverageFactor,
                    loan: newLoan,
                  });
                }
              }}
            />

            {
              /*leverageSlippageElements.mode === "error"
              ? (
                <div
                  className={css({
                    color: "negative",
                  })}
                >
                  {leverageSlippageElements.message}
                </div>
              )
              : (
                <div>
                  {leverageSlippageElements.message}
                </div>
              )*/
            }
          </div>
        </div>
      </div>
    </Screen>
  );
}

function useSlippageElements(
  leverageSlippage: ReturnType<typeof useCheckLeverageSlippage>,
  ready: boolean,
): {
  mode: "error" | "loading" | "success";
  drawer: ComponentPropsWithoutRef<typeof LeverageField>["drawer"];
  message?: ReactNode;
  onClose: () => void;
} {
  const [forceDrawerClosed, setForceDrawerClosed] = useState(false);

  useEffect(() => {
    setForceDrawerClosed(false);
  }, [leverageSlippage.status]);

  const onClose = () => {
    setForceDrawerClosed(true);
  };

  if (forceDrawerClosed || !ready) {
    return {
      drawer: null,
      mode: "success",
      onClose,
    };
  }

  if (leverageSlippage.status === "error") {
    const retry = (
      <TextButton
        size="small"
        label="retry"
        onClick={() => {
          leverageSlippage.refetch();
        }}
      />
    );
    return {
      drawer: {
        mode: "error",
        message: (
          <HFlex gap={4}>
            <div>Slippage calculation failed.</div>
            {retry}
          </HFlex>
        ),
      },
      message: (
        <VFlex gap={4}>
          <div>Slippage calculation failed. ({leverageSlippage.error.message})</div>
          {retry}
        </VFlex>
      ),
      mode: "error",
      onClose,
    };
  }

  if (leverageSlippage.status === "pending" || leverageSlippage.fetchStatus === "fetching") {
    const message = "Calculating slippage…";
    return {
      drawer: null,
      message,
      mode: "loading",
      onClose,
    };
  }

  if (leverageSlippage.data && dn.gt(leverageSlippage.data, LEVERAGE_MAX_SLIPPAGE)) {
    const message = (
      <>
        Slippage too high: {fmtnum(
          leverageSlippage.data,
          "pct2",
        )}% (max {fmtnum(LEVERAGE_MAX_SLIPPAGE, "pct2")}%)
      </>
    );
    return {
      drawer: { mode: "error", message },
      message,
      mode: "error",
      onClose,
    };
  }

  return {
    drawer: null,
    onClose,
    mode: "success",
  };
}
