import { css } from "@/styled-system/css";

export function LoanStatusTag({
  status,
}: {
  status: "liquidated" | "redeemed";
}) {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        height: 16,
        padding: "0 4px 1px",
        fontSize: 12,
        color: "infoSurfaceContent",
        background: "infoSurface",
        borderRadius: 8,
        userSelect: "none",

        "--color-liquidated": "token(colors.negativeContent)",
        "--background-liquidated": "token(colors.negative)",

        "--color-redeemed": "#121B44",
        "--background-redeemed": "token(colors.warningAlt)",
      })}
      style={{
        color: `var(--color-${status})`,
        background: `var(--background-${status})`,
      }}
    >
      {status === "liquidated" ? "Liquidated" : "Redeemed"}
    </div>
  );
}
