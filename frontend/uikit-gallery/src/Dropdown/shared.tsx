"use client";

import type { ComponentProps } from "react";

import { Dropdown, TokenIcon } from "@liquity2/uikit";
import { useEffect, useState } from "react";
import { useFixtureInput } from "react-cosmos/client";

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

function PlaceholderIcon() {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        width: 24,
        height: 24,
        background: "#1C1D4F",
        borderRadius: "50%",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      T
    </div>
  );
}

export function DropdownFixture({
  fixture,
}: {
  fixture: "default" | "placeholder";
}) {
  const [showIcon] = useFixtureInput("show icon", true);
  const [placeholder] = useFixtureInput("placeholder", fixture === "placeholder");
  const [selected, setSelected] = useState(-1);

  useEffect(() => {
    setSelected(placeholder ? -1 : 0);
  }, [placeholder]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        width: "100%",
        paddingLeft: 200,
        fontSize: 16,
      }}
    >
      <Dropdown
        buttonDisplay={showIcon ? "normal" : "label-only"}
        placeholder={selected === -1
          ? {
            label: "Select a token",
            icon: <PlaceholderIcon />,
          }
          : undefined}
        items={[
          itemRow("ETH", "ETH", "10.00"),
          itemRow("RETH", "rETH", "30.00"),
          itemRow("WSTETH", "wstETH", "40.00"),
          itemRow("SWETH", "swETH", "50.00"),
        ]}
        menuWidth={300}
        onSelect={setSelected}
        selected={selected}
      />
    </div>
  );
}
