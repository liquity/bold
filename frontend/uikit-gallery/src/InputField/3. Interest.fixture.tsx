"use client";

import { InputField, lerp, norm, Slider } from "@liquity2/uikit";
import * as dn from "dnum";
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

const RATE_MIN = 1;
const RATE_MAX = 8;
const RATE_INCREMENT = 0.1;
const BUCKET_SIZE_MAX = 20_000_000;
const RATE_STEPS = Math.round((RATE_MAX - RATE_MIN) / RATE_INCREMENT) + 1;
const DEBT = dn.from(14_327.2398, 18);

const RATE_BUCKETS = Array.from({ length: RATE_STEPS }, (_, i) => {
  const rate = Math.round((RATE_MIN + i * RATE_INCREMENT) * 10) / 10;
  const baseFactor = 1 - Math.pow((i / (RATE_STEPS - 1) - 0.5) * 2, 2);
  return [rate, dn.from(Math.pow(baseFactor * Math.random(), 2) * BUCKET_SIZE_MAX, 18)];
}) as Array<[number, dn.Dnum]>;

const INTEREST_CHART = RATE_BUCKETS.map(([_, size]) => (
  Math.max(0.1, dn.toNumber(size) / Math.max(...RATE_BUCKETS.map(([_, size]) => dn.toNumber(size))))
));

function getDebtBeforeIndex(index: number) {
  let debt = dn.from(0, 18);
  for (let i = 0; i < index; i++) {
    if (!RATE_BUCKETS[i]) {
      break;
    }
    debt = dn.add(debt, RATE_BUCKETS[i][1]);
    if (i === index - 1) {
      break;
    }
  }
  return debt;
}

export default function InputFieldFixture() {
  const [value, setValue] = useFixtureInput("value", "");
  const parsedValue = parseInputFloat(value);

  const valueIndex = parsedValue
    ? Math.round((dn.toNumber(parsedValue) - RATE_MIN) / RATE_INCREMENT)
    : 0;

  const boldRedeemableInFront = dn.format(getDebtBeforeIndex(valueIndex), { compact: true });

  const boldInterestPerYear = parsedValue
    ? dn.format(dn.mul(DEBT, dn.div(parsedValue, 100)), { digits: 2, trailingZeros: true })
    : "−";

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
              chart={INTEREST_CHART}
              onChange={(value) => {
                setValue(String(Math.round(lerp(RATE_MIN, RATE_MAX, value) * 10) / 10));
              }}
              value={norm(parsedValue ? dn.toNumber(parsedValue) : 0, RATE_MIN, RATE_MAX)}
            />
          </div>
        }
        label={{ start: "Interest rate" }}
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
          start: (
            <span
              style={{
                fontWeight: 500,
              }}
            >
              <span
                style={{
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {boldInterestPerYear}
              </span>{"   "}
              BOLD / year
            </span>
          ),
          end: (
            <span
              style={{
                fontWeight: 500,
              }}
            >
              <span>{"Before you "}</span>
              <span
                style={{
                  color: "#2F3037",
                }}
              >
                <span
                  style={{
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {boldRedeemableInFront}
                </span>
                <span>{" BOLD to redeem"}</span>
              </span>
            </span>
          ),
        }}
      />
    </div>
  );
}
