"use client";

import type { ReactNode } from "react";

import { Screen } from "@/src/comps/Screen/Screen";
import { css } from "@/styled-system/css";
import { Button, HFlex, IconGas, StatusDot, TextButton, VFlex } from "@liquity2/uikit";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  return (
    <Screen title="You are opening a leveraged position">
      <VFlex gap={32}>
        <Row label="You deposit" value="8.00 ETH" />
        <Row
          label="Liquidation price"
          value={[
            "$2,950.00",
            "Leverage 4x",
          ]}
        />
        <Row
          label="Liquidation risk"
          value={[
            <>
              <StatusDot mode="positive" />
              Low
            </>,
            "LTV 16.00%",
          ]}
        />
        <Row
          label="Redemption risk"
          value={[
            <>
              <StatusDot mode="positive" />
              Low
            </>,
            "Interest rate 5.40%",
          ]}
        />
        <Row
          label="7-days fee"
          value={[
            "0.0001 ETH",
            "~$22.06",
          ]}
        />
        <Row
          label={
            <>
              <IconGas size={16} />
              Gas
            </>
          }
          value={[
            "0.01 ETH",
            "~$32.06",
          ]}
          valueSize="small"
        />
      </VFlex>
      <VFlex gap={40}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <Button
            label="Execute transaction"
            mode="primary"
            size="large"
            wide
            onClick={() => {
              alert("Transaction execution not implemented");
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <TextButton
            label="Back"
            onClick={() => {
              router.push("/leverage");
            }}
          />
        </div>
      </VFlex>
    </Screen>
  );
}

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
