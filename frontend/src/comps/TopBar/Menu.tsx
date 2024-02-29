import type { ComponentType } from "react";

import * as stylex from "@stylexjs/stylex";
import { IconBold, IconBorrow, IconEarn, IconPortfolio } from "./icons";
import { MenuItem } from "./MenuItem";

const menuItems: [
  string,
  string,
  ComponentType<{ color: string }>,
][] = [
  ["Borrow", "/borrow", IconBorrow],
  ["Earn", "/earn", IconEarn],
  ["Use BOLD", "/bold", IconBold],
  ["Portfolio", "/portfolio", IconPortfolio],
];

const styles = stylex.create({
  main: {
    display: "flex",
    alignItems: "center",
    height: "100%",
  },
});

export function Menu() {
  return (
    <nav>
      <ul {...stylex.props(styles.main)}>
        {menuItems.map(([label, href, Icon]) => (
          <li key={label + href}>
            <MenuItem
              Icon={Icon}
              href={href}
              label={label}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
