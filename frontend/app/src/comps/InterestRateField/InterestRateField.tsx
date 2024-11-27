import type { Address, CollIndex, Delegate } from "@/src/types";
import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import {
  INTEREST_RATE_DEFAULT,
  INTEREST_RATE_MAX,
  INTEREST_RATE_MIN,
} from "@/src/constants";
import content from "@/src/content";
import { IC_STRATEGIES } from "@/src/demo-mode";
import { jsonStringifyWithDnum } from "@/src/dnum-utils";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum, formatRedemptionRisk } from "@/src/formatting";
import { getRedemptionRisk } from "@/src/liquity-math";
import { useInterestRateChartData } from "@/src/liquity-utils";
import { useInterestBatchDelegate } from "@/src/subgraph-hooks";
import { infoTooltipProps, riskLevelToStatusMode } from "@/src/uikit-utils";
import { noop } from "@/src/utils";
import { css } from "@/styled-system/css";
import {
  AddressField,
  AnchorTextButton,
  Button,
  Dropdown,
  HFlex,
  IconCopy,
  InfoTooltip,
  InputField,
  lerp,
  Modal,
  norm,
  shortenAddress,
  Slider,
  StatusDot,
  TextButton,
} from "@liquity2/uikit";
import { blo } from "blo";
import * as dn from "dnum";
import Image from "next/image";
import { memo, useId, useState } from "react";
import { match } from "ts-pattern";

import icLogo from "./ic-logo.svg";

export type DelegateMode = "manual" | "strategy" | "delegate";

const DELEGATE_MODES: DelegateMode[] = [
  "manual",
  "delegate",
  // "strategy",
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

    const boldInterestPerYear =
      interestRate && debt && dn.mul(interestRate, debt);

    const interestChartData = useInterestRateChartData(collIndex);

    const interestRateNumber =
      interestRate && dn.toNumber(dn.mul(interestRate, 100));
    const chartdataPoint = interestChartData.data?.find(
      ({ rate }) => rate === interestRateNumber
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
                  gradientMode='high-to-low'
                  chart={
                    interestChartData.data?.map(({ size }) =>
                      Math.max(0.1, size)
                    ) ?? []
                  }
                  onChange={(value) => {
                    fieldValue.setValue(
                      String(
                        Math.round(
                          lerp(INTEREST_RATE_MIN, INTEREST_RATE_MAX, value) * 10
                        ) / 10
                      )
                    );
                  }}
                  value={norm(
                    interestRate ? dn.toNumber(dn.mul(interestRate, 100)) : 0,
                    INTEREST_RATE_MIN,
                    INTEREST_RATE_MAX
                  )}
                />
              </div>
            ))
            .with("strategy", () => (
              <TextButton
                size='large'
                label={
                  delegate
                    ? IC_STRATEGIES.find(({ address }) => address === delegate)
                        ?.name
                    : "Choose strategy"
                }
                onClick={() => {
                  setDelegatePicker("strategy");
                }}
              />
            ))
            .with("delegate", () => (
              <TextButton
                size='large'
                title={delegate ?? undefined}
                label={
                  delegate ? (
                    <div
                      title={delegate}
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      })}
                    >
                      <Image
                        alt=''
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
                  ) : (
                    "Choose delegate"
                  )
                }
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
                  items={DELEGATE_MODES.map((mode) => {
                    const modeContent =
                      content.interestRateField.delegateModes[mode];
                    return {
                      label: modeContent.label,
                      secondary: modeContent.secondary,
                      disabled: mode === "strategy",
                      disabledReason: "Coming soon",
                    };
                  })}
                  menuWidth={300}
                  menuPlacement='end'
                  onSelect={(index) => {
                    const mode = DELEGATE_MODES[index];
                    if (mode) {
                      onModeChange(mode);
                    }
                    onDelegateChange(null);
                  }}
                  selected={DELEGATE_MODES.findIndex((mode_) => mode_ === mode)}
                  size='small'
                />
              </div>
            ),
          }}
          placeholder='0.00'
          secondary={{
            start: (
              <HFlex gap={4}>
                <div>
                  {boldInterestPerYear &&
                  (mode === "manual" || delegate !== null)
                    ? fmtnum(boldInterestPerYear, 2)
                    : "−"}{" "}
                  USDN / year
                </div>
                <InfoTooltip
                  {...infoTooltipProps(
                    content.generalInfotooltips.interestRateBoldPerYear
                  )}
                />
              </HFlex>
            ),
            end: (
              <span>
                <span>{"Redeemable before you: "}</span>
                <span
                  className={css({
                    fontVariantNumeric: "tabular-nums",
                  })}
                >
                  {mode === "manual" || delegate !== null
                    ? fmtnum(boldRedeemableInFront, "compact")
                    : "−"}
                </span>
                <span>{" USDN"}</span>
              </span>
            ),
          }}
          {...fieldValue.inputFieldProps}
          value={
            // no delegate selected yet
            mode !== "manual" && delegate === null ? "" : fieldValue.value
          }
          valueUnfocused={
            // delegate mode, but no delegate selected yet
            mode !== "manual" && delegate === null ? null : <>
                {!fieldValue.isEmpty && fieldValue.parsed && interestRate}
              </> ? (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {delegate !== null && <MiniChart size='medium' />}
                <span
                  style={{
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {(mode === "manual" || delegate !== null) &&
                    fmtnum(interestRate, "1z", 100)}
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
            ) : null
          }
        />
        <Modal
          onClose={() => {
            setDelegatePicker(null);
          }}
          title={
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 10,
              })}
            >
              <div>{content.interestRateField.icStrategyModal.title}</div>
              <Image alt='' src={icLogo} width={24} height={24} />
            </div>
          }
          visible={delegatePicker === "strategy"}
        >
          <DelegatesModalContent
            collIndex={collIndex}
            chooseLabel='Choose'
            delegates={IC_STRATEGIES}
            intro={content.interestRateField.icStrategyModal.intro}
            onSelectDelegate={handleDelegateSelect}
          />
        </Modal>
        <Modal
          onClose={() => {
            setDelegatePicker(null);
          }}
          title={content.interestRateField.delegatesModal.title}
          visible={delegatePicker === "delegate"}
        >
          <CustomDelegateModalContent
            collIndex={collIndex}
            chooseLabel='Set delegate'
            intro={content.interestRateField.delegatesModal.intro}
            onSelectDelegate={handleDelegateSelect}
          />
        </Modal>
      </>
    );
  },
  (prev, next) => jsonStringifyWithDnum(prev) === jsonStringifyWithDnum(next)
);

