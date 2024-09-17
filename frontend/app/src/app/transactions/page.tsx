"use client";

import type { FlowContextFromFlowId, FlowId } from "@/src/services/TransactionFlow";
import type { ReactNode } from "react";

import { Screen } from "@/src/comps/Screen/Screen";
import { useTransactionFlow } from "@/src/services/TransactionFlow";
import { css } from "@/styled-system/css";
import { Button, HFlex, IconGas, TextButton, VFlex } from "@liquity2/uikit";
// import * as dn from "dnum";
import { fmtnum } from "@/src/formatting";
import { useRouter } from "next/navigation";

export default function TransactonPage() {
  const router = useRouter();
  const {
    currentStepIndex,
    discard,
    signAndSend,
    start,
    flow,
    flowStatus,
  } = useTransactionFlow();

  const flowId = flow?.request.flowId;
  const settings = flowId && flowSettings[flowId];

  if (!settings || !flow.steps) {
    return <div>No ongoing transaction series</div>;
  }

  const currentStepId = flow.steps[currentStepIndex]?.id;

  const { title, subtitle, Summary } = settings;

  return (
    <Screen title={title} subtitle={subtitle}>
      <Summary flow={flow} />

      <Row
        label={
          <>
            <IconGas size={16} />
            Gas estimate
          </>
        }
        value={[
          "0.01 ETH",
          "~$32.06",
        ]}
        valueSize="small"
      />

      <Row
        label="Transaction"
        value={[
          `${currentStepIndex + 1} of ${flow.steps.length}`,
          `(${currentStepId})`,
        ]}
        valueSize="small"
      />

      {flow.steps[currentStepIndex]?.error && (
        <div>
          <pre>{flow.steps[currentStepIndex]?.error}</pre>
        </div>
      )}

      <VFlex gap={40}>
        {flowStatus === "completed" ? "Completed" : (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              width: "100%",
            }}
          >
            <Button
              label="Confirm"
              mode="primary"
              size="large"
              wide
              onClick={() => {
                signAndSend();
              }}
            />
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <TextButton
            label="Back to editing"
            onClick={() => {
              router.push("/borrow");
            }}
          />
        </div>
      </VFlex>
    </Screen>
  );
}

const flowSettings: {
  [key in FlowId]: {
    title: ReactNode;
    subtitle: ReactNode;
    Summary: React.ComponentType<{
      flow: FlowContextFromFlowId<key>;
    }>;
  };
} = {
  openLoanPosition: {
    title: "Review & Confirm",
    subtitle: "Here you can review the details of the changes of your borrow position",
    Summary({ flow }) {
      const { request } = flow;
      return (
        <VFlex gap={32}>
          <Row
            label="You deposit"
            value={`${fmtnum(request.collAmount)} ETH`}
          />
          <Row label="You borrow" value={`${fmtnum(request.boldAmount)} BOLD`} />
        </VFlex>
      );
    },
  },
  repayAndCloseLoanPosition: {
    title: "Repay and close loan position",
    subtitle: "",
    Summary() {
      return null;
    },
  },
  updateLoanPosition: {
    title: "Update loan position",
    subtitle: "",
    Summary() {
      return null;
    },
  },
};

function Row({
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
            {label.slice(1).map((v, i) => (
              <div
                key={i}
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
            {value.slice(1).map((v, i) => (
              <div
                key={i}
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
