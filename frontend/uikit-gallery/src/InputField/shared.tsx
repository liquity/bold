"use client";

import type { ReactNode } from "react";

import { InputField, PillButton, TextButton } from "@liquity2/uikit";
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
  fixture: "deposit" | "borrow" | "interest" | "strategy";
}) {
  const [label] = useFixtureInput(
    "label",
    match(fixture)
      .with("deposit", () => "You deposit")
      .with("borrow", () => "You borrow")
      .with("interest", () => "Interest rate")
      .with("strategy", () => undefined)
      .exhaustive(),
  );

  const [value, setValue] = useFixtureInput("value", "");
  const [focused, setFocused] = useState(false);

  const parsedValue = parseInputFloat(value);

  const action = match(fixture)
    .with("deposit", () => <Token name="ETH" />)
    .with("borrow", () => <Token name="BOLD" />)
    .with("interest", () => <Action label="% per year" />)
    .otherwise(() => undefined);

  const secondaryStart = match(fixture)
    .with("deposit", () => `${parsedValue ? dn.format(dn.mul(parsedValue, ETH_PRICE_USD), 2) : "−"}  USD`)
    .with("borrow", () => `${parsedValue ? dn.format(parsedValue, 2) : "−"}  USD`)
    .with("interest", () => `0 BOLD / year`)
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
    .with("interest", () => (
      <div
        style={{
          display: "flex",
          gap: 6,
        }}
      >
        <PillButton
          label="6.5%"
          onClick={() => setValue("6.5")}
          warnLevel="low"
        />
        <PillButton
          label="5.0%"
          onClick={() => setValue("5.0")}
          warnLevel="medium"
        />
        <PillButton
          label="3.5%"
          onClick={() => setValue("3.5")}
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
    .with("interest", () => (
      (focused || !parsedValue) ? value : `${dn.format(parsedValue)}%`
    ))
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
        action={action}
        label={label}
        onFocus={() => setFocused(true)}
        onChange={setValue}
        onBlur={() => setFocused(false)}
        value={value_}
        placeholder="0.00"
        secondaryStart={secondaryStart}
        secondaryEnd={secondaryEnd}
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
