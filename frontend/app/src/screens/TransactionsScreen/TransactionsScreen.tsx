"use client";

import type { FlowStepStatus } from "@/src/services/TransactionFlow";
import type { ComponentProps, ReactNode } from "react";

import { ErrorBox } from "@/src/comps/ErrorBox/ErrorBox";
import { Screen } from "@/src/comps/Screen/Screen";
import { Spinner } from "@/src/comps/Spinner/Spinner";
import { getContracts } from "@/src/contracts";
import { CHAIN_BLOCK_EXPLORER } from "@/src/env";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { css } from "@/styled-system/css";
import { AnchorButton, AnchorTextButton, Button, HFlex, IconCross, VFlex } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import Link from "next/link";
import { Fragment, useState } from "react";
import { match, P } from "ts-pattern";

export type LoadingState =
  | "error"
  | "loading"
  | "not-found"
  | "success";

export function TransactionsScreen() {
  const {
    currentStep,
    currentStepIndex,
    flow,
    flowDeclaration: fd,
    signAndSend,
  } = useTransactionFlow();

  const isLastStep = flow?.steps && currentStepIndex === flow.steps.length - 1;

  const successMessageTransition = useTransition(isLastStep && currentStep?.txStatus === "confirmed", {
    from: {
      height: 0,
      opacity: 0,
      transform: "scale(0.9)",
    },
    enter: {
      height: 56,
      opacity: 1,
      transform: "scale(1)",
    },
    leave: {
      height: 0,
      opacity: 0,
      transform: "scale(1)",
    },
    config: {
      mass: 1,
      tension: 1800,
      friction: 120,
    },
  });

  if (!currentStep || !flow || !fd || !flow.steps) {
    return <NoTransactionsScreen />;
  }

  const contracts = getContracts();

  const showBackLink = currentStepIndex === 0 && (
    currentStep.txStatus === "idle"
    || currentStep.txStatus === "error"
    || currentStep.txStatus === "awaiting-signature"
  );

  return (
    <Screen
      back={!showBackLink || !flow.request.backLink ? null : {
        href: flow.request.backLink[0],
        label: "Back",
      }}
      heading={<fd.Summary flow={flow} />}
    >
      <header
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        })}
      >
        <h1
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
          })}
        >
          {fd.title}
        </h1>
      </header>

      <VFlex gap={32}>
        <fd.Details flow={flow} />
      </VFlex>

      <VFlex gap={32}>
        <div>
          {successMessageTransition((style, show) => (
            show && (
              <a.div
                style={style}
                className={css({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 56,
                  whiteSpace: "nowrap",
                  textAlign: "center",
                  color: "positive",
                })}
              >
                {flow.request.successMessage}
              </a.div>
            )
          ))}

          <FlowSteps
            currentStep={currentStepIndex}
            steps={flow.steps.map((step) => ({
              error: step.error,
              id: step.id,
              label: fd.getStepName(step.id, {
                contracts,
                request: flow.request,
              }),
              txStatus: step.txStatus,
            }))}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexDirection: "column",
            gap: 16,
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
                  mode="positive"
                  size="large"
                  wide
                />
              </Link>
            )
            : (
              <Button
                disabled={currentStep.txStatus === "awaiting-confirmation"
                  || currentStep.txStatus === "awaiting-signature"
                  || currentStep.txStatus === "post-check"}
                label={(
                  currentStep.txStatus === "error" ? "Retry: " : ""
                ) + fd.getStepName(
                  currentStep.id,
                  { contracts, request: flow.request },
                )}
                mode="primary"
                onClick={signAndSend}
                size="large"
                wide
              />
            )}
          <div
            className={css({
              textAlign: "center",
              color: "contentAlt",
            })}
          >
            {match(currentStep.txStatus)
              .with("idle", () => "This action will open your wallet to sign the transaction.")
              .with("awaiting-signature", () => "Please sign the transaction in your wallet.")
              .with("awaiting-confirmation", () => (
                <>
                  Waiting for the{" "}
                  <AnchorTextButton
                    label="transaction"
                    href={`${CHAIN_BLOCK_EXPLORER?.url}tx/${currentStep.txHash}`}
                    external
                  />{" "}
                  to be confirmed…
                </>
              ))
              .with("post-check", () => (
                <>
                  Waiting for the{" "}
                  <AnchorTextButton
                    label="transaction"
                    href={`${CHAIN_BLOCK_EXPLORER?.url}tx/${currentStep.txHash}`}
                    external
                  />{"  "}
                  to be indexed…
                </>
              ))
              .with("confirmed", () => (
                <>
                  The{" "}
                  <AnchorTextButton
                    label="transaction"
                    href={`${CHAIN_BLOCK_EXPLORER?.url}tx/${currentStep.txHash}`}
                    external
                  />{"  "}
                  has been confirmed.
                </>
              ))
              .with("error", () => "An error occurred. Please try again.")
              .exhaustive()}
          </div>
        </div>

        {currentStep.error && (
          <div
            className={css({
              marginTop: -8,
            })}
          >
            <ErrorBox title="Error">
              {currentStep.error}
            </ErrorBox>
          </div>
        )}
      </VFlex>
    </Screen>
  );
}

