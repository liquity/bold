import * as stylex from "@stylexjs/stylex";
import { IconAccount, IconStats } from "./icons";
import { MenuItem } from "./MenuItem";

const styles = stylex.create({
  main: {
    display: "flex",
    alignItems: "center",
  },
});

export function Actions() {
  return (
    <div {...stylex.props(styles.main)}>
      <MenuItem
        Icon={IconStats}
        href="/stats"
        label="Stats"
      />
      <MenuItem
        Icon={IconAccount}
        href="/account"
        label="Account"
      />
    </div>
  );
}
