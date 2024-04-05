import { AppLauncher } from "@/src/comps/AppLauncher/AppLauncher";
import { css } from "@/styled-system/css";

export default function Home() {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        width: "100%",
        height: "100%",
      })}
    >
      <AppLauncher />
    </div>
  );
}
