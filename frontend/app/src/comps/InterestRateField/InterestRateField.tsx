import type { Address, CollIndex, Delegate } from "@/src/types";
import type { Dnum } from "dnum";

import { INTEREST_RATE_DEFAULT, INTEREST_RATE_MAX, INTEREST_RATE_MIN } from "@/src/constants";
import content from "@/src/content";
import { IC_STRATEGIES } from "@/src/demo-mode";
import { jsonStringifyWithDnum } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum } from "@/src/formatting";
import { useInterestRateChartData } from "@/src/liquity-utils";
import { infoTooltipProps } from "@/src/uikit-utils";
import { noop } from "@/src/utils";
import { css } from "@/styled-system/css";
import {
  Dropdown,
  HFlex,
  InfoTooltip,
  InputField,
  lerp,
  norm,
  shortenAddress,
  Slider,
  TextButton,
} from "@liquity2/uikit";
import { blo } from "blo";
import * as dn from "dnum";
import Image from "next/image";
import { memo, useId, useState } from "react";
import { match } from "ts-pattern";
import { DelegateModal } from "./DelegateModal";
import { IcStrategiesModal } from "./IcStrategiesModal";
import { MiniChart } from "./MiniChart";

export type DelegateMode = "manual" | "strategy" | "delegate";

const DELEGATE_MODES: DelegateMode[] = [
  "manual",
  "delegate",
  "strategy",
];

export const InterestRateField = memo(
  function InterestRateField({
    collIndex,
    debt,
    delegate,
    inputId: inputIdFromProps,
    interestRate,
    mode,
    onChange,
    onDelegateChange,
    onModeChange = noop,
  }: {
    collIndex: CollIndex;
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
        : String(INTEREST_RATE_DEFAULT),
      onChange: ({ parsed }) => {
        if (parsed) {
          onChange(dn.div(parsed, 100));
        }
      },
    });

    const boldInterestPerYear = interestRate && debt && dn.mul(interestRate, debt);

    const interestChartData = useInterestRateChartData(collIndex);

    const interestRateNumber = interestRate && dn.toNumber(
      dn.mul(interestRate, 100),
    );
    const chartdataPoint = interestChartData.data?.find(
      ({ rate }) => rate === interestRateNumber,
    );
    const boldRedeemableInFront = chartdataPoint?.debtInFront ?? dn.from(0, 18);

    const handleDelegateSelect = (delegate: Delegate) => {
      setDelegatePicker(null);
      onChange(delegate.interestRate);
      onDelegateChange(delegate.address ?? null);
    };

    return (
      <>
        <InputField
          id={inputId}
          labelHeight={32}
          labelSpacing={24}
          disabled={mode !== "manual"}
          contextual={match(mode)
            .with("manual", () => (
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
                  gradientMode="high-to-low"
                  chart={interestChartData.data?.map(
                    ({ size }) => Math.max(0.1, size),
                  ) ?? []}
                  onChange={(value) => {
                    fieldValue.setValue(String(
                      Math.round(
                        lerp(
                          INTEREST_RATE_MIN,
                          INTEREST_RATE_MAX,
                          value,
                        ) * 10,
                      ) / 10,
                    ));
                  }}
                  value={norm(
                    interestRate ? dn.toNumber(dn.mul(interestRate, 100)) : 0,
                    INTEREST_RATE_MIN,
                    INTEREST_RATE_MAX,
                  )}
                />
              </div>
            ))
            .with("strategy", () => (
              <TextButton
                size="large"
                label={delegate
                  ? IC_STRATEGIES.find(
                    ({ address }) => address === delegate,
                  )?.name
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
                  items={DELEGATE_MODES.map((mode) => (
                    content.interestRateField.delegateModes[mode]
                  ))}
                  menuWidth={300}
                  menuPlacement="end"
                  onSelect={(index) => {
                    const mode = DELEGATE_MODES[index];
                    if (mode) {
                      onModeChange(mode);
                    }
                    onDelegateChange(null);
                  }}
                  selected={DELEGATE_MODES.findIndex((mode_) => mode_ === mode)}
                  size="small"
                />
              </div>
            ),
          }}
          placeholder="0.00"
          secondary={{
            start: (
              <HFlex gap={4}>
                <div>
                  {boldInterestPerYear && (mode === "manual" || delegate !== null)
                    ? fmtnum(boldInterestPerYear)
                    : "−"} BOLD / year
                </div>
                <InfoTooltip
                  {...infoTooltipProps(
                    content.generalInfotooltips.interestRateBoldPerYear,
                  )}
                />
              </HFlex>
            ),
            end: (
              <span>
                Redeemable before you:{" "}
                <span
                  className={css({
                    fontVariantNumeric: "tabular-nums",
                  })}
                >
                  {(mode === "manual" || delegate !== null)
                    ? fmtnum(boldRedeemableInFront, "compact")
                    : "−"}
                </span>
                <span>{" BOLD"}</span>
              </span>
            ),
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
                    gap: 10,
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
          collIndex={collIndex}
          onClose={() => {
            setDelegatePicker(null);
          }}
          onSelectDelegate={handleDelegateSelect}
          visible={delegatePicker === "delegate"}
        />
        <IcStrategiesModal
          collIndex={collIndex}
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
