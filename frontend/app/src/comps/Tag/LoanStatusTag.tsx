import { panic } from "@/src/utils";
import { css } from "@/styled-system/css";

export function LoanStatusTag({
  status,
}: {
  status: "liquidated" | "partially-redeemed" | "fully-redeemed";
}) {
  return (
    <div
      className={css({
        display: "inline-flex",
        alignItems: "center",
        height: 16,
        padding: "0 4px 1px",
        fontSize: 12,
        borderRadius: 8,
        userSelect: "none",

        "--color-liquidated": "token(colors.negativeContent)",
        "--background-liquidated": "token(colors.negative)",

        "--color-redeemed": "#121B44",
        "--background-redeemed": "token(colors.warningAlt)",
      })}
      style={status === "liquidated"
        ? {
          color: `var(--color-liquidated)`,
          background: `var(--background-liquidated)`,
        }
        : {
          color: `var(--color-redeemed)`,
          background: `var(--background-redeemed)`,
        }}
    >
      {status === "liquidated"
        ? "Liquidated"
        : status === "partially-redeemed"
        ? "Partially Redeemed"
        : status === "fully-redeemed"
        ? "Fully Redeemed"
        : panic("case not considered")}
    </div>
  );
}
