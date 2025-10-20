import { css } from "@/styled-system/css";
import { IconCheckmark } from "@liquity2/uikit";

export function TagConfirmed() {
  return (
    <div
      className={css({
        position: "absolute",
        top: 16,
        right: 16,
        display: "flex",
        alignItems: "center",
        gap: 8,
        textTransform: "uppercase",
        fontSize: 12,
        color: "brandGreen",
        userSelect: "none",
      })}
    >
      Confirmed
      <IconCheckmark size={16} />
    </div>
  );
}
