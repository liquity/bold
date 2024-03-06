import type { ComponentType } from "react";

import { useTheme } from "@/src/theme";
import * as stylex from "@stylexjs/stylex";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
    cursor: "pointer",
    userSelect: "none",
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
  href?: string;
  label: string;
}) {
  const { color } = useTheme();

  const pathname = usePathname();
  const selected = Boolean(href && pathname.startsWith(href));

  const item = (
    <div
      aria-selected={selected}
      {...stylex.props(styles.main)}
      style={{ color: color(selected ? "accent" : "content") }}
    >
      {label}
      <Icon color={color(selected ? "accent" : "content")} />
    </div>
  );

  return href
    ? <Link href={href}>{item}</Link>
    : item;
}
