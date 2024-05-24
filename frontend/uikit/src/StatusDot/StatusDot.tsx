import { css } from "../../styled-system/css";

export function StatusDot({
  size = 12,
  mode,
}: {
  size?: number;
  mode: "positive" | "warning" | "negative";
}) {
  return (
    <div
      className={css({
        borderRadius: "50%",
        "--status-dot-positive": "token(colors.positive)",
        "--status-dot-warning": "token(colors.warning)",
        "--status-dot-negative": "token(colors.negative)",
      })}
      style={{
        background: `var(--status-dot-${mode})`,
        height: size,
        width: size,
      }}
    />
  );
}
