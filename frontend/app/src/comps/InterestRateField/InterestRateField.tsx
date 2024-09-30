import type { Delegate } from "@/src/types";
import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { INTEREST_RATE_DEFAULT, INTEREST_RATE_INCREMENT, INTEREST_RATE_MAX, INTEREST_RATE_MIN } from "@/src/constants";
import content from "@/src/content";
import {
  DELEGATES,
  DELEGATES_FULL,
  getDebtBeforeRateBucketIndex,
  IC_STRATEGIES,
  INTEREST_CHART,
} from "@/src/demo-mode";
import { useInputFieldValue } from "@/src/form-utils";
import { fmtnum, formatRedemptionRisk } from "@/src/formatting";
import { getRedemptionRisk } from "@/src/liquity-math";
import { infoTooltipProps, riskLevelToStatusMode } from "@/src/uikit-utils";
import { css } from "@/styled-system/css";
import {
  Button,
  Dropdown,
  HFlex,
  IconCopy,
  IconExternal,
  InfoTooltip,
  InputField,
  lerp,
  Modal,
  norm,
  Slider,
  StatusDot,
  TextButton,
} from "@liquity2/uikit";
import * as dn from "dnum";
import Image from "next/image";
import { useState } from "react";
import { match } from "ts-pattern";

import icLogo from "./ic-logo.svg";

const MODES = [{
  label: "Manually",
  secondary: "Set your interest rate manually and update it anytime.",
}, {
  label: "By Internet Computer (ICP) strategy",
  secondary: "Choose a smart contract strategy on the decentralized Internet Computer (ICP) network.",
}, {
  label: "By Delegation",
  secondary: `
    Delegates manage your interest rate, optimizing costs and preventing redemption.
    They charge a fee for this.
  `,
}] as const;

