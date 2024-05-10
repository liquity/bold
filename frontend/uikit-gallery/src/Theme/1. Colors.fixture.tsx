"use client";

import { colors } from "@liquity2/uikit";
import { ColorGroup, filterColors } from "./shared";

export default function ColorsFixture() {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        padding: 64,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 32,
          width: 640,
        }}
      >
        <ColorGroup
          name="Brand"
          colors={filterColors(colors, "brand:")}
        />
        <ColorGroup
          name="Blue"
          colors={filterColors(colors, "blue:")}
        />
        <ColorGroup
          name="Gray"
          colors={filterColors(colors, "gray:")}
        />
        <ColorGroup
          name="Yellow"
          colors={filterColors(colors, "yellow:")}
        />
        <ColorGroup
          name="Green"
          colors={filterColors(colors, "green:")}
        />
        <ColorGroup
          name="Red"
          colors={filterColors(colors, "red:")}
        />
        <ColorGroup
          name="Miscellaneous"
          colors={filterColors(colors, (name) => (
            name.includes(":") ? null : name
          ))}
        />
      </div>
    </div>
  );
}
