import { Logo } from ":src/comps/Logo/Logo";
import * as stylex from "@stylexjs/stylex";
import { Actions } from "./Actions";
import { Menu } from "./Menu";

const styles = stylex.create({
  main: {
    display: "flex",
    justifyContent: "space-between",
    width: "100%",
    height: 48 + 32,
    padding: "16px 0",
  },
  logo: {
    display: "flex",
    ":active": {
      translate: "0 1px",
    },
  },
});

export function TopBar() {
  return (
    <div {...stylex.props(styles.main)}>
      <a
        href="/"
        {...stylex.props(styles.logo)}
      >
        <Logo />
      </a>
      <Menu />
      <Actions />
    </div>
  );
}
