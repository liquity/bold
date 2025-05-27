"use client";

import { colors, darkTheme } from "@liquity2/uikit";
import { ColorGroup } from "./shared";

export default function ThemeFixture() {
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
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            width: "100%",
            gap: 80,
          }}
        >
          <ColorGroup
            name="Light Theme"
            mode="vertical"
            colors={Object.fromEntries(
              Object
                .entries(darkTheme.colors)
                .map(([key, value]) => [
                  key,
                  colors[value as keyof typeof colors],
                ]),
            )}
            secondary={(name) => darkTheme.colors[name as keyof typeof darkTheme.colors]}
          />
          <ColorGroup
            name="Dark Theme"
            mode="vertical"
            colors={Object.fromEntries(
              Object
                .entries(darkTheme.colors)
                .map(([key]) => [key, "white"]),
            )}
            secondary={() => "tbd"}
          />
        </div>
      </div>
    </div>
  );
}
