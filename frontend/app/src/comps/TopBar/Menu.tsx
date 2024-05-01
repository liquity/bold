import type { ComponentType } from "react";

import content from "@/src/content";
import { css } from "@/styled-system/css";
import { token } from "@/styled-system/tokens";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBorrow, IconEarn, IconLeverage, IconStake } from "./icons";
import { MenuItem } from "./MenuItem";

const menuItems: [
  string,
  string,
  ComponentType<{ color: string }>,
][] = [
  [content.menu.borrow, "/borrow", IconBorrow],
  [content.menu.leverage, "/leverage", IconLeverage],
  [content.menu.earn, "/earn", IconEarn],
  [content.menu.stake, "/stake", IconStake],
];

export function Menu() {
  const pathname = usePathname();
  return (
    <nav>
      <ul
        className={css({
          display: "flex",
          gap: 8,
          height: "100%",
        })}
      >
        {menuItems.map(([label, href, Icon]) => {
          const selected = pathname.startsWith(href);
          return (
            <li key={label + href}>
              <Link
                href={href}
                className={css({
                  display: "flex",
                  height: "100%",
                  padding: "0 8px",
                  _active: {
                    translate: "0 1px",
                  },
                  _focusVisible: {
                    outline: "2px solid token(colors.focused)",
                    borderRadius: 4,
                  },
                })}
              >
                <MenuItem
                  icon={
                    <Icon
                      color={token(
                        `colors.${selected ? "selected" : "interactive"}`,
                      )}
                    />
                  }
                  label={label}
                  selected={selected}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