function CustomDelegateModalContent({
  collIndex,
  intro,
  onSelectDelegate,
}: {
  collIndex: CollIndex;
  chooseLabel: string;
  intro: ReactNode;
  onSelectDelegate: (delegate: Delegate) => void;
}) {
  const [delegateAddress, setDelegateAddress] = useState<null | Address>(null);
  const [delegateAddressValue, setDelegateAddressValue] = useState("");

  const delegate = useInterestBatchDelegate(collIndex, delegateAddress);

  return (
    <>
      <div
        className={css({
          fontSize: 16,
          color: "contentAlt",
        })}
      >
        {intro}
      </div>
      <div
        className={css({
          paddingTop: 40,
        })}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (delegate.data) {
              onSelectDelegate(delegate.data);
            }
          }}
        >
          <AddressField
            onAddressChange={setDelegateAddress}
            onChange={setDelegateAddressValue}
            placeholder='Enter delegate address'
            value={delegateAddressValue}
          />
        </form>
      </div>

      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          paddingTop: 32,
          paddingBottom: 24,
          minHeight: 312,
        })}
      >
        {delegateAddress ? (
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              height: "100%",
            })}
          >
            {delegate.status === "pending" ? (
              <div
                className={css({
                  color: "contentAlt",
                  paddingTop: 40,
                })}
              >
                Loading…
              </div>
            ) : delegate.status === "error" ? (
              <div
                className={css({
                  color: "contentAlt",
                  paddingTop: 40,
                })}
              >
                Error: {delegate.error?.name}
              </div>
            ) : delegate.data ? (
              <DelegateBox
                delegate={delegate.data}
                selectLabel='Choose'
                onSelect={onSelectDelegate}
              />
            ) : (
              <div>
                The address is not a valid{" "}
                <AnchorTextButton
                  label='batch interest manager'
                  href='https://github.com/liquity/bold#batch-interest-managers'
                  external
                />
                .
              </div>
            )}
          </div>
        ) : (
          <div>
            Please enter a valid{" "}
            <AnchorTextButton
              label='batch interest manager'
              href='https://github.com/liquity/bold#batch-interest-managers'
              external
            />{" "}
            address.
          </div>
        )}
      </div>
    </>
  );
}

