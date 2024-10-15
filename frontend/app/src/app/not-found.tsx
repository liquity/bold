import { css } from "@/styled-system/css";

export default function NotFoundPage() {
  return (
    <div
      className={css({
        flexGrow: 1,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
      })}
    >
      Not Found
    </div>
  );
}
