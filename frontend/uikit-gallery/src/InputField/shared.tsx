"use client";

import type { ComponentProps, ReactNode } from "react";

import { Dropdown, InputField, PillButton, Slider, TextButton, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import { useState } from "react";
import { useFixtureInput } from "react-cosmos/client";
import { match } from "ts-pattern";

const ETH_PRICE_USD = 3011.23;

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

export function InputFieldFixture({
  fixture,
}: {
  fixture: "deposit" | "borrow" | "strategy" | "slider";
}) {
  const [label] = useFixtureInput(
    "label",
    match(fixture)
      .with("deposit", () => "You deposit")
      .with("borrow", () => "You borrow")
      .with("strategy", () => undefined)
      .with("slider", () => "ETH Liquidation price")
      .exhaustive(),
  );

  const [value, setValue] = useFixtureInput("value", "");
  const [focused, setFocused] = useState(false);
  const parsedValue = parseInputFloat(value);
  const [token, setToken] = useState(0);
  const [leverage, setLeverage] = useState(0); // from 0 (1x) to 5.3 (6.3x)

  const labelEnd = match(fixture)
    .with("slider", () => (
      <span>
        Multiply{" "}
        <span
          style={{
            color: leverage > 4 ? "#F36740" : "#2F3037",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {dn.format([BigInt(Math.round((leverage + 1) * 10)), 1], {
            digits: 1,
            trailingZeros: true,
          })}x
        </span>
      </span>
    ))
    .otherwise(() => undefined);

  const action = match(fixture)
    .with("deposit", () => (
      <Dropdown
        selected={token}
        onSelect={setToken}
        menuPlacement="end"
        items={[
          itemRow("ETH", "ETH", "10.00"),
          itemRow("RETH", "rETH", "30.00"),
          itemRow("WSTETH", "wstETH", "40.00"),
        ]}
      />
    ))
    .with("borrow", () => <Token name="BOLD" />)
    .with("slider", () => (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 300,
          marginRight: -16,
        }}
      >
        <Slider
          gradient={[1 / 3, 2 / 3]}
          onChange={(value) => {
            setLeverage(Math.round(value * 5.3 * 10) / 10);
          }}
          value={leverage / 5.3}
        />
      </div>
    ))
    .otherwise(() => undefined);

  const secondaryStart = match(fixture)
    .with("deposit", () => `${parsedValue ? dn.format(dn.mul(parsedValue, ETH_PRICE_USD), 2) : "−"}  USD`)
    .with("borrow", () => `${parsedValue ? dn.format(parsedValue, 2) : "−"}  USD`)
    .with("slider", () => "Total debt 0 BOLD")
    .otherwise(() => undefined);

  const secondaryEnd = match(fixture)
    .with("deposit", () => (
      <TextButton
        label="Max 10.00 ETH"
        onClick={() => setValue("10")}
      />
    ))
    .with("borrow", () => (
      <div
        style={{
          display: "flex",
          gap: 8,
        }}
      >
        <div
          style={{
            fontWeight: 500,
          }}
        >
          Max LTV 80%:
        </div>
        <TextButton
          label="24,405.69 BOLD"
          onClick={() => setValue("24405.69")}
        />
      </div>
    ))
    .with("slider", () => (
      <div
        style={{
          display: "flex",
          gap: 6,
        }}
      >
        <PillButton
          label="2.2x"
          onClick={() => setLeverage(1.2)}
          warnLevel="low"
        />
        <PillButton
          label="4.1x"
          onClick={() => setLeverage(3.1)}
          warnLevel="medium"
        />
        <PillButton
          label="6.3x"
          onClick={() => setLeverage(5.3)}
          warnLevel="high"
        />
      </div>
    ))
    .otherwise(() => undefined);

  const value_ = match(fixture)
    .with("deposit", () => (
      (focused || !parsedValue) ? value : `${dn.format(parsedValue)} ETH`
    ))
    .with("borrow", () => (
      (focused || !parsedValue) ? value : `${dn.format(parsedValue)} BOLD`
    ))
    .with("slider", () => (
      (focused || !parsedValue) ? value : `$${dn.format(parsedValue)}`
    ))
    .otherwise(() => undefined);

  const placeholder = match(fixture)
    .with("deposit", () => "0.00")
    .with("borrow", () => "0.00")
    .with("slider", () => "$0.00")
    .otherwise(() => undefined);

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
        contextual={action}
        label={{
          start: label,
          end: labelEnd,
        }}
        onFocus={() => setFocused(true)}
        onChange={setValue}
        onBlur={() => setFocused(false)}
        value={value_}
        placeholder={placeholder}
        secondary={{
          start: secondaryStart,
          end: secondaryEnd,
        }}
      />
    </div>
  );
}

function Token({ name }: { name: "ETH" | "BOLD" }) {
  return (
    <Action
      icon={match(name)
        .with("ETH", () => <IconEth />)
        .with("BOLD", () => <IconBold />)
        .exhaustive()}
      label={name}
    />
  );
}

function Action({
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
        padding: "0 16px",
        paddingLeft: icon ? 8 : 16,
        background: "#FFF",
        borderRadius: 20,
        userSelect: "none",
      }}
    >
      {icon}
      <div
        style={{
          fontSize: 24,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function IconBold() {
  return (
    <svg
      fill="none"
      height="24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="12" fill="#63D77D" />
      <path
        fill="#121B44"
        d="M13.878 5q2.2 0 3.4 1.04Q18.5 7.08 18.5 8.9q0 .98-.556 1.8-.555.82-1.444 1.2.956.34 1.578 1.22.644.86.644 1.98 0 1.82-1.222 2.86Q16.3 19 14.1 19H6.695V5z"
      />
    </svg>
  );
}

function IconEth() {
  return (
    <svg
      fill="none"
      height="24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="12" fill="#ECEFF0" />
      <path fill="#000" d="m11.998 10.031-4.639 2.11L12 14.881l4.638-2.742z" opacity=".6" />
      <path fill="#000" d="m7.36 12.14 4.638 2.743V4.443z" opacity=".45" />
      <path fill="#000" d="M12 4.443v10.44l4.639-2.743z" opacity=".8" />
      <path fill="#000" d="m7.36 13.02 4.638 6.538V15.76z" opacity=".45" />
      <path fill="#000" d="M12 15.761v3.797l4.642-6.537z" opacity=".8" />
    </svg>
  );
}

function itemRow(
  symbol: ComponentProps<typeof TokenIcon>["symbol"],
  name: string,
  balance: string,
) {
  return {
    icon: <TokenIcon symbol={symbol} />,
    label: name,
    value: balance,
  };
}
