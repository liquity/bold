import { Field } from "@/src/comps/Field/Field";
import content from "@/src/content";
import { POOLS } from "@/src/demo-data";
import { parseInputFloat } from "@/src/form-utils";
import { css } from "@/styled-system/css";
import { Button, Checkbox, InputField, TextButton, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import { useState } from "react";

export function DepositPanel({ pool }: { pool: typeof POOLS[number] }) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [claimRewards, setClaimRewards] = useState(false);

  const parsedValue = parseInputFloat(value);

  const secondaryStart = "Share in the pool";

  const secondaryEnd = (
    <TextButton
      label="Max. 10,000.00 BOLD"
      onClick={() => setValue("10000")}
    />
  );

  const value_ = (focused || !parsedValue) ? value : `${dn.format(parsedValue)} BOLD`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: "100%",
        gap: 48,
      }}
    >
      <Field
        field={
          <InputField
            action={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  height: 40,
                  padding: "0 16px",
                  paddingLeft: 8,
                  background: "#FFF",
                  borderRadius: 20,
                  userSelect: "none",
                }}
              >
                <TokenIcon symbol="BOLD" />
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 500,
                  }}
                >
                  BOLD
                </div>
              </div>
            }
            label={content.earnScreen.depositPanel.label}
            onFocus={() => setFocused(true)}
            onChange={setValue}
            onBlur={() => setFocused(false)}
            value={value_}
            placeholder="0.00"
            secondaryStart={secondaryStart}
            secondaryEnd={secondaryEnd}
          />
        }
        footerStart={
          <label
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              userSelect: "none",
            })}
          >
            <Checkbox
              checked={claimRewards}
              onChange={setClaimRewards}
            />
            {content.earnScreen.depositPanel.claimCheckbox}
          </label>
        }
        footerEnd={pool.rewards && (
          <div
            className={css({
              display: "flex",
              gap: 24,
            })}
          >
            <div>
              {pool.rewards.bold}{" "}
              <span
                className={css({
                  color: "contentAlt",
                })}
              >
                BOLD
              </span>
            </div>
            <div>
              {pool.rewards.eth}{" "}
              <span
                className={css({
                  color: "contentAlt",
                })}
              >
                BOLD
              </span>
            </div>
          </div>
        )}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <Button
          disabled={!parsedValue}
          label={content.earnScreen.depositPanel.action}
          mode="primary"
          size="large"
          wide
        />
      </div>
    </div>
  );
}
