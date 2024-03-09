import type { ComponentType } from "react";

import { css } from "@/styled-system/css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBold, IconBorrow, IconEarn, IconPortfolio } from "./icons";
import { MenuItem } from "./MenuItem";

const menuItems: [
  string,
  string,
  ComponentType<{}>,
][] = [
  ["Borrow", "/borrow", IconBorrow],
  ["Earn", "/earn", IconEarn],
  ["Use BOLD", "/bold", IconBold],
  ["Portfolio", "/portfolio", IconPortfolio],
];

export function Menu() {
  const pathname = usePathname();
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
            <Link href={href}>
              <MenuItem
                icon={<Icon />}
                label={label}
                selected={pathname.startsWith(href)}
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
