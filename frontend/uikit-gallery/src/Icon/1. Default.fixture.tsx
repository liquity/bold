"use client";

import { colors } from "@liquity2/uikit";
import * as icons from "@liquity2/uikit/icons";
import { useFixtureSelect } from "react-cosmos/client";

const colorsContrasted = Object.fromEntries(
  Object.entries(colors)
    .filter(([name]) => {
      const parsed = name.split(":");
      const shadeNumber = parseInt(parsed[1], 10);
      return !isNaN(shadeNumber) && shadeNumber >= 500;
    }),
) as Record<keyof typeof colors, string>;

const colorNames = Object.keys(colorsContrasted) as (keyof typeof colorsContrasted)[];

export default function IconFixture() {
  const [colorMode] = useFixtureSelect("color", {
    options: colorNames,
    defaultValue: "blue:950",
  });
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 8,
        padding: 16,
        color: colorsContrasted[colorMode],
      }}
    >
      {Object
        .entries(icons)
        .map(([name, Icon]) => <Icon key={name} />)}
    </div>
  );
}
