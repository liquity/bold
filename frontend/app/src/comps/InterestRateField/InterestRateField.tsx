import type { Address, BranchId, Delegate, PositionLoanCommitted } from "@/src/types";
import type { Dnum } from "dnum";

import { useAppear } from "@/src/anim-utils";
import { useBreakpointName } from "@/src/breakpoints";
import { INTEREST_RATE_MAX, INTEREST_RATE_START, REDEMPTION_RISK } from "@/src/constants";
import content from "@/src/content";
import { DNUM_0, jsonStringifyWithDnum, roundTo4Decimals } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import type { DelegateMode } from "@/src/liquity-delegate";
import { getDefaultDelegate, HAS_DEFAULT_DELEGATE, useDelegateDisplayName, useDelegateGroupName, useDelegateStrategyName, useKnownDelegates } from "@/src/liquity-delegate";
import { getRedemptionRisk } from "@/src/liquity-math";
import {
  EMPTY_LOAN,
  findClosestRateIndex,
  useAverageInterestRate,
  useDebtInFrontOfInterestRate,
  useDebtInFrontOfLoan,
  useInterestBatchDelegate,
  useInterestRateChartData,
} from "@/src/liquity-utils";
import { useSubgraphIsDown } from "@/src/indicators/subgraph-indicator";
import { noop } from "@/src/utils";
import { css } from "@/styled-system/css";
import {
  InfoTooltip,
  InputField,
  Modal,
  shortenAddress,
  Slider,
  Tabs,
  TextButton,
} from "@liquity2/uikit";
import { a } from "@react-spring/web";
import { blo } from "blo";
import * as dn from "dnum";
import Image from "next/image";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { DelegateBox } from "./DelegateBox";
import { DelegateModal } from "./DelegateModal";
import { MiniChart } from "./MiniChart";

const rateFormatter = (value: Dnum) => `${fmtnum(value)}%`;

function clampRateValue(setValue: (v: string) => void, parsed: Dnum) {
  if (dn.lt(parsed, INTEREST_RATE_START * 100)) setValue(String(INTEREST_RATE_START * 100));
  if (dn.gt(parsed, INTEREST_RATE_MAX * 100)) setValue(String(INTEREST_RATE_MAX * 100));
}

