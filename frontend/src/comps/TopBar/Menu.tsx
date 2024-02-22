import type { ComponentType } from "react";

import { css } from ":panda/css";
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

export function Menu() {
  return (
    <nav>
      <ul
        className={css({
          display: "flex",
          alignItems: "center",
          height: "100%",
        })}
      >
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
