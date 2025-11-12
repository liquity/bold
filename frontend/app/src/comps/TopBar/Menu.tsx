import type { ComponentType } from "react";

import { css } from "@/styled-system/css";
import { token } from "@/styled-system/tokens";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuItem } from "./MenuItem";

export type MenuItemType =
  | 'dashboard'
  | 'borrow'
  | 'multiply'
  | 'earn'
  | 'buy'
  | 'stream'
  | 'ecosystem'
  // | 'stake';

export type HrefTarget = '_self' | '_blank';

export function Menu({
  menuItems,
}: {
  menuItems: [
    string,
    string,
    ComponentType<{}>,
    MenuItemType,
    HrefTarget
  ][];
}) {
  const pathname = usePathname();
  return (
    <nav>
      <ul
        className={css({
          position: "relative",
          zIndex: 2,
          display: "flex",
          gap: 8,
          height: "100%",
        })}
      >
        {menuItems.map(([label, href, Icon, type, target]) => {
          const external = href.startsWith("http");
          const selected = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={label + href}>
              <Link
                href={href}
                target={external ? target : undefined}
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
                style={{
                  color: token(
                    `colors.${selected && !external ? "selected" : "interactive"}`,
                  ),
                }}
              >
                <MenuItem
                  icon={<Icon />}
                  label={label}
                  selected={selected}
                  type={type}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
