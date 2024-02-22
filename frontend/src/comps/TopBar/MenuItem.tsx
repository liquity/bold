import type { ComponentType } from "react";

import { css } from ":panda/css";
import { palette } from ":src/colors";

export function MenuItem({
  Icon,
  href,
  label,
}: {
  Icon: ComponentType<{ color: string }>;
  href: string;
  label: string;
}) {
  // const color = pathname.startsWith(href) ? palette.sky : palette.blue;
  const color = palette.blue;
  return (
    <a href={href}>
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 12,
          height: 32,
          padding: "0 12px",
          "&:active": {
            translate: "0 1px",
          },
        })}
        style={{ color }}
      >
        {label}
        <Icon color={color} />
      </div>
    </a>
  );
}
