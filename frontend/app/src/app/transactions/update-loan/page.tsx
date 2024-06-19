"use client";

import type { ReactNode } from "react";

import { Screen } from "@/src/comps/Screen/Screen";
import { css } from "@/styled-system/css";
import { Button, HFlex, IconGas, StatusDot, TextButton, VFlex } from "@liquity2/uikit";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  return (
    <Screen title="You are adjusting your loan">
      <VFlex gap={32}>
        <Row
          label="You deposit"
          value={[
            "+8.00 ETH",
            "10.00 → 18.00 ETH",
          ]}
        />
        <Row
          label="You borrow"
          value={[
            "+ 2,000.00 BOLD",
            "9,412.32 BOLD → 11,412.32 BOLD",
          ]}
        />
        <Row
          label="Liquidation risk"
          value={[
            <>
              <StatusDot mode="positive" />
              Low
            </>,
            "LTV 33.00% → 16.00%",
            "Liq. price $1,200.00 → $600.00",
          ]}
        />
        <Row
          label="Interest rate"
          value={[
            "+0.6 %",
            "6.00% → 6.60%",
          ]}
        />
        <Row
          label="Redemption risk"
          value={[
            <>
              <StatusDot mode="positive" />
              Low
            </>,
            "Int. rate 5.40% → 6.00%",
          ]}
        />
        <Row
          label="7-days fee"
          value={[
            "0.0001 ETH",
            "~$22.06",
          ]}
          valueSize="small"
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
              router.push("/loan?id=1");
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
