"use client";

import type { ReactNode } from "react";

import { Screen } from "@/src/comps/Screen/Screen";
import { css } from "@/styled-system/css";
import { Button, HFlex, IconGas, TextButton, VFlex } from "@liquity2/uikit";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  return (
    <Screen
      title="You are repaying your debt & closing your loan"
      subtitle="The deposit will be returned to your wallet"
    >
      <VFlex gap={32}>
        <VFlex gap={0}>
          <Row
            label="You repay with"
            value="3.00 rETH"
          />
          <Row
            label={[
              null,
              "9,412.32 BOLD ~ $9,400.01",
            ]}
            value={[
              null,
              "1 rETH = 3,100.23 BOLD",
            ]}
            secondarySize="large"
          />
        </VFlex>
        <Row
          label="You reclaim"
          value={[
            "7.00 ETH",
            "9,412.32 BOLD → 11,412.32 BOLD",
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
              router.push("/loan/close?id=1");
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
