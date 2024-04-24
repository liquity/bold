"use client";

import { brand, colors, lightTheme } from "@liquity2/uikit";

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
          gap: 32,
          width: 608,
        }}
      >
        <ColorGroup name="Brand" colors={brand} />
        <ColorGroup name="Blue" colors={filterColors(colors, "blue:")} />
        <ColorGroup name="Gray" colors={filterColors(colors, "gray:")} />
        <ColorGroup name="Yellow" colors={filterColors(colors, "yellow:")} />
        <ColorGroup name="Green" colors={filterColors(colors, "green:")} />
        <ColorGroup name="Red" colors={filterColors(colors, "red:")} />
        <ColorGroup
          name="Miscellaneous"
          colors={filterColors(colors, (name) => (
            name.includes(":") ? null : name
          ))}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            width: "100%",
          }}
        >
          <ColorGroup
            name="Light Theme"
            mode="vertical"
            colors={Object.fromEntries(
              Object
                .entries(lightTheme.colors)
                .map(([key, value]) => [
                  key,
                  colors[value],
                ]),
            )}
          />
          <ColorGroup
            name="Dark Theme"
            mode="vertical"
            colors={Object.fromEntries(
              Object
                .entries(lightTheme.colors)
                .map(([key]) => [
                  key + " (tbd)",
                  "white",
                ]),
            )}
          />
        </div>
      </div>
    </div>
  );
}

function ColorGroup({
  colors,
  name,
  mode = "horizontal",
}: {
  colors: Record<string, string>;
  name: string;
  mode?: "horizontal" | "vertical";
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
      }}
    >
      <h1
        style={{
          fontSize: 24,
          textTransform: "uppercase",
        }}
      >
        {name}
      </h1>
      <div
        style={{
          display: "flex",
          flexDirection: mode === "horizontal" ? "row" : "column",
          justifyContent: "space-between",
          gap: mode === "vertical" ? 8 : 0,
        }}
      >
        {Object.entries(colors).map(([color, value]) => (
          <Color
            key={color}
            name={color}
            value={value}
            rowMode={mode === "vertical"}
          />
        ))}
      </div>
    </div>
  );
}

function Color({
  name,
  value,
  rowMode = false,
}: {
  name: string;
  value: string;
  rowMode?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: rowMode ? "row" : "column",
        alignItems: "center",
        width: rowMode ? "100%" : 48,
        height: rowMode ? 24 : undefined,
        gap: rowMode ? 8 : 0,
      }}
    >
      <div
        style={{
          display: "flex",
          width: rowMode ? 24 : "100%",
          height: rowMode ? "100%" : 48,
          backgroundColor: value,
          borderRadius: rowMode ? 4 : 8,
          border: "1px solid #ECECEC",
        }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          width: "100%",
          height: 24,
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: "nowrap",
          textTransform: "uppercase",
        }}
      >
        {camelCaseToSpaces(name)}
      </div>
    </div>
  );
}

function camelCaseToSpaces(value: string) {
  return value.replace(/([A-Z])/g, " $1");
}

function filterColors(
  colors: Record<string, string>,
  filter: string | ((value: string) => string | null),
) {
  if (typeof filter === "string") {
    return filterColors(colors, (name) => (
      name.startsWith(filter) ? name.replace(filter, "") : null
    ));
  }
  return Object.fromEntries(
    Object.entries(colors)
      .map(([name, value]) => [filter(name), value] as const)
      .filter(([name]) => name !== null),
  );
}
