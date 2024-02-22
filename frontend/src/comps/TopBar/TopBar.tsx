import { css } from ":panda/css";
import { Logo } from ":src/comps/Logo/Logo";
import { Actions } from "./Actions";
import { Menu } from "./Menu";

export function TopBar() {
  return (
    <div
      className={css({
        display: "flex",
        justifyContent: "space-between",
        width: "100%",
        height: 48 + 32,
        padding: "16px 0",
      })}
    >
      <a
        href="/"
        className={css({
          display: "flex",
          "&:active": {
            translate: "0 1px",
          },
        })}
      >
        <Logo />
      </a>
      <Menu />
      <Actions />
    </div>
  );
}