export function InterestRateField({
  debt,
  interestRate,
  onChange,
}: {
  debt: Dnum | null;
  interestRate: Dnum | null;
  onChange: (interestRate: Dnum) => void;
}) {
  // 0: manually, 1: by strategy, 2: by delegation
  const [selectedMode, setSelectedMode] = useState<0 | 1 | 2>(0);

  const [delegate, setDelegate] = useState<null | { id: string }>(null);
  const [delegatePicker, setDelegatePicker] = useState<null | "strategy" | "delegate">(null);

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

  const boldRedeemableInFront = getDebtBeforeRateBucketIndex(
    interestRate
      ? Math.round((dn.toNumber(interestRate) * 100 - INTEREST_RATE_MIN) / INTEREST_RATE_INCREMENT)
      : 0,
  );

  const onSelectDelegate = (id: string) => {
    const delegate = DELEGATES_FULL.find((s) => s.id === id);
    if (delegate) {
      onChange(delegate.interestRate);
    }
    setDelegate(delegate ? { id } : null);
    setDelegatePicker(null);
  };

  return (
    <>
      <InputField
        labelHeight={32}
        labelSpacing={24}
        contextual={match(selectedMode)
          .with(0, () => (
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
                chart={INTEREST_CHART}
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
          .with(1, () => (
            <TextButton
              size="large"
              label={delegate ? IC_STRATEGIES.find(({ id }) => id === delegate.id)?.name : "Choose strategy"}
              onClick={() => {
                setDelegatePicker("strategy");
              }}
            />
          ))
          .with(2, () => (
            <TextButton
              size="large"
              label={delegate ? DELEGATES.find(({ id }) => id === delegate.id)?.name : "Choose delegate"}
              onClick={() => {
                setDelegatePicker("delegate");
              }}
            />
          ))
          .exhaustive()}
        label={{
          start: "Set interest rate",
          end: (
            <div>
              <Dropdown
                items={MODES}
                menuWidth={300}
                onSelect={(mode) => {
                  if (mode === 0 || mode === 1 || mode === 2) {
                    setSelectedMode(mode);
                    setDelegate(null);
                  }
                }}
                selected={selectedMode}
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
                {boldInterestPerYear
                  ? fmtnum(boldInterestPerYear, 2)
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
                  className={css({
                    fontVariantNumeric: "tabular-nums",
                  })}
                >
                  {fmtnum(boldRedeemableInFront, "compact")}
                </span>
                <span>{" BOLD to redeem"}</span>
              </span>
            </span>
          ),
        }}
        {...fieldValue.inputFieldProps}
        value={
          // no delegate selected yet
          (selectedMode === 1 || selectedMode === 2) && delegate === null
            ? ""
            : fieldValue.value
        }
        valueUnfocused={
          // no delegate selected yet
          (selectedMode === 1 || selectedMode === 2) && delegate === null
            ? null
            : (!fieldValue.isEmpty && fieldValue.parsed && interestRate)
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
                  {fmtnum(interestRate, "1z", 100)}
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
      <Modal
        onClose={() => {
          setDelegatePicker(null);
        }}
        title={
          <div
            title="Internet Computer Strategies"
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 10,
            })}
          >
            <div>IC Strategies</div>
            <Image
              alt=""
              src={icLogo}
              width={24}
              height={24}
            />
          </div>
        }
        visible={delegatePicker === "strategy"}
      >
        <DelegatesModalContent
          chooseLabel="Choose"
          delegates={IC_STRATEGIES}
          intro="It’s an automated strategy developed by ICP that helps avoid redemption and reduce costs. More strategies soon."
          onSelectDelegate={onSelectDelegate}
        />
      </Modal>
      <Modal
        onClose={() => {
          setDelegatePicker(null);
        }}
        title={`${DELEGATES.length} delegates`}
        visible={delegatePicker === "delegate"}
      >
        <DelegatesModalContent
          chooseLabel="Choose delegate"
          delegates={DELEGATES}
          intro="Delegates manage your interest rate, optimizing costs and preventing redemption. They charge a fee for this."
          onSelectDelegate={onSelectDelegate}
        />
      </Modal>
    </>
  );
}

function DelegatesModalContent({
  delegates,
  chooseLabel,
  intro,
  onSelectDelegate,
}: {
  delegates: Delegate[];
  chooseLabel: string;
  intro: ReactNode;
  onSelectDelegate: (id: Delegate["id"]) => void;
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
          gap: 8,
          paddingTop: 32,
          paddingBottom: 24,
        })}
      >
        {delegates.slice(0, displayedDelegates).map((delegate) => {
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
                    })}
                  >
                    <h1>
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
                      <Bullet />
                      <div>
                        {fmtnum(delegate.boldAmount, "compact")} BOLD
                      </div>
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
                    <div title={`${fmtnum(delegate.redemptions, "full")} BOLD`}>
                      {fmtnum(delegate.redemptions, "compact")} BOLD
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
                    <div>Interest rate change</div>
                    <div>
                      {fmtnum(delegate.interestRateChange[0], 2, 100)}…{fmtnum(delegate.interestRateChange[1], 2, 100)}%
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
                      <div>Fees</div>
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
                    <TextButton
                      label={
                        <>
                          Dune
                          <IconExternal size={16} />
                        </>
                      }
                      className={css({
                        fontSize: 14,
                      })}
                    />
                  </div>
                  <div>
                    <Button
                      label={chooseLabel}
                      mode="primary"
                      size="small"
                      onClick={() => {
                        onSelectDelegate(delegate.id);
                      }}
                    />
                  </div>
                </div>
              </section>
            </ShadowBox>
          );
        })}
        {displayedDelegates < delegates.length && (
          <ShadowBox>
            <TextButton
              label="Load more"
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

function MiniChart({ size = "small" }: { size?: "small" | "medium" }) {
  return (
    size === "medium"
      ? (
        <svg width="45" height="18" fill="none">
          <path
            stroke="#9EA2B8"
            strokeLinecap="round"
            strokeWidth="1.5"
            d="m1 10.607 1.66 2.61a2 2 0 0 0 1.688.926H7.31c.29 0 .576.063.84.185l4.684 2.168a2 2 0 0 0 2.142-.296l2.995-2.568a2 2 0 0 0 .662-1.137l1.787-9.191a2 2 0 0 1 .318-.756l.096-.138a2 2 0 0 1 3.303.02l1.421 2.107a2 2 0 0 1 .278.616l1.295 4.996a2 2 0 0 0 .431.815l1.691 1.932c.163.187.29.402.375.635l.731 2.015a2 2 0 0 0 3.029.955l.079-.056a2 2 0 0 0 .744-.99l2.539-7.42 2.477-5.005a2 2 0 0 1 2.924-.762L44 3.536"
          />
        </svg>
      )
      : (
        <svg width="28" height="16" fill="none">
          <path
            stroke="#9EA2B8"
            strokeLinecap="round"
            strokeWidth="1.5"
            d="m2 8.893.618 1.009a2 2 0 0 0 1.706.955h.83a2 2 0 0 1 .867.198l1.731.832a2 2 0 0 0 2.197-.309l.901-.802a2 2 0 0 0 .636-1.126l.902-4.819c.028-.148.085-.288.169-.414v0a1.119 1.119 0 0 1 1.87.011l.64.986c.113.175.197.368.248.571l.613 2.458a2 2 0 0 0 .411.804l.686.814c.145.172.257.37.332.582l.339.97a1.09 1.09 0 0 0 1.671.522v0a1.09 1.09 0 0 0 .394-.54l1.361-4.13.847-1.778a2 2 0 0 1 2.966-.77l.065.047"
          />
        </svg>
      )
  );
}

function Bullet() {
  return (
    <div
      className={css({
        width: 4,
        height: 4,
        background: "currentcolor",
        borderRadius: "50%",
      })}
    />
  );
}

function ShadowBox({ children }: { children: ReactNode }) {
  return (
    <div
      className={css({
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
