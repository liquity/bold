"use client";

import type { ReactNode } from "react";

import { InputField, Tabs, TextButton, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import { useState } from "react";
import { useFixtureInput } from "react-cosmos/client";

function isInputValueFloat(value: string) {
  value = value.trim();
  return value && /^[0-9]*\.?[0-9]*?$/.test(value);
}
function parseInputFloat(value: string) {
  value = value.trim();
  if (!isInputValueFloat(value)) {
    return null;
  }
  value = value
    .replace(/\.$/, "")
    .replace(/^\./, "0.");
  return dn.from(value === "" ? 0 : value, 18);
}

export default function InputFieldFixture() {
  const [value, setValue] = useFixtureInput("value", "");
  const parsedValue = parseInputFloat(value);

  const [tab, setTab] = useState(0);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        width: 640,
        padding: 16,
      }}
    >
      <InputField
        contextual={
          <InputTokenBadge
            icon={<TokenIcon symbol="ETH" />}
            label="ETH"
          />
        }
        label={{
          start: "Increase your collateral",
          end: (
            <Tabs
              compact
              items={[
                { label: "Deposit", panelId: "panel-deposit", tabId: "tab-deposit" },
                { label: "Withdraw", panelId: "panel-withdraw", tabId: "tab-withdraw" },
              ]}
              onSelect={setTab}
              selected={tab}
            />
          ),
        }}
        labelHeight={32}
        onChange={setValue}
        value={value}
        valueUnfocused={parsedValue
          ? (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                style={{
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {dn.format(parsedValue, { digits: 1, trailingZeros: true })}
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
          : null}
        placeholder="0.00"
        secondary={{
          start: "$0.00",
          end: (
            <TextButton
              label={`Max 4.67 ETH`}
              onClick={() => {
                // deposit.setValue(dn.toString(ethMax));
              }}
            />
          ),
        }}
      />
    </div>
  );
}

function InputTokenBadge({
  label,
  icon,
}: {
  label: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 40,
        padding: 0,
        fontSize: 24,
        fontWeight: 500,
        borderRadius: 20,
        userSelect: "none",
      }}
    >
      {icon}
      <div>
        {label}
      </div>
    </div>
  );
}
