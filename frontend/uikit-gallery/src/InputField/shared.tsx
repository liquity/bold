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
          itemRow("WETH", "WETH", "10.00"),
          itemRow("BTCB", "BTCB", "10.00"),
        ]}
      />
    ))
    .with("borrow", () => <Token name="bvUSD" />)
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
    .with("slider", () => "Total debt 0 bvUSD")
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
          label="24,405.69 bvUSD"
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
      (focused || !parsedValue) ? value : `${dn.format(parsedValue)} WETH`
    ))
    .with("borrow", () => (
      (focused || !parsedValue) ? value : `${dn.format(parsedValue)} bvUSD`
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

function Token({ name }: { name: "WETH" | "BTCB" | "BOLD" | "bvUSD" }) {
  return (
    <Action
      icon={match(name)
        .with("WETH", () => <IconEth />)
        .with("BTCB", () => <IconBtc />)
        .with("BOLD", () => <IconBold />)
        .with("bvUSD", () => <IconBold />)
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

function IconBtc() {
  return (
    <svg
      fill="none"
      height="24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g id="svgg"><path id="path0" d="M182.000 20.754 C 31.635 36.051,-34.081 220.049,72.563 327.167 C 166.689 421.713,328.504 383.208,370.239 256.333 C 410.732 133.234,310.416 7.689,182.000 20.754 M213.333 34.688 C 354.191 47.243,416.235 218.523,315.891 317.811 C 219.113 413.572,54.634 357.484,35.640 222.245 C 20.996 117.987,108.747 25.366,213.333 34.688 M180.000 46.944 C 148.831 51.199,121.243 63.768,97.517 84.521 L 95.368 86.401 100.314 91.314 L 105.260 96.227 107.463 94.446 C 163.468 49.163,236.287 47.994,288.326 91.543 C 294.738 96.910,293.443 96.934,298.988 91.346 L 303.606 86.691 301.637 84.611 C 276.760 58.337,221.620 41.262,180.000 46.944 M308.067 100.244 L 303.134 105.232 307.541 110.516 C 350.138 161.587,350.179 238.477,307.637 289.000 C 305.784 291.200,304.073 293.322,303.834 293.716 C 303.595 294.110,305.600 296.618,308.290 299.290 L 313.180 304.148 318.184 298.137 C 366.258 240.376,365.122 153.615,315.565 98.128 L 313.000 95.256 308.067 100.244 M84.243 98.156 C 34.386 151.403,32.973 240.117,81.052 298.570 L 86.182 304.808 91.199 299.790 L 96.216 294.773 91.178 288.553 C 50.097 237.838,49.250 164.544,89.163 114.185 C 91.640 111.060,94.178 107.843,94.802 107.037 C 95.915 105.601,95.841 105.476,91.110 100.776 L 86.281 95.980 84.243 98.156 M171.333 122.980 L 171.333 137.333 153.667 137.333 L 136.000 137.333 136.000 146.667 L 136.000 156.000 143.833 156.002 C 159.496 156.007,158.661 153.370,158.664 202.866 C 158.667 251.646,159.666 248.000,146.302 248.000 C 142.469 248.000,139.330 248.075,139.327 248.167 C 139.323 248.258,138.576 252.683,137.667 258.000 C 136.757 263.317,136.010 267.892,136.006 268.167 C 136.003 268.442,143.794 268.667,153.320 268.667 L 170.641 268.667 170.820 283.167 L 171.000 297.667 179.500 297.853 L 188.000 298.040 188.000 283.687 L 188.000 269.333 195.000 269.333 L 202.000 269.333 202.000 283.333 L 202.000 297.333 210.653 297.333 L 219.307 297.333 219.487 283.189 L 219.667 269.045 227.333 268.195 C 259.434 264.639,272.857 251.706,271.819 225.333 C 271.239 210.597,265.163 202.282,251.648 197.731 L 247.337 196.279 250.835 193.929 C 264.665 184.637,266.142 161.191,253.642 149.369 C 247.249 143.323,230.924 137.393,220.513 137.336 C 220.246 137.335,219.946 130.958,219.847 123.167 L 219.667 109.000 211.167 108.813 L 202.667 108.627 202.667 122.647 L 202.667 136.667 195.680 136.667 L 188.694 136.667 188.514 122.833 L 188.333 109.000 179.833 108.813 L 171.333 108.627 171.333 122.980 M215.000 158.838 C 224.791 161.654,229.333 166.777,229.333 175.005 C 229.333 186.472,219.257 191.963,198.167 191.988 L 188.667 192.000 188.667 174.583 L 188.667 157.165 200.167 157.522 C 207.110 157.738,212.987 158.259,215.000 158.838 M210.795 210.010 C 228.636 211.702,237.311 217.788,237.327 228.623 C 237.346 241.644,226.996 247.144,201.167 247.839 L 188.667 248.175 188.667 229.136 C 188.667 211.565,188.757 210.074,189.833 209.793 C 192.044 209.215,203.683 209.336,210.795 210.010 M100.357 308.643 L 95.750 313.285 97.042 314.718 C 97.752 315.507,100.558 317.943,103.277 320.133 C 160.227 365.995,241.403 365.386,297.938 318.673 L 303.981 313.679 299.174 308.840 C 293.429 303.056,294.500 303.161,288.911 307.833 C 237.726 350.620,162.684 350.854,111.000 308.388 C 104.573 303.108,105.881 303.076,100.357 308.643 " stroke="none" fill="#000000" fill-rule="evenodd"></path></g>
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
