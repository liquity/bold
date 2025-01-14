"use client";

import type { ComponentProps } from "react";

import { Dropdown, TokenIcon } from "@liquity2/uikit";
import { useEffect, useState } from "react";
import { useFixtureInput } from "react-cosmos/client";

function tokenItemRow(
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
  fixture: "default" | "placeholder" | "small";
}) {
  const [showIcon] = useFixtureInput("show icon", true);
  const [placeholder] = useFixtureInput("placeholder", fixture === "placeholder");
  const [small] = useFixtureInput("small", fixture === "small");
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
        items={small
          ? [{
            label: "Manually",
            secondary: "Set the interest rate as you see fit",
          }, {
            label: "By Strategy",
            secondary: "It’s an automated strategy developed by ICP that helps avoid redemption and reduce costs",
          }, {
            label: "By Delegation",
            secondary: `
              Delegates manage your interest rate, optimizing costs and preventing redemption.
              They charge a fee for this.
            `,
          }]
          : [
            tokenItemRow("ETH", "ETH", "10.00"),
            tokenItemRow("RETH", "rETH", "30.00"),
            tokenItemRow("WSTETH", "wstETH", "40.00"),
          ]}
        menuWidth={300}
        onSelect={setSelected}
        selected={selected}
        size={small ? "small" : "medium"}
      />
    </div>
  );
}
