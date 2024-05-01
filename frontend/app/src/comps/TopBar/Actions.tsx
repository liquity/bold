import { css } from "@/styled-system/css";
import { AccountButton } from "./AccountButton";

export function Actions() {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
      })}
    >
      <AccountButton />
    </div>
  );
}