export function TransactionDetailsRow({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode | ReactNode[];
}) {
  return (
    <div
      className={css({
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        width: "100%",
      })}
    >
      <div
        className={css({
          textAlign: "left",
        })}
      >
        {Array.isArray(label)
          ? (
            <VFlex gap={4}>
              <div
                className={css({
                  fontSize: 16,
                })}
              >
                {label[0]}
              </div>
              {label.slice(1).map((secondary, index) => (
                <div
                  key={index}
                  className={css({
                    color: "contentAlt",
                    fontSize: 14,
                  })}
                >
                  {secondary}
                </div>
              ))}
            </VFlex>
          )
          : (
            <HFlex
              alignItems="flex-start"
              justifyContent="flex-start"
              gap={8}
            >
              {label}
            </HFlex>
          )}
      </div>
      <div
        className={css({
          textAlign: "right",
        })}
      >
        {Array.isArray(value)
          ? (
            <VFlex
              alignItems="flex-end"
              gap={4}
            >
              <HFlex
                gap={8}
                className={css({
                  fontSize: 16,
                })}
              >
                {value[0]}
              </HFlex>
              {value.slice(1).map((secondary, index) => (
                <div
                  key={index}
                  className={css({
                    color: "contentAlt",
                    textAlign: "right",
                    fontSize: 14,
                  })}
                >
                  {secondary}
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
      </div>
    </div>
  );
}

function FlowSteps({
  currentStep,
  steps,
}: {
  currentStep: number;
  steps: Array<{
    error: string | null;
    id: string;
    label: string;
    txStatus: FlowStepStatus;
  }>;
}) {
  return steps.length === 1 ? null : (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
      })}
    >
      {steps.map((step, index) => (
        <Fragment key={index}>
          {index > 0 && (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className={css({
                  width: 2,
                  height: 2,
                  backgroundColor: "contentAlt",
                })}
              />
            ))
          )}
          <StepDisc
            index={index}
            label={step.label}
            secondary={index < currentStep ? "Confirmed" : match(step.txStatus)
              .with("error", () => "Error")
              .with("awaiting-signature", () => "Awaiting signature…")
              .with("awaiting-confirmation", () => "Awaiting confirmation…")
              .with("confirmed", () => "Confirmed")
              .with("post-check", () => "Awaiting indexer…")
              .otherwise(() => "Ready")}
            mode={match(step.txStatus)
              .returnType<ComponentProps<typeof StepDisc>["mode"]>()
              .with(
                P.union(
                  "awaiting-signature",
                  "awaiting-confirmation",
                  "post-check",
                ),
                () => "loading",
              )
              .with("confirmed", () => "success")
              .with("error", () => "error")
              .otherwise(() => index === currentStep ? "ready" : "upcoming")}
          />
        </Fragment>
      ))}
    </div>
  );
}

type StepDiscMode = "upcoming" | "ready" | "loading" | "success" | "error";