function DelegatesModalContent({
  collIndex: _collIndex,
  delegates = [],
  chooseLabel: _chooseLabel,
  intro,
  onSelectDelegate: _onSelectDelegate,
}: {
  collIndex: CollIndex;
  delegates?: Delegate[];
  chooseLabel: string;
  intro: ReactNode;
  onSelectDelegate: (delegate: Delegate) => void;
}) {
  const [displayedDelegates, setDisplayedDelegates] = useState(5);
  return (
    <>
      <div
        className={css({
          fontSize: 16,
          color: "contentAlt",
        })}
      >
        {intro}
      </div>

      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          paddingTop: 32,
          paddingBottom: 24,
          minHeight: 312,
        })}
      >
        {delegates.slice(0, displayedDelegates).map((delegate) => {
          return (
            <DelegateBox
              key={delegate.id}
              delegate={delegate}
              selectLabel='Choose'
              onSelect={noop}
            />
          );
        })}
        {displayedDelegates < delegates.length && (
          <ShadowBox>
            <TextButton
              label='Load more'
              onClick={() => setDisplayedDelegates(displayedDelegates + 5)}
              className={css({
                width: "100%",
                padding: "24px 0",
                justifyContent: "center",
              })}
            />
          </ShadowBox>
        )}
      </div>
    </>
  );
}

const MiniChart = memo(function MiniChart({
  size = "small",
}: {
  size?: "small" | "medium";
}) {
  return size === "medium" ? (
    <svg width='45' height='18' fill='none'>
      <path
        stroke='#9EA2B8'
        strokeLinecap='round'
        strokeWidth='1.5'
        d='m1 10.607 1.66 2.61a2 2 0 0 0 1.688.926H7.31c.29 0 .576.063.84.185l4.684 2.168a2 2 0 0 0 2.142-.296l2.995-2.568a2 2 0 0 0 .662-1.137l1.787-9.191a2 2 0 0 1 .318-.756l.096-.138a2 2 0 0 1 3.303.02l1.421 2.107a2 2 0 0 1 .278.616l1.295 4.996a2 2 0 0 0 .431.815l1.691 1.932c.163.187.29.402.375.635l.731 2.015a2 2 0 0 0 3.029.955l.079-.056a2 2 0 0 0 .744-.99l2.539-7.42 2.477-5.005a2 2 0 0 1 2.924-.762L44 3.536'
      />
    </svg>
  ) : (
    <svg width='28' height='16' fill='none'>
      <path
        stroke='#9EA2B8'
        strokeLinecap='round'
        strokeWidth='1.5'
        d='m2 8.893.618 1.009a2 2 0 0 0 1.706.955h.83a2 2 0 0 1 .867.198l1.731.832a2 2 0 0 0 2.197-.309l.901-.802a2 2 0 0 0 .636-1.126l.902-4.819c.028-.148.085-.288.169-.414v0a1.119 1.119 0 0 1 1.87.011l.64.986c.113.175.197.368.248.571l.613 2.458a2 2 0 0 0 .411.804l.686.814c.145.172.257.37.332.582l.339.97a1.09 1.09 0 0 0 1.671.522v0a1.09 1.09 0 0 0 .394-.54l1.361-4.13.847-1.778a2 2 0 0 1 2.966-.77l.065.047'
      />
    </svg>
  );
});

