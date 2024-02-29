import type { ComponentType } from "react";

import { useTheme } from ":src/theme";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  main: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    height: 32,
    padding: "0 12px",
    color: "content",
    translate: {
      default: null,
      ":active": "0 1px",
    },
  },
  selected: {
    color: "accent",
  },
});

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
        {...stylex.props(styles.main)}
        style={{ color: color(selected ? "accent" : "content") }}
      >
        {label}
        <Icon color={color(selected ? "accent" : "content")} />
      </div>
    </a>
  );
}
