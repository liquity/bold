import type { ComponentType } from "react";

import { css } from ":panda/css";
import { useTheme } from ":src/theme";

export function MenuItem({
  Icon,
  href,
  label,
}: {
  Icon: ComponentType<{ color: string }>;
  href: string;
  label: string;
}) {
  const { color } = useTheme();

  // const selected = pathname.startsWith(href)
  const selected = false;

  return (
    <a href={href}>
      <div
        aria-selected={selected}
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 12,
          height: 32,
          padding: "0 12px",
          color: "content",
          _selected: {
            color: "accent",
          },
          "&:active": {
            translate: "0 1px",
          },
        })}
      >
        {label}
        <Icon color={color(selected ? "accent" : "content")} />
      </div>
    </a>
  );
}
