"use client";

import type { ReactNode } from "react";

import { Screen } from "@/src/comps/Screen/Screen";
import { css } from "@/styled-system/css";
import { Button, HFlex, StatusDot, TextButton, VFlex } from "@liquity2/uikit";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  return (
    <Screen title="You are opening a loan">
      <VFlex gap={32}>
        <Row label="You deposit" value="8.00 ETH" />
        <Row
          label="Liquidation price"
          value="$2,950.00"
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

function Row({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <HFlex
      alignItems="flex-start"
      gap={16}
      justifyContent="space-between"
    >
      <div>{label}</div>
      {Array.isArray(value)
        ? (
          <VFlex
            alignItems="flex-end"
            gap={4}
          >
            <HFlex
              className={css({
                fontSize: 24,
              })}
            >
              {value[0]}
            </HFlex>
            <div
              className={css({
                fontSize: 14,
                color: "contentAlt",
              })}
            >
              {value[1]}
            </div>
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