function ShadowBox({ children }: { children: ReactNode }) {
  return (
    <div
      className={css({
        width: "100%",
        background: "background",
        borderWidth: "1px 1px 0",
        borderStyle: "solid",
        borderColor: "gray:50",
        boxShadow: `
          0 2px 2px rgba(0, 0, 0, 0.1),
          0 4px 10px rgba(18, 27, 68, 0.05),
          inset 0 -1px 4px rgba(0, 0, 0, 0.05)
        `,
        borderRadius: 8,
      })}
    >
      {children}
    </div>
  );
}

function DelegateBox({
  delegate,
  onSelect,
  selectLabel = "Select",
}: {
  delegate: Delegate;
  onSelect: (delegate: Delegate) => void;
  selectLabel: string;
}) {
  const delegationRisk = getRedemptionRisk(delegate.interestRate);
  return (
    <ShadowBox key={delegate.id}>
      <section
        key={delegate.name}
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "8px 16px",
        })}
      >
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            width: "100%",
            paddingBottom: 12,
            borderBottom: "1px solid token(colors.borderSoft)",
          })}
        >
          <div
            className={css({
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              fontSize: 20,
              fontWeight: 500,
              userSelect: "none",
            })}
          >
            <h1 title={`${delegate.name} (${delegate.address})`}>
              {delegate.name}
            </h1>
            <div
              className={css({
                display: "flex",
                gap: 6,
                alignItems: "center",
              })}
            >
              <MiniChart />
              {fmtnum(delegate.interestRate, "1z", 100)}%
            </div>
          </div>
          <div
            className={css({
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              fontSize: 14,
              color: "content",
            })}
          >
            <div
              className={css({
                display: "flex",
                gap: 8,
                alignItems: "center",
              })}
            >
              <div>{delegate.followers} followers</div>
              <div
                className={css({
                  width: 4,
                  height: 4,
                  background: "currentcolor",
                  borderRadius: "50%",
                })}
              />
              <div>{fmtnum(delegate.boldAmount, "compact")} USDN</div>
            </div>
            <div
              className={css({
                display: "flex",
                gap: 8,
                alignItems: "center",
              })}
            >
              <StatusDot mode={riskLevelToStatusMode(delegationRisk)} />
              {formatRedemptionRisk(delegationRisk)}
            </div>
          </div>
        </div>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            width: "100%",
            paddingTop: 12,
            fontSize: 14,
            paddingBottom: 12,
            borderBottom: "1px solid token(colors.borderSoft)",
          })}
        >
          <div
            className={css({
              paddingBottom: 8,
              color: "contentAlt",
            })}
          >
            Last {delegate.lastDays} days
          </div>
          <div
            className={css({
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              fontSize: 14,
              color: "content",
            })}
          >
            <div>Redemptions</div>
            <div title={`${fmtnum(delegate.redemptions, "full")} USDN`}>
              {fmtnum(delegate.redemptions, "compact")} USDN
            </div>
          </div>
          <div
            className={css({
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              fontSize: 14,
              color: "content",
            })}
          >
            <div>Interest rate range</div>
            <div>
              {fmtnum(delegate.interestRateChange[0], 2, 100)}
              <span>-</span>
              {fmtnum(delegate.interestRateChange[1], 2, 100)}%
            </div>
          </div>
          {delegate.fee && (
            <div
              className={css({
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                fontSize: 14,
                color: "content",
              })}
            >
              <div>
                Fees <abbr title='per annum'>p.a.</abbr>
              </div>
              <div title={`${fmtnum(delegate.fee, 18, 100)}%`}>
                {fmtnum(delegate.fee, 4, 100)}%
              </div>
            </div>
          )}
        </div>
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            paddingTop: 16,
            paddingBottom: 8,
            fontSize: 14,
          })}
        >
          <div
            className={css({
              display: "flex",
              gap: 8,
            })}
          >
            <TextButton
              label={
                <>
                  Copy address
                  <IconCopy size={16} />
                </>
              }
              className={css({
                fontSize: 14,
              })}
            />
          </div>
          <div>
            <Button
              label={selectLabel}
              mode='primary'
              size='small'
              onClick={() => {
                onSelect(delegate);
              }}
            />
          </div>
        </div>
      </section>
    </ShadowBox>
  );
}