export const InterestRateField = memo(
  function InterestRateField({
    branchId,
    delegate,
    inputId: inputIdFromProps,
    interestRate,
    mode,
    onChange,
    onDelegateChange,
    onModeChange = noop,
    loan,
  }: {
    branchId: BranchId;
    delegate: Address | null;
    inputId?: string;
    interestRate: Dnum | null;
    mode: DelegateMode;
    onChange: (interestRate: Dnum) => void;
    onDelegateChange: (delegate: Address | null) => void;
    onModeChange?: (mode: DelegateMode) => void;
    loan?: PositionLoanCommitted;
  }) {
    const [isDelegatePickerOpen, setDelegatePickerOpen] = useState(false);
    const [delegateInfoVisible, setDelegateInfoVisible] = useState(false);

    const delegateStrategyName = useDelegateStrategyName(delegate);
    const delegateGroupName = useDelegateGroupName(delegate);
    const delegateDisplayName = useDelegateDisplayName(delegate);
    const knownDelegates = useKnownDelegates();
    const autoInputId = useId();
    const inputId = inputIdFromProps ?? autoInputId;

    const averageInterestRate = useAverageInterestRate(branchId);

    const delegateData = useInterestBatchDelegate(
      branchId,
      mode === "delegate" ? delegate : null,
    );

    const manualFieldBranchRef = useRef<BranchId | null>(null);

    useEffect(() => {
      setDelegatePickerOpen(false);
      onDelegateChange(getDefaultDelegate(branchId));
    }, [
      branchId,
      onDelegateChange,
    ]);

    const handleFieldChange = useCallback(({ parsed }: { parsed: Dnum | null }) => {
      if (parsed) onChange(dn.div(parsed, 100));
    }, [onChange]);

    const fieldValue = useInputFieldValue(rateFormatter, {
      defaultValue: interestRate ? dn.toString(dn.mul(interestRate, 100)) : undefined,
      onFocusChange: ({ parsed, focused }) => {
        if (!focused && parsed) clampRateValue(fieldValue.setValue, parsed);
      },
      onChange: handleFieldChange,
    });

    const handleManualFieldChange = useCallback(({ parsed }: { parsed: Dnum | null }) => {
      if (parsed && mode === "manual") onChange(dn.div(parsed, 100));
    }, [mode, onChange]);

    const manualFieldValue = useInputFieldValue(rateFormatter, {
      onFocusChange: ({ parsed, focused }) => {
        if (!focused && parsed) clampRateValue(manualFieldValue.setValue, parsed);
      },
      onChange: handleManualFieldChange,
    });

    const { setValue } = fieldValue;
    const { setValue: setManualValue } = manualFieldValue;

    useEffect(() => {
      if (averageInterestRate.data && manualFieldBranchRef.current !== branchId) {
        manualFieldBranchRef.current = branchId;
        const rounded = roundTo4Decimals(averageInterestRate.data);
        setManualValue(dn.toString(dn.mul(rounded, 100)));
      }
    }, [
      averageInterestRate.data,
      branchId,
      setManualValue,
    ]);
    const delegateInterestRate = delegateData.data?.interestRate;
    const delegateInterestRateKey = jsonStringifyWithDnum(delegateInterestRate);
    useEffect(() => {
      if (mode === "delegate" && delegateInterestRate && delegate) {
        const rounded = roundTo4Decimals(delegateInterestRate);
        setValue(dn.toString(dn.mul(rounded, 100)));
        onChange(rounded);
      }
    }, [mode, delegateInterestRateKey, delegateInterestRate, delegate, onChange, setValue]);

    const prevModeRef = useRef(mode);
    useEffect(() => {
      if (mode === "manual" && prevModeRef.current !== "manual" && averageInterestRate.data) {
        const rounded = roundTo4Decimals(averageInterestRate.data);
        setManualValue(dn.toString(dn.mul(rounded, 100)));
        onChange(rounded);
      }
      prevModeRef.current = mode;
    }, [mode, averageInterestRate.data, onChange, setManualValue]);

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
      setDelegatePickerOpen(false);
      onModeChange("delegate");
      fieldValue.setValue(dn.toString(dn.mul(delegate.interestRate, 100)));
      onDelegateChange(delegate.address ?? null);
    };

    const breakpoint = useBreakpointName();

    return (
      <>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 12,
            })}
          >
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 4,
              })}
            >
              <div
                className={css({
                  fontSize: 14,
                  color: "contentAlt",
                })}
              >
                {content.interestRateField.setInterestRate.label}
              </div>
              {mode === "manual" && averageInterestRate.data && (
                <div
                  className={css({
                    fontSize: 14,
                    color: "contentAlt",
                  })}
                >
                  <TextButton
                    size="small"
                    title={`Average interest rate: ${
                      fmtnum(averageInterestRate.data, {
                        preset: "pct2z",
                        suffix: "%",
                      })
                    }`}
                    label={`(avg. ${
                      fmtnum(averageInterestRate.data, {
                        preset: "pct2z",
                        suffix: "%",
                      })
                    })`}
                    onClick={(event) => {
                      event.preventDefault();
                      if (averageInterestRate.data) {
                        const rounded = roundTo4Decimals(averageInterestRate.data);
                        manualFieldValue.setValue(dn.toString(dn.mul(rounded, 100)));
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <Tabs
            items={HAS_DEFAULT_DELEGATE
              ? [
                {
                  label: content.interestRateField.delegateModes.automatic.label,
                  tabId: "interest-rate-tab-delegate",
                  panelId: "interest-rate-panel-delegate",
                },
                {
                  label: content.interestRateField.delegateModes.manual.label,
                  tabId: "interest-rate-tab-manual",
                  panelId: "interest-rate-panel-manual",
                },
              ]
              : [
                {
                  label: content.interestRateField.delegateModes.manual.label,
                  tabId: "interest-rate-tab-manual",
                  panelId: "interest-rate-panel-manual",
                },
                {
                  label: content.interestRateField.delegateModes.automatic.label,
                  tabId: "interest-rate-tab-delegate",
                  panelId: "interest-rate-panel-delegate",
                },
              ]}
            selected={HAS_DEFAULT_DELEGATE
              ? (mode === "manual" ? 1 : 0)
              : (mode === "delegate" ? 1 : 0)}
            onSelect={(index) => {
              const selectedMode = HAS_DEFAULT_DELEGATE
                ? (index === 0 ? "delegate" : "manual")
                : (index === 0 ? "manual" : "delegate");
              onModeChange(selectedMode);
            }}
          />

          {(() => {
              const sharedInputProps = {
                id: inputId,
                labelHeight: 32 as const,
                labelSpacing: 24 as const,
                placeholder: "0.00",
              };

              const debtInFrontFormatted = fmtnum(debtInFront?.debtInFront, "compact");
              const secondaryInfo = {
                start: null,
                end: redeemableTransition((style, show) => (
                  show && (
                    <a.div
                      title={`Redeemable before you: ${debtInFrontFormatted} BOLD`}
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
                          {debtInFrontFormatted}
                        </span>
                        {breakpoint === "large" && <span>{" BOLD"}</span>}
                      </span>
                    </a.div>
                  )
                )),
              };

              const renderValueUnfocused = (showMiniChart: boolean, rate?: Dnum | null) => (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {showMiniChart && breakpoint === "large" && <MiniChart size="medium" />}
                  <span
                    style={{
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {fmtnum(rate ?? interestRate, "pct2z")}
                  </span>
                  <span
                    className={css({
                      color: "contentAlt",
                      fontSize: {
                        base: 20,
                        large: 24,
                      },
                    })}
                  >
                    %
                  </span>
                </span>
              );

              const { value: _manualValue, ...manualInputProps } = manualFieldValue.inputFieldProps;
              const { value: _delegateValue, ...delegateInputProps } = fieldValue.inputFieldProps;
              const delegateFee = delegateData.data?.fee ?? null;

              return (
                <div
                  className={css({
                    paddingTop: 16,
                  })}
                >
                  {mode === "manual"
                    ? (
                      <InputField
                        {...sharedInputProps}
                        {...manualInputProps}
                        label="Interest rate"
                        contextual={
                          <ManualInterestRateSlider
                            interestChartData={interestChartData}
                            interestRate={interestRate}
                            fieldValue={manualFieldValue}
                            handleColor={redemptionRisk && (
                              redemptionRisk === "high"
                                ? 0
                                : redemptionRisk === "medium"
                                ? 1
                                : 2
                            )}
                          />
                        }
                        secondary={secondaryInfo}
                        value={manualFieldValue.value}
                        valueUnfocused={
                          !manualFieldValue.isEmpty && manualFieldValue.parsed
                            ? renderValueUnfocused(false, dn.div(manualFieldValue.parsed, 100))
                            : null
                        }
                      />
                    )
                    : (
                      <InputField
                        {...sharedInputProps}
                        {...delegateInputProps}
                        label={
                          <span
                            className={css({
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            })}
                          >
                            Current interest rate
                            <InfoTooltip
                              content={{
                                heading: "Interest rate delegation",
                                body: content.interestRateField.delegateModes.automatic.secondary,
                              }}
                            />
                          </span>
                        }
                        disabled
                        contextual={
                          delegate
                            ? (
                              <div
                                className={css({
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "flex-end",
                                  gap: 4,
                                })}
                              >
                                <TextButton
                                  size="large"
                                  title={delegate}
                                  label={
                                    <div
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
                                      {delegateStrategyName || shortenAddress(delegate, 4).toLowerCase()}
                                    </div>
                                  }
                                  onClick={() => {
                                    setDelegateInfoVisible(true);
                                  }}
                                />
                                <div
                                  className={css({
                                    fontSize: 13,
                                    color: "contentAlt",
                                    whiteSpace: "nowrap",
                                  })}
                                >
                                  {delegateGroupName ? `Managed by ${delegateGroupName}` : shortenAddress(delegate, 4).toLowerCase()}
                                  {delegateFee
                                    ? ` · Fees p.a. ${fmtnum(delegateFee, { digits: 4, scale: 100 })}%`
                                    : null}
                                </div>
                              </div>
                            )
                            : (
                              <TextButton
                                size="large"
                                label="Choose delegate"
                                onClick={() => {
                                  setDelegatePickerOpen(true);
                                }}
                              />
                            )
                        }
                        secondary={{
                          start: null,
                          end: (
                            <TextButton
                              size="small"
                              label="Choose other delegate"
                              onClick={() => {
                                setDelegatePickerOpen(true);
                              }}
                            />
                          ),
                        }}
                        value={delegate === null ? "" : fieldValue.value}
                        valueUnfocused={
                          delegate === null
                            ? null
                            : !fieldValue.isEmpty && fieldValue.parsed && interestRate
                            ? renderValueUnfocused(true)
                            : null
                        }
                      />
                    )}
                </div>
              );
            })()}
        </div>

        <DelegateModal
          branchId={branchId}
          onClose={() => {
            setDelegatePickerOpen(false);
          }}
          onSelectDelegate={handleDelegateSelect}
          visible={isDelegatePickerOpen}
        />

        {delegateData.data && (
          <Modal
            title="Selected delegate"
            onClose={() => setDelegateInfoVisible(false)}
            visible={delegateInfoVisible}
          >
            <div
              className={css({
                paddingTop: 16,
                minWidth: {
                  base: 0,
                  medium: 486,
                },
              })}
            >
              <DelegateBox
                branchId={branchId}
                delegate={{
                  ...delegateData.data,
                  name: delegateDisplayName || delegateData.data.name,
                }}
                url={knownDelegates.data?.find(
                  (group) => group.name === delegateGroupName,
                )?.url}
              />
            </div>
          </Modal>
        )}
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