function StepDisc({
  index,
  label,
  mode,
  secondary,
}: {
  index: number;
  label: string;
  mode: StepDiscMode;
  secondary: string;
}) {
  const [forcedMode, setForcedMode] = useState<StepDiscMode>(mode);
  const [showLabel, setShowLabel] = useState(false);

  const modeTransition = useTransition(mode, {
    initial: { transform: "scale(1)" },
    from: { transform: "scale(1.4)" },
    enter: { transform: "scale(1)" },
    leave: { immediate: true },
    config: {
      mass: 1,
      tension: 2000,
      friction: 180,
    },
  });

  const labelTransition = useTransition(showLabel, {
    from: { opacity: 1, transform: "translateY(0) scale(0.97)" },
    enter: { opacity: 1, transform: "translateY(0) scale(1)" },
    leave: { opacity: 0, transform: "translateY(0) scale(1)" },
    config: {
      mass: 1,
      tension: 2000,
      friction: 60,
    },
  });

  return (
    <div
      title={label}
      onClick={() => {
        const forcedStatuses: StepDiscMode[] = [
          "upcoming",
          "ready",
          "loading",
          "success",
          "error",
        ];
        setForcedMode(
          forcedStatuses[
            (forcedStatuses.indexOf(forcedMode) + 1) % forcedStatuses.length
          ],
        );
      }}
      onMouseEnter={() => setShowLabel(true)}
      onMouseLeave={() => setShowLabel(false)}
      className={css({
        position: "relative",
        width: 32,
        height: 32,
        fontSize: 16,
        userSelect: "none",

        "--base-color": "token(colors.content)",
        "--base-background": "token(colors.surface)",
        "--base-border-color": "token(colors.border)",

        "--active-color": "token(colors.strongSurfaceContent)",
        "--active-background": "token(colors.strongSurface)",
        "--active-border-color": "var(--active-color)",

        "--error-color": "token(colors.negativeContent)",
        "--error-background": "token(colors.negative)",
        "--error-border-color": "var(--error-color)",

        "--success-color": "token(colors.positive)",
        "--success-background": "var(--base-background)",
        "--success-border-color": "var(--success-color)",
      })}
    >
      {modeTransition((style, mode) => (
        <a.div
          className={css({
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            borderWidth: 1,
            borderStyle: "solid",
          })}
          style={{
            ...match(mode)
              .with("upcoming", () => ({
                color: "var(--base-color)",
                background: "var(--base-background)",
                borderColor: "var(--base-border-color)",
              }))
              .with("error", () => ({
                color: "var(--error-color)",
                background: "var(--error-background)",
                borderColor: "var(--error-border-color)",
              }))
              .with("success", () => ({
                color: "var(--success-color)",
                background: "var(--success-background)",
                borderColor: "var(--success-border-color)",
              }))
              .otherwise(() => ({
                color: "var(--active-color)",
                background: "var(--active-background)",
                borderColor: "var(--active-border-color)",
              })),
            ...style,
          }}
        >
          {match(mode)
            .with("error", () => <IconCross size={24} />)
            .with("loading", () => <Spinner size={20} />)
            .with("success", () => <Tick />)
            .otherwise(() => index + 1)}
        </a.div>
      ))}

      {labelTransition((style, show) => (
        show && (
          <a.div
            className={css({
              position: "absolute",
              bottom: `calc(100% + 16px)`,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 0,
              pointerEvents: "none",
            })}
            style={style}
          >
            <a.div
              className={css({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 4,
                minWidth: 300,
                padding: "12px 0",
                whiteSpace: "nowrap",
                color: "content",
                background: "surface",
                border: "1px solid token(colors.border)",
                borderRadius: 4,
                boxShadow: "0 15px 35px rgba(60, 66, 87, 0.12), 0 5px 15px rgba(0, 0, 0, 0.08)",
                pointerEvents: "none",
              })}
              style={style}
            >
              <div>{label}</div>
              {secondary && (
                <div
                  className={css({
                    color: "contentAlt",
                    fontSize: 14,
                  })}
                >
                  {secondary}
                </div>
              )}
            </a.div>
          </a.div>
        )
      ))}
    </div>
  );
}

function Tick() {
  return (
    <svg
      width={12 * 1.2}
      height={10 * 1.2}
      viewBox="0 0 12 10"
      fill="none"
    >
      <path
        fill="currentColor"
        d="M4 7.78 1.22 5l-.947.94L4 9.667l8-8-.94-.94L4 7.78Z"
      />
    </svg>
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
