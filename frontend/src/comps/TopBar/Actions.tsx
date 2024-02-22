import { css } from ":panda/css";
import { IconAccount, IconStats } from "./icons";
import { MenuItem } from "./MenuItem";

export function Actions() {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
      })}
    >
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
