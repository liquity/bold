import { css } from "@/styled-system/css";
import { IconEye } from "@liquity2/uikit";

export function TagPreview() {
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
        color: "brandGolden",
        userSelect: "none",
      })}
    >
      Preview
      <IconEye size={16} />
    </div>
  );
}
