import type { Address, BranchId, Delegate } from "@/src/types";
import type { Dnum } from "dnum";

import { useAppear } from "@/src/anim-utils";
import { INTEREST_RATE_DEFAULT, INTEREST_RATE_START, REDEMPTION_RISK } from "@/src/constants";
import content from "@/src/content";
import { jsonStringifyWithDnum } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { getBranch, useInterestRateChartData } from "@/src/liquity-utils";
import { infoTooltipProps } from "@/src/uikit-utils";
import { noop } from "@/src/utils";
import { css } from "@/styled-system/css";
import { Dropdown, InfoTooltip, InputField, shortenAddress, Slider, TextButton } from "@liquity2/uikit";
import { a } from "@react-spring/web";
import { blo } from "blo";
import * as dn from "dnum";
import Image from "next/image";
import { memo, useId, useMemo, useState } from "react";
import { match } from "ts-pattern";
import { DelegateModal } from "./DelegateModal";
import { IcStrategiesModal } from "./IcStrategiesModal";
import { MiniChart } from "./MiniChart";

import icLogo from "./ic-logo.svg";

const DELEGATE_MODES = ["manual", "delegate", "strategy"] as const;

export type DelegateMode = typeof DELEGATE_MODES[number];

export const InterestRateField = memo(
  function InterestRateField({
    branchId,
    debt,
    delegate,
    inputId: inputIdFromProps,
    interestRate,
    mode,
    onChange,
    onDelegateChange,
    onModeChange = noop,
  }: {
    branchId: BranchId;
    debt: Dnum | null;
    delegate: Address | null;
    inputId?: string;
    interestRate: Dnum | null;
    mode: DelegateMode;
    onChange: (interestRate: Dnum) => void;
    onDelegateChange: (delegate: Address | null) => void;
    onModeChange?: (mode: DelegateMode) => void;
  }) {
    const [delegatePicker, setDelegatePicker] = useState<
      "strategy" | "delegate" | null
    >(null);

    const autoInputId = useId();
    const inputId = inputIdFromProps ?? autoInputId;

    const fieldValue = useInputFieldValue((value) => `${fmtnum(value)}%`, {
      defaultValue: interestRate
        ? dn.toString(dn.mul(interestRate, 100))
        : String(INTEREST_RATE_DEFAULT * 100),
      onFocusChange: ({ parsed, focused }) => {
        if (!focused && parsed) {
          const rounded = dn.div(dn.round(dn.mul(parsed, 10)), 10);
          fieldValue.setValue(
            rounded[0] === 0n
              ? String(INTEREST_RATE_START * 100)
              : dn.toString(rounded),
          );
        }
      },
      onChange: ({ parsed }) => {
        if (parsed) {
          onChange(dn.div(parsed, 100));
        }
      },
    });

    const interestChartData = useInterestRateChartData();
    const interestRateRounded = interestRate && dn.div(dn.round(dn.mul(interestRate, 1000)), 1000);

    const bracket = interestRateRounded && interestChartData.data?.find(
      ({ rate }) => rate[0] === interestRateRounded[0],
    );

    const redeemableTransition = useAppear(bracket?.debtInFront !== undefined);

    const handleDelegateSelect = (delegate: Delegate) => {
      setDelegatePicker(null);
      onChange(delegate.interestRate);
      onDelegateChange(delegate.address ?? null);
    };

    const branch = getBranch(branchId);
    const hasStrategies = branch.strategies.length > 0;
    const activeDelegateModes = DELEGATE_MODES.filter((mode) => mode !== "strategy" || hasStrategies);

    const boldInterestPerYear = interestRate && debt && dn.mul(interestRate, debt);

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
              />
            ))
            .with("strategy", () => (
              <TextButton
                size="large"
                label={delegate
                  ? (
                    <div
                      title={delegate}
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      })}
                    >
                      <Image
                        alt=""
                        src={icLogo}
                        width={24}
                        height={24}
                        className={css({
                          display: "block",
                          borderRadius: 4,
                        })}
                      />
                      {shortenAddress(delegate, 4).toLowerCase()}
                    </div>
                  )
                  : "Choose strategy"}
                onClick={() => {
                  setDelegatePicker("strategy");
                }}
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
                      {shortenAddress(delegate, 4).toLowerCase()}
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
            start: "Interest rate",
            end: (
              <div>
                <Dropdown
                  items={activeDelegateModes.map((
                    mode,
                  ) => (
                    content.interestRateField.delegateModes[mode]
                  ))}
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
                })}
              >
                <div>
                  {boldInterestPerYear && (mode === "manual" || delegate !== null)
                    ? fmtnum(boldInterestPerYear)
                    : "−"} BOLD / year
                </div>
                <InfoTooltip {...infoTooltipProps(content.generalInfotooltips.interestRateBoldPerYear)} />
              </div>
            ),
            end: redeemableTransition((style, show) => (
              show && (
                <a.div
                  className={css({
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  })}
                  style={style}
                >
                  <span>
                    Redeemable before you:{" "}
                    <span
                      className={css({
                        fontVariantNumeric: "tabular-nums",
                      })}
                    >
                      {(mode === "manual" || delegate !== null)
                        ? fmtnum(bracket?.debtInFront, "compact")
                        : "−"}
                    </span>
                    <span>{" BOLD"}</span>
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
                  {delegate !== null && <MiniChart size="medium" />}
                  <span
                    style={{
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {(mode === "manual" || delegate !== null) && fmtnum(
                      interestRate,
                      "pct1z",
                    )}
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
        <IcStrategiesModal
          branchId={branchId}
          onClose={() => {
            setDelegatePicker(null);
          }}
          onSelectDelegate={handleDelegateSelect}
          visible={delegatePicker === "strategy"}
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
  interestChartData,
  interestRate,
}: {
  fieldValue: ReturnType<typeof useInputFieldValue>;
  interestChartData: ReturnType<typeof useInterestRateChartData>;
  interestRate: Dnum | null;
}) {
  const value = (() => {
    const chartRates = interestChartData.data?.map(({ rate }) => rate[0]);
    const rate = interestRate?.[0] ?? 0n;

    if (!rate || !chartRates || chartRates.length === 0) {
      return 0;
    }

    const firstRate = chartRates.at(0) ?? 0n;
    if (rate <= firstRate) return 0;

    const lastRate = chartRates.at(-1) ?? 0n;
    if (rate >= lastRate) return 1;

    // find the closest rate in the chart data
    let index = 0;
    let currentDiff = firstRate - rate;
    if (currentDiff < 0) currentDiff = -currentDiff; // abs()
    while (index < (chartRates.length - 1)) {
      const nextRate = chartRates[index + 1] ?? 0n;

      let nextDiff = nextRate - rate;
      if (nextDiff < 0) nextDiff = -nextDiff;

      // diff starts increasing = we passed the closest point
      if (nextDiff > currentDiff) {
        break;
      }

      // otherwise, keep going
      currentDiff = nextDiff;
      index++;
    }

    return index / chartRates.length;
  })();

  const gradientStops = useMemo((): [number, number] => {
    if (!interestChartData.data || interestChartData.data.length === 0) {
      return [0, 0];
    }
    const rates = interestChartData.data.map((bar) => dn.toNumber(bar.rate));
    return [
      gradientStop(rates, REDEMPTION_RISK.medium),
      gradientStop(rates, REDEMPTION_RISK.low),
    ];
  }, [interestChartData.data]);

  const transition = useAppear(value !== -1);

  return transition((style, show) =>
    show && (
      <a.div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 260,
          paddingTop: 16,
          ...style,
        }}
      >
        <Slider
          gradient={gradientStops}
          gradientMode="high-to-low"
          chart={interestChartData.data?.map(({ size }) => size) ?? []}
          onChange={(value) => {
            if (interestChartData.data) {
              const index = Math.min(
                interestChartData.data.length - 1,
                Math.round(value * (interestChartData.data.length)),
              );
              fieldValue.setValue(String(dn.toNumber(dn.mul(
                interestChartData.data[index]?.rate ?? dn.from(0, 18),
                100,
              ))));
            }
          }}
          value={value}
        />
      </a.div>
    )
  );
}

function gradientStop(chartRates: number[], targetRate: number) {
  const firstRate = chartRates.at(0);
  const lastRate = chartRates.at(-1);

  if (firstRate === undefined || lastRate === undefined) {
    return 0;
  }

  if (targetRate <= firstRate) return 0;
  if (targetRate >= lastRate) return 1;

  let index = 0;
  let currentDiff = Math.abs(firstRate - targetRate);

  while (index < chartRates.length) {
    const nextRate = chartRates[index + 1];
    if (nextRate === undefined) {
      break;
    }

    const nextDiff = Math.abs(nextRate - targetRate);

    // diff starts increasing = we passed the closest point
    if (nextDiff > currentDiff) {
      break;
    }

    currentDiff = nextDiff;
    index++;
  }

  return index / (chartRates.length);
}
