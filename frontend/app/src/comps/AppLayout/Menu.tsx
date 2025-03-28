import type { ComponentType } from "react";

import { css } from "@/styled-system/css";
import { token } from "@/styled-system/tokens";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuItem } from "./MenuItem";

export type MenuItem = [
  label: string,
  url: string,
  Icon: ComponentType<{}>,
];

export function Menu({
  menuItems,
}: {
  menuItems: MenuItem[];
}) {
  const pathname = usePathname();
  return (
    <nav
      className={css({
        display: "none",
        large: {
          display: "block",
        },
      })}
    >
      <ul
        className={css({
          position: "relative",
          zIndex: 2,
          display: "flex",
          gap: 8,
          height: "100%",
        })}
      >
        {menuItems.map(([label, href, Icon]) => {
          const selected = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
                style={{
                  color: token(
                    `colors.${selected ? "selected" : "interactive"}`,
                  ),
                }}
              >
                <MenuItem
                  icon={<Icon />}
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
