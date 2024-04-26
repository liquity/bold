"use client";

export function ColorGroup({
  colors,
  mode = "horizontal",
  name,
  secondary = (_, value) => value,
}: {
  colors: Record<string, string>;
  mode?: "horizontal" | "vertical";
  name: string;
  secondary?: null | ((name: string, value: string) => string);
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
        {Object.keys(colors).map((color: keyof (typeof colors)) => (
          <Color
            key={color}
            name={color}
            value={colors[color]}
            rowMode={mode === "vertical"}
            secondary={secondary?.(color, colors[color])}
          />
        ))}
      </div>
    </div>
  );
}

export function Color({
  name,
  rowMode = false,
  secondary,
  value,
}: {
  name: string;
  rowMode?: boolean;
  secondary?: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: rowMode ? "row" : "column",
        alignItems: "center",
        width: rowMode ? "100%" : 48,
        height: rowMode ? 32 : undefined,
        gap: rowMode ? 8 : 0,
      }}
    >
      <div
        style={{
          flexShrink: 0,
          flexGrow: 0,
          display: "flex",
          width: rowMode ? 32 : "100%",
          height: rowMode ? "100%" : 48,
          backgroundColor: value,
          borderRadius: rowMode ? 4 : 8,
          border: "1px solid #ECECEC",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          alignItems: "flex-start",
          width: "100%",
          paddingTop: rowMode ? 0 : 8,
          fontSize: 10,
          whiteSpace: "nowrap",
          textTransform: "uppercase",
        }}
      >
        <div
          style={{
            fontWeight: 500,
            color: "#333",
          }}
        >
          {camelCaseToSpaces(name)}
        </div>
        {secondary && (
          <div
            style={{
              fontWeight: 400,
              color: "#757575",
            }}
          >
            {secondary}
          </div>
        )}
      </div>
    </div>
  );
}

export function camelCaseToSpaces(value: string) {
  return value.replace(/([A-Z])/g, " $1");
}

export function filterColors(
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
