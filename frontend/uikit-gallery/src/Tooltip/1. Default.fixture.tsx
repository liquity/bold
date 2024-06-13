"use client";

import { IconInfo, TextButton, Tooltip } from "@liquity2/uikit";

export default function TooltipFixture() {
  return (
    <Tooltip
      opener={({ buttonProps, setReference }) => (
        <TextButton
          ref={setReference}
          label={<IconInfo />}
          {...buttonProps}
        />
      )}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <h1>55M BOLD to redeem before you</h1>
        <p
          style={{
            fontSize: 14,
            color: "#878AA4",
          }}
        >
          {`
            A redemption is an event where the borrower's collateral is exchanged for
            a corresponding amount of Bold stablecoins. At the time of the exchange
            a borrower does not lose any money.
          `}
        </p>
      </div>
    </Tooltip>
  );
}
