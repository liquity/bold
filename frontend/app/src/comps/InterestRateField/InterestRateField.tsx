import type { Address, BranchId, Delegate, PositionLoanCommitted } from "@/src/types";
import type { Dnum } from "dnum";

import { useAppear } from "@/src/anim-utils";
import { useBreakpointName } from "@/src/breakpoints";
import { INTEREST_RATE_MAX, INTEREST_RATE_START, REDEMPTION_RISK } from "@/src/constants";
import content from "@/src/content";
import { DNUM_0, jsonStringifyWithDnum } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { useDelegateDisplayName } from "@/src/liquity-delegate";
import { getRedemptionRisk } from "@/src/liquity-math";
import {
  EMPTY_LOAN,
  findClosestRateIndex,
  useAverageInterestRate,
  useDebtInFrontOfInterestRate,
  useDebtInFrontOfLoan,
  useInterestRateChartData,
  useSubgraphIsDown
} from "@/src/liquity-utils";
import { infoTooltipProps } from "@/src/uikit-utils";
import { noop } from "@/src/utils";
import { css } from "@/styled-system/css";
import { Dropdown, InfoTooltip, InputField, shortenAddress, Slider, TextButton } from "@liquity2/uikit";
import { a } from "@react-spring/web";
import { blo } from "blo";
import * as dn from "dnum";
import Image from "next/image";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { match } from "ts-pattern";
import { DelegateModal } from "./DelegateModal";
import { MiniChart } from "./MiniChart";

const DELEGATE_MODES = [
  "manual",
  "delegate",
] as const;

export type DelegateMode = typeof DELEGATE_MODES[number];

const SHOW_AVERAGE_BUTTON_MODES: DelegateMode[] = [
  "manual",
] as const;

