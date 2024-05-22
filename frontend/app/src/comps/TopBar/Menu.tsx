import type { ComponentType } from "react";

import { css } from "@/styled-system/css";
import { token } from "@/styled-system/tokens";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuItem } from "./MenuItem";

export function Menu({
  hovered = -1,
  menuItems,
  onHover,
}: {
  hovered: number;
  menuItems: [
    string,
    string,
    ComponentType<{ color: string }>,
  ][];
  onHover: (index: number) => void;
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
        {menuItems.map(([label, href, Icon], index) => {
          const selected = hovered === -1
            ? pathname.startsWith(href)
            : hovered === index;
          return (
            <li key={label + href}>
              <Link
                href={href}
                onMouseEnter={() => onHover(index)}
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
