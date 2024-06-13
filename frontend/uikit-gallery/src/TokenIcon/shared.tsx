"use client";

import { TokenIcon } from "@liquity2/uikit";
import { useFixtureSelect } from "react-cosmos/client";

const options = [
  "BOLD" as const,
  "ETH" as const,
  "RETH" as const,
  "WSTETH" as const,
];

const emptyOption = "−";

function isNotEmptyOption(
  value: (typeof options)[number] | typeof emptyOption,
): value is Exclude<typeof value, typeof emptyOption> {
  return value !== emptyOption;
}

export function TokenIconFixture({
  defaultMode,
}: {
  defaultMode: "single" | "group";
}) {
  const symbols = options.map((name, index) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useFixtureSelect(`token ${index + 1}`, {
      options: [emptyOption, ...options],
      defaultValue: defaultMode === "single" && index > 0 ? emptyOption : name,
    })[0];
  });

  const validSymbols = symbols.filter(isNotEmptyOption);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
      }}
    >
      <TokenIcon.Group>
        {validSymbols.map((symbol, index) => (
          <TokenIcon
            key={symbol + index}
            symbol={symbol}
          />
        ))}
      </TokenIcon.Group>
    </div>
  );
}
