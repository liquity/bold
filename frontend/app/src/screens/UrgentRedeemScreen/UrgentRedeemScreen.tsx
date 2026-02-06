"use client";

import type { CollateralSymbol, Dnum } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { Field } from "@/src/comps/Field/Field";
import { FlowButton } from "@/src/comps/FlowButton/FlowButton";
import { InfoBox } from "@/src/comps/InfoBox/InfoBox";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton";
import { Screen } from "@/src/comps/Screen/Screen";
import content from "@/src/content";
import { DNUM_0 } from "@/src/dnum-utils";
import { parseInputPercentage, useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { getBranch, getCollToken, useRedeemableTroves, useShutdownStatus } from "@/src/liquity-utils";
import { useLastGoodPrice, usePrice } from "@/src/services/Prices";
import {
  addICRToTroves,
  calculateMinCollateral,
  calculateRedemptionOutput,
  DEFAULT_SLIPPAGE,
  selectOptimalTroves,
} from "@/src/urgent-redemption-utils";
import { useAccount, useBalance } from "@/src/wagmi-utils";
import { css } from "@/styled-system/css";
import { HFlex, InfoTooltip, InputField, Tabs, TextButton, TokenIcon, VFlex } from "@liquity2/uikit";
import * as dn from "dnum";
import { useEffect, useMemo, useState } from "react";
import { TroveSelectionTable } from "./TroveSelectionTable";

export function UrgentRedeemScreen() {
  const account = useAccount();
  const boldBalance = useBalance(account.address, "BOLD");
  const boldPrice = usePrice("BOLD");
  const shutdownStatus = useShutdownStatus();

  const shutdownBranches = useMemo(
    () => shutdownStatus.data?.filter((b) => b.isShutdown) ?? [],
    [shutdownStatus.data],
  );

  const [selectedBranchSymbol, setSelectedBranchSymbol] = useState<CollateralSymbol | null>(null);
  const activeBranchSymbol = selectedBranchSymbol
    ?? (shutdownBranches[0] ? getBranch(shutdownBranches[0].branchId)?.symbol ?? null : null);
  const activeBranch = activeBranchSymbol ? getBranch(activeBranchSymbol) : null;
  const collToken = activeBranch ? getCollToken(activeBranch.branchId) : null;

  const price = useLastGoodPrice(activeBranchSymbol);
  const trovesQuery = useRedeemableTroves(activeBranch?.branchId ?? null, { first: 200 });

  const boldAmount = useInputFieldValue(fmtnum);

  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);
  const slippageInput = useInputFieldValue(
    (value) => fmtnum(dn.mul(value, 100)),
    {
      defaultValue: fmtnum(dn.mul(DEFAULT_SLIPPAGE, 100)),
      parse: parseInputPercentage,
      onChange: ({ parsed }) => {
        if (parsed) setSlippage(parsed);
      },
    },
  );

  const [isManualMode, setIsManualMode] = useState(false);
  const [selectedTroveIds, setSelectedTroveIds] = useState<Set<string>>(new Set());

  const trovesWithICR = useMemo(() => {
    if (!trovesQuery.data || !price.data) return [];
    return addICRToTroves(trovesQuery.data, price.data);
  }, [trovesQuery.data, price.data]);

  const selection = useMemo(() => {
    if (!price.data) return null;

    if (isManualMode) {
      const manuallySelected = trovesWithICR.filter((t) => selectedTroveIds.has(t.troveId));
      const totalDebt = manuallySelected.reduce((sum, t) => dn.add(sum, t.debt), DNUM_0);
      const totalColl = manuallySelected.reduce((sum, t) => dn.add(sum, t.coll), DNUM_0);
      const requestedAmount = boldAmount.parsed ?? DNUM_0;
      const actualBoldToRedeem = dn.lt(totalDebt, requestedAmount) ? totalDebt : requestedAmount;

      return {
        selectedTroves: manuallySelected,
        totalDebt,
        totalColl,
        actualBoldToRedeem,
        isAmountCapped: dn.lt(totalDebt, requestedAmount),
      };
    }

    return selectOptimalTroves(
      trovesWithICR,
      boldAmount.parsed ?? DNUM_0,
      price.data,
    );
  }, [trovesWithICR, boldAmount.parsed, price.data, isManualMode, selectedTroveIds]);

  const redemptionOutput = useMemo(() => {
    if (!selection || !price.data) return null;
    return calculateRedemptionOutput(
      selection.selectedTroves,
      selection.actualBoldToRedeem,
      price.data,
    );
  }, [selection, price.data]);

  const minCollateral = useMemo(() => {
    if (!redemptionOutput) return null;
    return calculateMinCollateral(redemptionOutput.collateral, slippage);
  }, [redemptionOutput, slippage]);

  const boldRedeemedUsd = selection && boldPrice.data
    && dn.mul(selection.actualBoldToRedeem, boldPrice.data);

  const [autoCappedTo, setAutoCappedTo] = useState<Dnum | null>(null);
  const setBoldAmount = boldAmount.setValue;

  useEffect(() => {
    if (selection?.isAmountCapped && dn.gt(selection.actualBoldToRedeem, DNUM_0)) {
      setBoldAmount(dn.toString(selection.actualBoldToRedeem));
      setAutoCappedTo(selection.actualBoldToRedeem);
    }
  }, [selection?.isAmountCapped, selection?.actualBoldToRedeem, setBoldAmount]);

  useEffect(() => {
    if (autoCappedTo && boldAmount.parsed && !dn.eq(boldAmount.parsed, autoCappedTo)) {
      setAutoCappedTo(null);
    }
  }, [boldAmount.parsed, autoCappedTo]);

  const amountNonZero = boldAmount.parsed && dn.gt(boldAmount.parsed, DNUM_0);
  const balanceSufficient = boldAmount.parsed && boldBalance.data && dn.lte(boldAmount.parsed, boldBalance.data);
  const hasSelectedTroves = selection && selection.selectedTroves.length > 0;
  const allowSubmit = account.isConnected
    && amountNonZero
    && balanceSufficient
    && hasSelectedTroves
    && shutdownBranches.length > 0;

  if (shutdownStatus.isSuccess && shutdownBranches.length === 0) {
    return (
      <Screen
        heading={{
          title: content.urgentRedeemScreen.headingTitle,
        }}
      >
        <VFlex gap={24}>
          <NoShutdownMessage />
        </VFlex>
      </Screen>
    );
  }

  const noRedeemableTroves = trovesQuery.isSuccess && trovesQuery.data.length === 0;

  const tokenName = collToken?.symbol === "ETH" ? "WETH" : collToken?.name ?? "";

  return (
    <Screen
      heading={{
        title: (
          <HFlex>
            {content.urgentRedeemScreen.headingTitleActive}
            {collToken && <TokenIcon symbol={collToken.symbol} />}
          </HFlex>
        ),
      }}
    >
      <VFlex gap={48}>
        {shutdownBranches.length > 1 && (
          <Field
            label={content.urgentRedeemScreen.selectBranchLabel}
            field={
              <Tabs
                items={shutdownBranches.map((b) => {
                  const symbol = getBranch(b.branchId).symbol;
                  return {
                    label: symbol,
                    panelId: `branch-${symbol}`,
                    tabId: `tab-${symbol}`,
                  };
                })}
                selected={shutdownBranches.findIndex((b) => getBranch(b.branchId)?.symbol === activeBranchSymbol)}
                onSelect={(index) => {
                  const branch = shutdownBranches[index];
                  if (branch) {
                    setSelectedBranchSymbol(getBranch(branch.branchId)?.symbol ?? null);
                    setSelectedTroveIds(new Set());
                    setIsManualMode(false);
                  }
                }}
              />
            }
          />
        )}

        {noRedeemableTroves ? <NoTrovesMessage /> : (
          <>
            <Field
              field={
                <InputField
                  id="input-urgent-redeem-amount"
                  label={content.urgentRedeemScreen.redeemFieldLabel}
                  contextual={
                    <InputField.Badge
                      icon={<TokenIcon symbol="BOLD" />}
                      label="BOLD"
                    />
                  }
                  drawer={boldAmount.isFocused || !account.isConnected
                    ? null
                    : !balanceSufficient && boldAmount.parsed
                    ? {
                      mode: "error",
                      message: content.urgentRedeemScreen.insufficientBalance(fmtnum(boldBalance.data)),
                    }
                    : autoCappedTo
                    ? {
                      mode: "warning",
                      message: content.urgentRedeemScreen.amountCapped(fmtnum(autoCappedTo)),
                    }
                    : null}
                  placeholder="0.00"
                  secondary={{
                    start: fmtnum(boldRedeemedUsd, { prefix: "$", preset: "2z" }) || " ",
                    end: (
                      boldBalance.data && dn.gt(boldBalance.data, 0) && (
                        <TextButton
                          label={`Max ${fmtnum(boldBalance.data)} BOLD`}
                          onClick={() => {
                            if (boldBalance.data) {
                              boldAmount.setValue(dn.toString(boldBalance.data));
                            }
                          }}
                        />
                      )
                    ),
                  }}
                  {...boldAmount.inputFieldProps}
                />
              }
            />

            <VFlex gap={16}>
              <HFlex justifyContent="space-between" alignItems="center">
                <div>{content.urgentRedeemScreen.youReceive}</div>
                <VFlex alignItems="flex-end" gap={0}>
                  <HFlex gap={6} className={css({ fontSize: 20 })}>
                    <Amount
                      format="4z"
                      value={redemptionOutput?.collateral}
                      fallback="−"
                      title={{ suffix: ` ${tokenName}` }}
                    />
                    {collToken && <TokenIcon symbol={collToken.symbol} size={24} />}
                  </HFlex>
                  <div className={css({ color: "contentAlt", fontSize: 14 })}>
                    <Amount
                      format="2z"
                      prefix="$"
                      value={redemptionOutput?.collateralUsd}
                      fallback="−"
                    />
                    {price.data && (
                      <span className={css({ color: "contentAlt2" })}>
                        {" "}@ ${fmtnum(price.data)}/{tokenName}
                      </span>
                    )}
                  </div>
                </VFlex>
              </HFlex>

              <HFlex justifyContent="space-between" alignItems="center">
                <HFlex gap={4} className={css({ color: "contentAlt" })}>
                  {redemptionOutput?.isBonusCapped
                    ? content.urgentRedeemScreen.bonusCappedLabel
                    : content.urgentRedeemScreen.bonusLabel}
                  <InfoTooltip>
                    {redemptionOutput?.isBonusCapped
                      ? content.urgentRedeemScreen.bonusCappedTooltip
                      : content.urgentRedeemScreen.bonusTooltip}
                  </InfoTooltip>
                </HFlex>
                <VFlex alignItems="flex-end" gap={0}>
                  <HFlex gap={6} className={css({ fontSize: 20, color: "contentAlt" })}>
                    <Amount
                      format="4z"
                      value={redemptionOutput?.bonus}
                      fallback="−"
                      title={{ suffix: ` ${tokenName}` }}
                    />
                    {collToken && <TokenIcon symbol={collToken.symbol} size={24} />}
                  </HFlex>
                  <div className={css({ color: "contentAlt", fontSize: 14 })}>
                    <Amount
                      format="2z"
                      prefix="$"
                      value={redemptionOutput?.bonusUsd}
                      fallback="−"
                    />
                  </div>
                </VFlex>
              </HFlex>

              <HFlex justifyContent="space-between" alignItems="center">
                <HFlex gap={4}>
                  {content.urgentRedeemScreen.slippageTolerance}
                </HFlex>
                <HFlex gap={2} alignItems="center" className={css({ fontSize: 14 })}>
                  <input
                    id="input-custom-slippage"
                    ref={slippageInput.inputFieldProps.ref}
                    value={slippageInput.inputFieldProps.value}
                    onBlur={slippageInput.inputFieldProps.onBlur}
                    onFocus={slippageInput.inputFieldProps.onFocus}
                    onChange={(e) => slippageInput.inputFieldProps.onChange(e.target.value)}
                    className={css({
                      width: 48,
                      padding: "6px 8px",
                      fontSize: 14,
                      textAlign: "center",
                      background: "fieldSurface",
                      border: "1px solid token(colors.fieldBorder)",
                      borderRadius: 8,
                      outline: "none",
                      color: "inherit",
                      _focus: {
                        borderColor: "fieldBorderFocused",
                      },
                    })}
                  />
                  <div>%</div>
                </HFlex>
              </HFlex>
            </VFlex>

            <InfoBox>
              {content.urgentRedeemScreen.competitionWarning}
            </InfoBox>

            <Field
              label={
                <HFlex justifyContent="space-between" alignItems="center">
                  <div>
                    {isManualMode
                      ? content.urgentRedeemScreen.manualTrovesLabel
                      : content.urgentRedeemScreen.autoTrovesLabel}
                  </div>
                  <TextButton
                    label={isManualMode
                      ? content.urgentRedeemScreen.useAutoSelection
                      : content.urgentRedeemScreen.manuallySelectTroves}
                    onClick={() => {
                      setIsManualMode(!isManualMode);
                      if (!isManualMode) {
                        setSelectedTroveIds(new Set(selection?.selectedTroves.map((t) => t.troveId) ?? []));
                      }
                    }}
                  />
                </HFlex>
              }
              field={isManualMode
                ? (
                  <TroveSelectionTable
                    troves={trovesWithICR}
                    selectedTroveIds={selectedTroveIds}
                    onSelectionChange={setSelectedTroveIds}
                  />
                )
                : selection
                ? (
                  <div className={css({ color: "contentAlt", fontSize: 14 })}>
                    {content.urgentRedeemScreen.trovesCount(selection.selectedTroves.length)}
                  </div>
                )
                : null}
            />

            <FlowButton
              disabled={!allowSubmit}
              label={content.urgentRedeemScreen.action}
              request={{
                flowId: "urgentRedemption",
                backLink: ["/redeem/urgent", content.urgentRedeemScreen.backLink],
                successLink: ["/", content.urgentRedeemScreen.successLink],
                successMessage: content.urgentRedeemScreen.successMessage,

                branchId: activeBranch?.branchId ?? 0,
                boldAmount: selection?.actualBoldToRedeem ?? DNUM_0,
                troveIds: selection?.selectedTroves.map((t) => t.troveId) ?? [],
                minCollateral: minCollateral ?? DNUM_0,
                expectedCollateral: redemptionOutput?.collateral ?? DNUM_0,
                slippagePct: slippage,
              }}
            />
          </>
        )}
      </VFlex>
    </Screen>
  );
}

function NoShutdownMessage() {
  return (
    <InfoBox title={content.urgentRedeemScreen.noShutdown.title}>
      {content.urgentRedeemScreen.noShutdown.body}
      <LinkTextButton
        href="/redeem"
        label={content.urgentRedeemScreen.noShutdown.link}
      />
    </InfoBox>
  );
}

function NoTrovesMessage() {
  return (
    <InfoBox title={content.urgentRedeemScreen.noTroves.title}>
      {content.urgentRedeemScreen.noTroves.body}
    </InfoBox>
  );
}
