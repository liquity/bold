import type { CollateralToken, Drawer } from "@liquity2/uikit";
import type { Dnum } from "dnum";
import type { ComponentPropsWithoutRef } from "react";

import { useBreakpointName } from "@/src/breakpoints";
import {
  LEVERAGE_FACTOR_MIN,
  LEVERAGE_FACTOR_PRECISION,
  LEVERAGE_SLIPPAGE_TOLERANCE,
  LTV_RISK,
  MAX_LTV_ALLOWED_RATIO,
  MIN_DEBT,
} from "@/src/constants";
import content from "@/src/content";
import { DNUM_0, DNUM_1, dnumNeg } from "@/src/dnum-utils";
import { type InputFieldUpdateData, useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { useQuoteExactInput, useQuoteExactOutput } from "@/src/liquity-leverage";
import {
  getLeverageFactorFromLiquidationPrice,
  getLeverageFactorFromLtv,
  getLiquidationPrice,
  getLiquidationPriceFromLeverage,
  getLiquidationRisk,
  getLtv,
  getLtvFromLeverageFactor,
  roundLeverageFactor,
} from "@/src/liquity-math";
import { infoTooltipProps } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import { HFlex, InfoTooltip, InputField, lerp, norm, Slider } from "@liquity2/uikit";
import * as dn from "dnum";
import { useCallback, useEffect, useMemo, useState } from "react";

export function LeverageField({
  collPrice,
  collToken,
  debt,
  drawer,
  inputId,
  leverageFactor,
  liquidationPriceInputFieldProps,
  liquidationRisk,
  sliderProps,
}: ReturnType<typeof useLeverageField> & {
  disabled?: boolean;
  drawer?: ComponentPropsWithoutRef<typeof InputField>["drawer"];
  inputId: string;
}) {
  const breakpoint = useBreakpointName();
  console.log("breakpoint", breakpoint);

  return (
    <InputField
      id={inputId}
      secondarySpacing={16}
      drawer={drawer}
      contextual={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: breakpoint === "small" ? 150 : 260,
          }}
        >
          <Slider {...sliderProps} />
        </div>
      }
      label={{
        start: content.leverageScreen.liquidationPriceField.label,
        end: (
          <div>
            Debt {!debt ? "−" : (
              <>
                <span
                  className={css({
                    fontVariantNumeric: "tabular-nums",
                  })}
                >
                  {fmtnum(debt)}
                </span>
                {" BOLD"}
              </>
            )}
          </div>
        ),
      }}
      placeholder="0.00"
      secondary={{
        start: (
          <span>
            {collToken.name} price{" "}
            <span
              className={css({
                color: "content",
              })}
            >
              {fmtnum(collPrice, { preset: "2z", prefix: "$" })}
            </span>
          </span>
        ),
        end: (
          <HFlex gap={8}>
            Multiply {
              <span
                style={{
                  color: liquidationRisk === "high"
                    ? "#F36740"
                    : "#2F3037",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtnum(leverageFactor, "1z")}x
              </span>
            }
            <InfoTooltip {...infoTooltipProps(content.leverageScreen.infoTooltips.leverageLevel)} />
          </HFlex>
        ),
      }}
      {...liquidationPriceInputFieldProps}
    />
  );
}

function formatLiquidationPrice(value: Dnum) {
  return fmtnum(value, { dust: false, prefix: "$ ", preset: "2z" });
}