export const InterestRateField = memo(
  function InterestRateField({
    branchId,
    debt,
    delegate,
    inputId: inputIdFromProps,
    interestRate,
    mode,
    onAverageInterestRateLoad = noop,
    onChange,
    onDelegateChange,
    onModeChange = noop,
    loan,
  }: {
    branchId: BranchId;
    debt: Dnum | null;
    delegate: Address | null;
    inputId?: string;
    interestRate: Dnum | null;
    mode: DelegateMode;
    // XXX why is average interest rate loaded inside this component and not the parent?
    onAverageInterestRateLoad?: (averageInterestRate: Dnum, setValue: (value: string) => void) => void;
    onChange: (interestRate: Dnum) => void;
    onDelegateChange: (delegate: Address | null) => void;
    onModeChange?: (mode: DelegateMode) => void;
    loan?: PositionLoanCommitted;
  }) {
    const [delegatePicker, setDelegatePicker] = useState<
      "delegate" | null
    >(null);

    const delegateDisplayName = useDelegateDisplayName(delegate);

    const autoInputId = useId();
    const inputId = inputIdFromProps ?? autoInputId;

    const averageInterestRate = useAverageInterestRate(branchId);

    const rateTouchedForBranch = useRef<
      | null // rate not touched for this branch, average rate should be applied
      | BranchId // rate touched for this branch, not applying the average rate
    >(null);

    if (rateTouchedForBranch.current !== branchId) {
      rateTouchedForBranch.current = null;
    }

    useEffect(() => {
      let cancelled = false;
      if (rateTouchedForBranch.current === null && averageInterestRate.data) {
        rateTouchedForBranch.current = branchId;
        setTimeout(() => {
          if (averageInterestRate.data && !cancelled) {
            onAverageInterestRateLoad(averageInterestRate.data, fieldValue.setValue);
          }
        }, 0);
        return () => {
          cancelled = true;
        };
      }
    }, [
      averageInterestRate.data,
      branchId,
      onAverageInterestRateLoad,
    ]);

    useEffect(() => {
      setDelegatePicker(null);
      if (!delegate) {
        onDelegateChange(null);
        onModeChange("manual");
      }
    }, [
      branchId,
      delegate,
      onDelegateChange,
      onModeChange,
    ]);

    const fieldValue = useInputFieldValue((value) => `${fmtnum(value)}%`, {
      defaultValue: interestRate ? dn.toString(dn.mul(interestRate, 100)) : undefined,

      onFocusChange: ({ parsed, focused }) => {
        if (!focused && parsed) {
          if (dn.lt(parsed, INTEREST_RATE_START * 100)) fieldValue.setValue(String(INTEREST_RATE_START * 100));
          if (dn.gt(parsed, INTEREST_RATE_MAX * 100)) fieldValue.setValue(String(INTEREST_RATE_MAX * 100));
        }
      },

      onChange: ({ parsed }) => {
        if (parsed) {
          rateTouchedForBranch.current = branchId;
          onChange(dn.div(parsed, 100));
        }
      },
    });

    const interestChartData = useInterestRateChartData(branchId, loan);
    const debtInFrontOfLoan = useDebtInFrontOfLoan(loan ?? EMPTY_LOAN);
    const debtInFrontOfInterestRate = useDebtInFrontOfInterestRate(branchId, interestRate ?? DNUM_0, loan);

    // When a loan exists already and the selected interest rate is the same as the existing interest rate
    // (for example as in the initial state after navigating to the interest rate panel)
    // show the current precise debt-in-front of the loan.
    // This is useful for checking how far the loan is from redemption (beyond just checking the risk level).
    // If the loan is not redeemable, e.g. because it has been fully redeemed, we revert to debt-in-front
    // based on interest rate (i.e. the debt that would be in front of the position if it were to be made
    // active again at its current interest rate).
    const debtInFront = loan && interestRate && dn.eq(loan.interestRate, interestRate)
      ? debtInFrontOfLoan.data && (
        debtInFrontOfLoan.data.debtInFront
          ? debtInFrontOfLoan.data // redeemable (debtInFront not null)
          : debtInFrontOfInterestRate.data // not redeemable (debtInFront is null)
      )
      : debtInFrontOfInterestRate.data;

    const redemptionRisk = debtInFront
      && getRedemptionRisk(debtInFront.debtInFront, debtInFront.totalDebt);
    const redeemableTransition = useAppear(debtInFront !== undefined);

    const handleDelegateSelect = (delegate: Delegate) => {
      setDelegatePicker(null);
      fieldValue.setValue(dn.toString(dn.mul(delegate.interestRate, 100)));
      onDelegateChange(delegate.address ?? null);
    };

    const activeDelegateModes = DELEGATE_MODES;

    const boldInterestPerYear = interestRate && debt && dn.mul(interestRate, debt);

    const breakpoint = useBreakpointName();

    return (
      <>
        <InputField
          id={inputId}
          labelHeight={32}
          labelSpacing={24}
          disabled={mode !== "manual"}
          contextual={match(mode)
            .with("manual", () => (
              <ManualInterestRateSlider
                interestChartData={interestChartData}
                interestRate={interestRate}
                fieldValue={fieldValue}
                handleColor={redemptionRisk && (
                  redemptionRisk === "high"
                    ? 0
                    : redemptionRisk === "medium"
                    ? 1
                    : 2
                )}
              />
            ))
            .with("delegate", () => (
              <TextButton
                size="large"
                title={delegate ?? undefined}
                label={delegate
                  ? (
                    <div
                      title={delegate}
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 20,
                      })}
                    >
                      <Image
                        alt=""
                        width={24}
                        height={24}
                        src={blo(delegate)}
                        className={css({
                          display: "block",
                          borderRadius: 4,
                        })}
                      />
                      {(() => {
                        const displayName = delegateDisplayName || shortenAddress(delegate, 4).toLowerCase();
                        return breakpoint === "small" && displayName.length > 16
                          ? displayName.substring(0, 16) + "..."
                          : displayName;
                      })()}
                    </div>
                  )
                  : "Choose delegate"}
                onClick={() => {
                  setDelegatePicker("delegate");
                }}
              />
            ))
            .exhaustive()}
          label={{
            start: (
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                })}
              >
                <div>Interest rate</div>
                {averageInterestRate.data && SHOW_AVERAGE_BUTTON_MODES.includes(mode) && (
                  <div>
                    <TextButton
                      size="small"
                      title={`Set average interest rate (${
                        fmtnum(averageInterestRate.data, {
                          preset: "pct2z",
                          suffix: "%",
                        })
                      })`}
                      label={`(avg. ${
                        fmtnum(averageInterestRate.data, {
                          preset: "pct2z",
                          suffix: "%",
                        })
                      })`}
                      onClick={(event) => {
                        if (averageInterestRate.data) {
                          event.preventDefault();
                          const rounded = dn.div(dn.round(dn.mul(averageInterestRate.data, 1e4)), 1e4);
                          fieldValue.setValue(dn.toString(dn.mul(rounded, 100)));
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            ),
            end: (
              <div>
                <Dropdown
                  items={activeDelegateModes.map(
                    (mode) => content.interestRateField.delegateModes[mode],
                  )}
                  menuWidth={300}
                  menuPlacement="end"
                  onSelect={(index) => {
                    const mode = activeDelegateModes[index];
                    if (mode) {
                      onModeChange(mode);
                    }
                    onDelegateChange(null);
                  }}
                  selected={activeDelegateModes.findIndex((mode_) => mode_ === mode)}
                  size="small"
                />
              </div>
            ),
          }}
          placeholder="0.00"
          secondary={{
            start: (
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  minWidth: 120,
                  userSelect: "none",
                })}
              >
                <div
                  className={css({
                    minWidth: 0,
                    flexShrink: 1,
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  })}
                >
                  {boldInterestPerYear && (mode === "manual" || delegate !== null)
                    ? fmtnum(boldInterestPerYear, breakpoint === "small" ? "compact" : "2z")
                    : "−"} BOLD / year
                </div>
                <InfoTooltip {...infoTooltipProps(content.generalInfotooltips.interestRateBoldPerYear)} />
              </div>
            ),
            end: redeemableTransition((style, show) => (
              show && (
                <a.div
                  title={`Redeemable before you: ${
                    (mode === "manual" || delegate !== null)
                      ? fmtnum(debtInFront?.debtInFront, "compact")
                      : "−"
                  } BOLD`}
                  className={css({
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    userSelect: "none",
                  })}
                  style={style}
                >
                  <span>
                    {breakpoint === "large" ? "Redeemable before you: " : "Red. before: "}
                    <span
                      className={css({
                        fontVariantNumeric: "tabular-nums",
                      })}
                    >
                      {(mode === "manual" || delegate !== null)
                        ? fmtnum(debtInFront?.debtInFront, "compact")
                        : "−"}
                    </span>
                    {breakpoint === "large" && <span>{" BOLD"}</span>}
                  </span>
                </a.div>
              )
            )),
          }}
          {...fieldValue.inputFieldProps}
          value={
            // no delegate selected yet
            (mode !== "manual" && delegate === null)
              ? ""
              : fieldValue.value
          }
          valueUnfocused={
            // delegate mode, but no delegate selected yet
            (mode !== "manual" && delegate === null)
              ? null
              : <>{!fieldValue.isEmpty && fieldValue.parsed && interestRate}</>
              ? (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {delegate !== null && breakpoint === "large" && <MiniChart size="medium" />}
                  <span
                    style={{
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {(mode === "manual" || delegate !== null) && fmtnum(
                      interestRate,
                      "pct2z",
                    )}
                  </span>
                  <span
                    className={css({
                      color: "#878AA4",
                      fontSize: {
                        base: 20,
                        large: 24,
                      },
                    })}
                  >
                    %
                  </span>
                </span>
              )
              : null
          }
        />
        <DelegateModal
          branchId={branchId}
          onClose={() => {
            setDelegatePicker(null);
          }}
          onSelectDelegate={handleDelegateSelect}
          visible={delegatePicker === "delegate"}
        />
      </>
    );
  },
  (prev, next) => (
    jsonStringifyWithDnum(prev) === jsonStringifyWithDnum(next)
  ),
);

