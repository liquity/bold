"use client";

import { Tabs } from "@liquity2/uikit";
import { useEffect, useState } from "react";
import { useFixtureSelect } from "react-cosmos/client";

export default function Fixture() {
  const [selected, setSelected] = useState(0);
  const [tabs] = useFixtureSelect("tabs", {
    options: Array.from({ length: 8 }, (_, i) => `${i + 2}`),
    defaultValue: "3",
  });
  const [width] = useFixtureSelect("width", {
    options: ["360", "600", "960"],
    defaultValue: "600",
  });
  const items = Array.from(
    { length: Math.max(2, parseInt(tabs)) },
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
        width: parseInt(width),
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
