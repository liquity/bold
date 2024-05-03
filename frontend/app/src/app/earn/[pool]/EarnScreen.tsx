"use client";

import type { ReactNode } from "react";

import { BackButton } from "@/src/comps/BackButton/BackButton";
import content from "@/src/content";
import { POOLS } from "@/src/demo-data";
import { css } from "@/styled-system/css";
import { Button, Checkbox, InputField, Tabs, TextButton, TokenIcon, TokenIconGroup } from "@liquity2/uikit";
import * as dn from "dnum";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

const TABS = [
  { action: "deposit", label: content.earnScreen.tabs.deposit },
  { action: "withdraw", label: content.earnScreen.tabs.withdraw },
  { action: "claim", label: content.earnScreen.tabs.claim },
] as const;

type Action = typeof TABS[number]["action"];

export function EarnScreen() {
  const { pool: poolName, action = "deposit" } = useParams();

  const router = useRouter();
  const pool = POOLS.find(({ symbol }) => symbol.toLowerCase() === poolName);
  const tab = TABS.find((tab) => tab.action === action);

  return pool && tab && (
    <div
      className={css({
        flexGrow: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 48,
        width: 534,
      })}
    >
      <BackButton href="/earn" label={content.earnScreen.backButton} />
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
          selected={TABS.indexOf(tab)}
          onSelect={(index) => {
            router.push(`/earn/${poolName}/${TABS[index].action}`);
          }}
          items={TABS.map((tab) => ({
            label: tab.label,
            panelId: `panel-${tab.action}`,
            tabId: `tab-${tab.action}`,
          }))}
        />
        {tab.action === "deposit" && <DepositField pool={pool} />}
        {tab.action === "withdraw" && (
          <div
            className={css({
              display: "flex",
              justifyContent: "center",
              width: "100%",
              paddingTop: 48,
            })}
          >
            <Button
              label={tab.label}
              mode="primary"
              size="large"
              wide
            />
          </div>
        )}
        {tab.action === "claim" && (
          <div
            className={css({
              display: "flex",
              justifyContent: "center",
              width: "100%",
              paddingTop: 48,
            })}
          >
            <Button
              label={tab.label}
              mode="primary"
              size="large"
              wide
            />
          </div>
        )}
      </div>
    </div>
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
            {content.earnScreen.headerTvl(pool.boldQty)}
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
          {content.earnScreen.headerApy()}
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
          {content.earnScreen.myDeposit}
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
          {content.earnScreen.unclaimedRewards}
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

export function DepositField({ pool }: { pool: typeof POOLS[number] }) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [claimRewards, setClaimRewards] = useState(false);

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
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 16,
        })}
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
          className={css({
            display: "flex",
            justifyContent: "space-between",
          })}
        >
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
            {content.earnScreen.depositField.claimCheckbox}
          </label>
          {pool.rewards && (
            <div
              className={css({
                display: "flex",
                gap: 24,
              })}
            >
              <div>{pool.rewards[0]}</div>
              <div>{pool.rewards[1]}</div>
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <Button
          disabled={!parsedValue}
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
