"use client";

import { Tabs } from "@liquity2/uikit";
import { useState } from "react";

const items = [
  { label: "Deposit", panelId: "deposit", tabId: "deposit" },
  { label: "Withdraw", panelId: "withdraw", tabId: "withdraw" },
  { label: "Claim Rewards", panelId: "claimRewards", tabId: "claimRewards" },
];

export default function Fixture() {
  const [selected, setSelected] = useState(0);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        width: 640,
        padding: 16,
      }}
    >
      <Tabs
        items={items}
        onSelect={setSelected}
        selected={selected}
      />
    </div>
  );
}
