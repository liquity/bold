"use client";

import type { Dnum } from "dnum";
import type { ReactNode } from "react";

import { Field } from "@/src/comps/Field/Field";
import { Screen } from "@/src/comps/Screen/Screen";
import { parseInputFloat } from "@/src/form-utils";
import { Button, HFlex, InputField, Tabs, TextButton, TokenIcon } from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

const TABS = [
  { label: "Deposit", id: "deposit" },
  { label: "Withdraw", id: "withdraw" },
  { label: "Claim rewards", id: "claim" },
];

export function StakeScreen() {
  const router = useRouter();
  const { action = "deposit" } = useParams();

  const tab = TABS.findIndex(({ id }) => id === action);

  const deposit = useInputFieldValue((value) => `${dn.format(value)} LQTY`);

  return (
    <Screen
      title={
        <HFlex>
          <span>Stake</span>
          <TokenIcon size={24} symbol="LQTY" />
          <span>LQTY & get</span>
          <TokenIcon.Group>
            <TokenIcon symbol="LUSD" />
            <TokenIcon symbol="ETH" />
          </TokenIcon.Group>
          <span>LUSD + ETH</span>
        </HFlex>
      }
    >
      <Tabs
        items={TABS.map(({ label, id }) => ({
          label,
          panelId: `p-${id}`,
          tabId: `t-${id}`,
        }))}
        selected={tab}
        onSelect={(index) => {
          router.push(`/stake/${TABS[index].id}`);
        }}
      />
      <Field
        field={
          <InputField
            action={
              <StaticAction
                icon={<TokenIcon symbol="LQTY" />}
                label="LQTY"
              />
            }
            label="You deposit"
            placeholder="0.00"
            secondaryStart="$0.00"
            secondaryEnd={
              <TextButton
                label={`Max. 100.00 LQTY`}
                onClick={() => deposit.setValue("100.00")}
              />
            }
            {...deposit.inputFieldProps}
          />
        }
        footerStart={null}
        footerEnd={null}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <Button
          disabled={!(deposit.parsed && dn.gt(deposit.parsed, 0))}
          label="Stake"
          mode="primary"
          size="large"
          wide
        />
      </div>
    </Screen>
  );
}

function StaticAction({
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

function useInputFieldValue(format: (value: Dnum) => string) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const parsed = parseInputFloat(value);
  return {
    inputFieldProps: {
      onBlur: () => setFocused(false),
      onChange: (value: string) => setValue(value),
      onFocus: () => setFocused(true),
      value: focused || !parsed || !value.trim() ? value : format(parsed),
    },
    parsed,
    setValue,
    value,
  };
}
