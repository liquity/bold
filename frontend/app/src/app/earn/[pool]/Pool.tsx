"use client";

import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { Button, InputField, Tabs, TextButton, TokenIcon, TokenIconGroup } from "@liquity2/uikit";
import * as dn from "dnum";
import { useState } from "react";
import { POOLS } from "../pools";

const TABS = [
  { label: "Deposit", id: "deposit" },
  { label: "Withdraw", id: "withdraw" },
  { label: "Claim rewards", id: "claim" },
] as const;

export function Pool({ pool }: { pool: typeof POOLS[number] }) {
  const [tab, setTab] = useState(0);
  return (
    <>
      <PoolHeader pool={pool} />
      <MyDeposit pool={pool} />
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 24,
          width: "100%",
        })}
      >
        <Tabs
          selected={tab}
          onSelect={setTab}
          items={TABS.map((tab) => ({
            label: tab.label,
            panelId: `panel-${tab.id}`,
            tabId: `tab-${tab.id}`,
          }))}
        />
        {tab === 0 && <DepositField />}
        {tab !== 0 && (
          <div
            className={css({
              display: "flex",
              justifyContent: "center",
              width: "100%",
              paddingTop: 48,
            })}
          >
            <Button
              label={TABS[tab].label}
              mode="primary"
              size="large"
              wide
            />
          </div>
        )}
      </div>
    </>
  );
}

function PoolHeader({ pool }: { pool: typeof POOLS[number] }) {
  return (
    <div
      className={css({
        display: "flex",
        width: "100%",
        justifyContent: "space-between",
      })}
    >
      <div
        className={css({
          display: "flex",
          width: "100%",
          gap: 24,
        })}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            paddingTop: 8,
          })}
        >
          <TokenIconGroup size="large">
            <TokenIcon symbol="BOLD" />
            <TokenIcon symbol={pool.symbol} />
          </TokenIconGroup>
        </div>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          })}
        >
          <div
            className={css({
              fontSize: 24,
            })}
          >
            {pool.token} pool
          </div>
          <div
            className={css({
              color: "contentAlt",
              whiteSpace: "nowrap",
            })}
          >
            TVL {pool.boldQty}
          </div>
        </div>
      </div>
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-end",
        })}
      >
        <div
          className={css({
            fontSize: 24,
          })}
        >
          {pool.apy}
        </div>
        <div
          className={css({
            color: "contentAlt",
            whiteSpace: "nowrap",
          })}
        >
          Current <abbr title="Annual percentage yield">APY</abbr>
        </div>
      </div>
    </div>
  );
}

function MyDeposit({ pool }: { pool: typeof POOLS[number] }) {
  return pool.deposit && (
    <div
      className={css({
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        width: "100%",
        padding: 24,
        background: "#F8F6F4",
        borderRadius: 8,
      })}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 8,
        })}
      >
        <div
          className={css({
            color: "contentAlt",
          })}
        >
          My deposit
        </div>
        <div
          className={css({})}
        >
          {pool.deposit}
        </div>
      </div>
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 8,
        })}
      >
        <div
          className={css({
            color: "contentAlt",
          })}
        >
          Unclaimed rewards
        </div>
        {pool.rewards && (
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              color: "positive",
            })}
          >
            {pool.rewards[0]}
            <div
              className={css({
                display: "flex",
                width: 4,
                height: 4,
                borderRadius: "50%",
                backgroundColor: "dimmed",
              })}
            />
            {pool.rewards[1]}
          </div>
        )}
      </div>
    </div>
  );
}

export function DepositField() {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const parsedValue = parseInputValue(value);

  const action = (
    <Action
      label="BOLD"
      icon={<TokenIcon symbol="BOLD" />}
    />
  );

  const secondaryStart = "Share in the pool";

  const secondaryEnd = (
    <TextButton
      label="Max 10.00 ETH"
      onClick={() => setValue("10")}
    />
  );

  const value_ = (focused || !parsedValue) ? value : `${dn.format(parsedValue)} ETH`;

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
      <InputField
        action={action}
        label="You deposit"
        onFocus={() => setFocused(true)}
        onChange={setValue}
        onBlur={() => setFocused(false)}
        value={value_}
        placeholder="0.00"
        secondaryStart={secondaryStart}
        secondaryEnd={secondaryEnd}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <Button
          label="Add Deposit"
          mode="primary"
          size="large"
          wide
        />
      </div>
    </div>
  );
}

function parseInputValue(value: string) {
  value = value.trim();
  if (!isInputValueFloat(value)) {
    return null;
  }
  value = value
    .replace(/\.$/, "")
    .replace(/^\./, "0.");
  return dn.from(value === "" ? 0 : value, 18);
}

function isInputValueFloat(value: string) {
  value = value.trim();
  return value && /^[0-9]*\.?[0-9]*?$/.test(value);
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
