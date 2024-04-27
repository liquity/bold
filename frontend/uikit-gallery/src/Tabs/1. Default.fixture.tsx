"use client";

import { Tabs } from "@liquity2/uikit";
import { useEffect, useState } from "react";
import { useFixtureInput } from "react-cosmos/client";

export default function Fixture() {
  const [selected, setSelected] = useState(0);
  const [tabs] = useFixtureInput("tabs", 3);
  const items = Array.from(
    { length: Math.max(2, tabs) },
    (_, i) => `Item ${i + 1}`,
  );

  const [idPrefix, setIdPrefix] = useState("");
  useEffect(() => {
    setIdPrefix(String(Date.now()));
  }, [tabs]);

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
        items={items.map((label, index) => ({
          label,
          panelId: `${idPrefix}${index}-panel`,
          tabId: `${idPrefix}${index}-tab`,
        }))}
        onSelect={setSelected}
        selected={selected}
      />
    </div>
  );
}