function ManualInterestRateSlider({
  fieldValue,
  handleColor,
  interestChartData,
  interestRate,
}: Pick<Parameters<typeof Slider>[0], "handleColor"> & {
  fieldValue: ReturnType<typeof useInputFieldValue>;
  interestChartData: ReturnType<typeof useInterestRateChartData>;
  interestRate: Dnum | null;
}) {
  const rateToSliderPosition = useCallback((rate: bigint, chartRates: bigint[]) => {
    if (!rate || !chartRates || chartRates.length === 0) return 0;

    const firstRate = chartRates.at(0) ?? 0n;
    if (rate <= firstRate) return 0;

    const lastRate = chartRates.at(-1) ?? 0n;
    if (rate >= lastRate) return 1;

    return findClosestRateIndex(chartRates, rate) / chartRates.length;
  }, []);

  const subgraphIsDown = useSubgraphIsDown();

  const value = useMemo(() => {
    const rate = interestRate?.[0] ?? 0n;
    const chartRates = interestChartData.data?.map(({ rate }) => rate[0]);
    if (!chartRates) return 0;

    return rateToSliderPosition(rate, chartRates);
  }, [
    jsonStringifyWithDnum(interestChartData.data),
    jsonStringifyWithDnum(interestRate),
    rateToSliderPosition,
  ]);

  const gradientStops = useMemo((): [
    medium: number,
    low: number,
  ] => {
    if (!interestChartData.data || interestChartData.data.length === 0) {
      return [0, 0];
    }

    const totalDebt = interestChartData.data.reduce(
      (sum, item) => dn.add(sum, item.debt),
      DNUM_0,
    );

    if (dn.eq(totalDebt, 0)) {
      return [0, 0];
    }

    // find exact rates where debt positioning crosses thresholds
    let mediumThresholdRate = null;
    let lowThresholdRate = null;

    for (const [index, item] of interestChartData.data.entries()) {
      const prevItem = index > 0 ? interestChartData.data[index - 1] : null;
      const prevRate = prevItem?.rate[0] ?? null;

      const debtInFrontRatio = dn.div(item.debtInFront, totalDebt);

      // place boundary at the rate before crossing threshold (so slider changes at the right position)
      if (dn.gt(debtInFrontRatio, REDEMPTION_RISK.medium) && !mediumThresholdRate) {
        mediumThresholdRate = prevRate;
      }

      if (dn.gt(debtInFrontRatio, REDEMPTION_RISK.low) && !lowThresholdRate) {
        lowThresholdRate = prevRate;
        // low threshold found: no need to continue
        break;
      }
    }

    const chartRates = interestChartData.data.map(({ rate }) => rate[0]);
    return [
      mediumThresholdRate ? rateToSliderPosition(mediumThresholdRate, chartRates) : 0,
      lowThresholdRate ? rateToSliderPosition(lowThresholdRate, chartRates) : 0,
    ];
  }, [interestChartData.data, rateToSliderPosition]);

  const transition = useAppear(value !== -1 && !subgraphIsDown);

  const breakpoint = useBreakpointName();

  return transition((style, show) =>
    show && (
      <a.div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: breakpoint === "small" ? 200 : 260,
          paddingTop: 16,
          ...style,
        }}
      >
        <Slider
          gradient={gradientStops}
          gradientMode="high-to-low"
          handleColor={handleColor}
          chart={interestChartData.data?.map(({ size }) => size) ?? []}
          onChange={(value) => {
            if (interestChartData.data) {
              const index = Math.round(value * (interestChartData.data.length - 1));
              fieldValue.setValue(dn.toString(dn.mul(interestChartData.data[index]?.rate ?? DNUM_0, 100)));
            }
          }}
          value={value}
        />
      </a.div>
    )
  );
}
