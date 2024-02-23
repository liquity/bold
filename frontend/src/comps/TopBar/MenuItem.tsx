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
  // const color = pathname.startsWith(href) ? palette.sky : palette.blue;
  return (
    <a href={href}>
      <div
        aria-selected={true}
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
        <Icon color={color("accent")} />
      </div>
    </a>
  );
}
