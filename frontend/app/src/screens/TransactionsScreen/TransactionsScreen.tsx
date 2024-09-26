"use client";

import type { FlowStepStatus } from "@/src/services/TransactionFlow";
import type { ReactNode } from "react";

import { Screen } from "@/src/comps/Screen/Screen";
import { Spinner } from "@/src/comps/Spinner/Spinner";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { css } from "@/styled-system/css";
import { AnchorButton, AnchorTextButton, Button, HFlex, IconCross, VFlex } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import Link from "next/link";
import { match, P } from "ts-pattern";

export type LoadingState =
  | "error"
  | "loading"
  | "not-found"
  | "success";

export function TransactionsScreen() {
  const {
    contracts,
    currentStepIndex,
    flow,
    flowDeclaration: fd,
    signAndSend,
  } = useTransactionFlow();

  if (!flow?.steps || !fd || !contracts) {
    return <NoTransactionsScreen />;
  }

  const currentStep = flow.steps[currentStepIndex];

  const showBackLink = currentStepIndex === 0 && (
    currentStep.txStatus === "idle"
    || currentStep.txStatus === "error"
    || currentStep.txStatus === "awaiting-signature"
  );

  return (
    <Screen title={fd.title} subtitle={fd.subtitle}>
      <fd.Summary flow={flow} />

      <VFlex gap={32}>
        <fd.Details flow={flow} />
      </VFlex>

      <VFlex gap={32}>
        {currentStep.error && (
          <div>
            <pre>{currentStep.error}</pre>
          </div>
        )}

        {currentStep.txStatus === "confirmed" && (
          <div
            className={css({
              textAlign: "center",
              color: "positive",
            })}
          >
            {flow.request.successMessage}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            width: "100%",
          }}
        >
          {currentStep.txStatus === "confirmed"
            ? (
              <Link
                href={flow.request.successLink[0]}
                legacyBehavior
                passHref
              >
                <AnchorButton
                  label={flow.request.successLink[1]}
                  mode="primary"
                  size="large"
                  wide
                />
              </Link>
            )
            : (
              <Button
                label={currentStep.txStatus === "error"
                  ? "Retry"
                  : "Confirm"}
                mode="primary"
                onClick={signAndSend}
                size="large"
                wide
              />
            )}
        </div>
        {currentStepIndex > -1 && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 24,
              width: "100%",
            }}
          >
            {flow.steps.map((step, index) => (
              <FlowStep
                key={index}
                isCurrent={index === currentStepIndex}
                label={fd.getStepName(step.id, {
                  contracts,
                  request: flow.request,
                })}
                status={step.txStatus}
              />
            ))}
          </div>
        )}
        {showBackLink && flow.request.backLink && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              width: "100%",
            }}
          >
            <Link
              href={flow.request.backLink[0]}
              legacyBehavior
              passHref
            >
              <AnchorTextButton
                label={flow.request.backLink[1]}
              />
            </Link>
          </div>
        )}
      </VFlex>
    </Screen>
  );
}

export function TransactionDetailsRow({
  label,
  value,
  valueSize = "normal",
  secondarySize = "normal",
}: {
  label: ReactNode;
  value: ReactNode;
  valueSize?: "normal" | "small";
  secondarySize?: "normal" | "large";
}) {
  return (
    <HFlex
      alignItems="flex-start"
      gap={16}
      justifyContent="space-between"
    >
      {Array.isArray(label)
        ? (
          <VFlex
            alignItems="flex-end"
            gap={4}
          >
            <HFlex
              style={{
                fontSize: valueSize === "small" ? 16 : 24,
              }}
            >
              {label[0]}
            </HFlex>
            {label.slice(1).map((v, index) => (
              <div
                key={index}
                className={css({
                  color: "contentAlt",
                })}
                style={{
                  fontSize: secondarySize === "large" ? 16 : 14,
                }}
              >
                {v}
              </div>
            ))}
          </VFlex>
        )
        : <HFlex gap={8}>{label}</HFlex>}
      {Array.isArray(value)
        ? (
          <VFlex
            alignItems="flex-end"
            gap={4}
          >
            <HFlex
              style={{
                fontSize: valueSize === "small" ? 16 : 24,
              }}
            >
              {value[0]}
            </HFlex>
            {value.slice(1).map((v, index) => (
              <div
                key={index}
                className={css({
                  color: "contentAlt",
                })}
                style={{
                  fontSize: secondarySize === "large" ? 16 : 14,
                }}
              >
                {v}
              </div>
            ))}
          </VFlex>
        )
        : (
          <HFlex
            className={css({
              fontSize: 24,
            })}
          >
            {value}
          </HFlex>
        )}
    </HFlex>
  );
}

function NoTransactionsScreen() {
  return (
    <div
      className={css({
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 20,
        width: "100%",
      })}
    >
      <div>
        No ongoing transactions.
      </div>
      <div>
        <Link
          href="/"
          legacyBehavior
          passHref
        >
          <AnchorTextButton label="Back to dashboard" />
        </Link>
      </div>
    </div>
  );
}

function FlowStep({
  isCurrent,
  label,
  status,
}: {
  isCurrent: boolean;
  label: string;
  status: FlowStepStatus;
}) {
  const iconTransition = useTransition(status, {
    from: {
      opacity: 0,
      width: 0,
      transform: "scale(0)",
    },
    enter: {
      opacity: 1,
      width: 16 + 8,
      transform: "scale(1)",
    },
    leave: {
      opacity: 0,
      width: 0,
      transform: "scale(0)",
      immediate: true,
    },
    config: {
      mass: 2,
      tension: 1200,
      friction: 80,
    },
  });

  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 0,
        userSelect: "none",
        color: "primary",
        "--color-alt": "colors.contentAlt",
        "--color-success": "colors.positive",
      })}
      style={{
        color: status === "idle" && !isCurrent
          ? "var(--color-alt)"
          : status === "confirmed"
          ? "var(--color-success)"
          : undefined,
      }}
    >
      <div>{label}</div>
      {iconTransition((style, status) =>
        match(status)
          .with(
            P.union(
              "awaiting-signature",
              "awaiting-confirmation",
              "confirmed",
              "error",
            ),
            (status) => (
              <a.div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                })}
                style={{
                  opacity: style.opacity.to([0, 0.5, 1], [0, 0, 1]),
                  width: style.width,
                }}
              >
                <a.div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 16,
                    flexShrink: 0,
                    "--color-error": "colors.negative",
                    "--color-success": "colors.positive",
                  })}
                  style={{
                    transform: style.transform,
                    color: match(status)
                      .with("error", () => "var(--color-error)")
                      .with("confirmed", () => "var(--color-success)")
                      .otherwise(() => undefined),
                  }}
                >
                  {match(status)
                    .with("error", () => <IconCross size={16} />)
                    .with("confirmed", () => <Tick />)
                    .otherwise(() => <Spinner size={16} />)}
                </a.div>
              </a.div>
            ),
          )
          .otherwise(() => null)
      )}
    </div>
  );
}

function Tick() {
  return (
    <svg
      width="12"
      height="10"
      fill="none"
    >
      <path
        fill="currentColor"
        d="M4 7.78 1.22 5l-.947.94L4 9.667l8-8-.94-.94L4 7.78Z"
      />
    </svg>
  );
}