export function useLeverageField({
  collPrice,
  collToken,
  positionDeposit,
  positionDebt,
  maxLtvAllowedRatio = MAX_LTV_ALLOWED_RATIO,
  defaultLeverageFactorAdjustment = 0,
}: {
  collPrice: Dnum | null;
  collToken: CollateralToken;
  positionDeposit: Dnum | null;
  positionDebt: Dnum;
  maxLtvAllowedRatio?: number;
  defaultLeverageFactorAdjustment?: number;
}) {
  const { collateralRatio } = collToken;

  const maxLtv = dn.from(1 / collateralRatio, 18);
  const maxLtvAllowed = dn.mul(maxLtv, maxLtvAllowedRatio);
  const maxLeverageFactorAllowed = getLeverageFactorFromLtv(maxLtvAllowed);
  const netDeposit = positionDeposit && collPrice && dn.sub(positionDeposit, dn.div(positionDebt, collPrice));

  const leverageFactorBeforeAdjustment = dn.toNumber(
    positionDeposit && netDeposit && !dn.eq(netDeposit, DNUM_0)
      ? dn.div(positionDeposit, netDeposit)
      : DNUM_1,
  );

  const clampLeverageFactor = useCallback(
    (leverageFactor: number) => Math.min(Math.max(leverageFactor, LEVERAGE_FACTOR_MIN), maxLeverageFactorAllowed),
    [maxLeverageFactorAllowed],
  );

  const [leverageFactorAdjustment, setLeverageFactorAdjustment] = useState(defaultLeverageFactorAdjustment);
  const leverageFactor = clampLeverageFactor(leverageFactorBeforeAdjustment + leverageFactorAdjustment);
  const leverageFactorChange = leverageFactor - leverageFactorBeforeAdjustment;
  const depositChange = netDeposit && dn.mul(netDeposit, leverageFactorChange);
  const idealDebtChange = depositChange && dn.mul(depositChange, collPrice);
  const slippageProtection = depositChange && dn.mul(depositChange, LEVERAGE_SLIPPAGE_TOLERANCE);
  const deposit = depositChange && dn.add(positionDeposit, depositChange);

  const quoteLeverUp = useQuoteExactOutput({
    inputToken: "BOLD",
    outputToken: collToken.symbol,
    outputAmount: leverageFactorChange > 0 && slippageProtection ? dn.add(depositChange, slippageProtection) : DNUM_0,
  });

  const quoteLeverDown = useQuoteExactInput({
    inputToken: collToken.symbol,
    outputToken: "BOLD",
    inputAmount: leverageFactorChange < 0 && depositChange ? dn.abs(depositChange) : DNUM_0,
  });

  const quoteData = leverageFactorChange === 0 ? null : (
    leverageFactorChange > 0
      ? quoteLeverUp
      : quoteLeverDown
  ).data;

  // undefined: loading or not applicable (no leverage change)
  // null: loaded, but the quote failed due to lack of liquidity
  const quoteAmount = leverageFactorChange === 0 ? undefined : (
    leverageFactorChange > 0
      ? quoteLeverUp.data?.inputAmount
      : quoteLeverDown.data?.outputAmount
  );

  const actualDebtChange = leverageFactorChange === 0 ? DNUM_0 : (
    !quoteData?.bouncing && (
        leverageFactorChange > 0
          ? quoteAmount
          : quoteAmount && dnumNeg(quoteAmount)
      )
    || null
  );

  const priceImpact = quoteData?.priceImpact ?? null;
  const debtChange = actualDebtChange ?? idealDebtChange;
  const debt = debtChange && dn.add(positionDebt, debtChange);
  const ltv = (deposit && debt && getLtv(deposit, debt, collPrice)) ?? getLtvFromLeverageFactor(leverageFactor);
  const liquidationRisk = ltv && getLiquidationRisk(ltv, maxLtv);
  const liquidationPrice = (deposit && debt && getLiquidationPrice(deposit, debt, collateralRatio))
    ?? (collPrice && getLiquidationPriceFromLeverage(leverageFactor, collPrice, collateralRatio));

  const setLeverageFactor = useCallback(
    (leverageFactor: number) => {
      setLeverageFactorAdjustment(roundLeverageFactor(leverageFactor - leverageFactorBeforeAdjustment));
    },
    [leverageFactorBeforeAdjustment],
  );

  const {
    setValue: setLiquidationPriceInputValue,
    inputFieldProps: liquidationPriceInputFieldProps,
    isFocused: liquidationPriceFocused,
  } = useInputFieldValue(
    formatLiquidationPrice,
    {
      onChange: useCallback(({ focused, parsed }: InputFieldUpdateData) => {
        if (focused && parsed && collPrice) {
          setLeverageFactor(
            getLeverageFactorFromLiquidationPrice(parsed, collPrice, collateralRatio)
              ?? maxLeverageFactorAllowed,
          );
        }
      }, [collPrice, collateralRatio, maxLeverageFactorAllowed, setLeverageFactor]),
    },
  );

  const liquidationPriceInputValue = liquidationPrice && dn.toString(liquidationPrice, 2);

  useEffect(() => {
    if (!liquidationPriceFocused && liquidationPriceInputValue !== null) {
      setLiquidationPriceInputValue(liquidationPriceInputValue);
    }
  }, [liquidationPriceFocused, liquidationPriceInputValue, setLiquidationPriceInputValue]);

  const sliderValue = norm(leverageFactor, LEVERAGE_FACTOR_MIN, maxLeverageFactorAllowed);
  const keyboardStepSize = LEVERAGE_FACTOR_PRECISION / (maxLeverageFactorAllowed - LEVERAGE_FACTOR_MIN);

  const sliderGradient = useMemo((): [number, number] => [
    norm(getLeverageFactorFromLtv(dn.mul(maxLtv, LTV_RISK.medium)), LEVERAGE_FACTOR_MIN, maxLeverageFactorAllowed),
    norm(getLeverageFactorFromLtv(dn.mul(maxLtv, LTV_RISK.high)), LEVERAGE_FACTOR_MIN, maxLeverageFactorAllowed),
  ], [maxLtv, maxLeverageFactorAllowed]);

  const onSliderChange = useCallback((value: number) => {
    setLeverageFactor(lerp(LEVERAGE_FACTOR_MIN, maxLeverageFactorAllowed, value));
  }, [maxLeverageFactorAllowed, setLeverageFactor]);

  const keyboardStep = useCallback(
    (value: number, direction: -1 | 1) => value + direction * keyboardStepSize,
    [keyboardStepSize],
  );

  const sliderProps = useMemo(() => ({
    value: sliderValue,
    gradient: sliderGradient,
    onChange: onSliderChange,
    keyboardStep,
  }), [sliderValue, sliderGradient, onSliderChange, keyboardStep]);

  const drawer: Drawer | null = deposit && dn.gt(deposit, DNUM_0) && debt && dn.lt(debt, MIN_DEBT)
    ? { mode: "error", message: `Debt must be at least ${fmtnum(MIN_DEBT, 2)} JPYDF.` }
    : quoteAmount === null
    ? { mode: "error", message: `Not enough ${collToken.name} liquidity to reach your chosen exposure.` }
    : null;

  const isValid = !drawer
    && collPrice
    && (
      quoteData === null
      || quoteData?.bouncing === false
    );

  return {
    collPrice,
    collToken,
    debt,
    debtChange,
    deposit,
    depositChange,
    drawer,
    isValid,
    leverageFactor,
    leverageFactorChange,
    liquidationPriceInputFieldProps,
    liquidationRisk,
    ltv,
    maxLtv,
    priceImpact,
    sliderProps,
    slippageProtection,
  };
}
