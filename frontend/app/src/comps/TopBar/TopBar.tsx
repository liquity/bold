"use client";

import { Logo } from "@/src/comps/Logo/Logo";
import content from "@/src/content";
import { css } from "@/styled-system/css";
import Link from "next/link";
import { AccountButton } from "./AccountButton";
import { Menu } from "./Menu";

export function TopBar() {
  return (
    <div
      className={css({
        display: "flex",
        justifyContent: "space-between",
        width: "100%",
        height: 72,
        padding: "16px 0",
        fontSize: 16,
        fontWeight: 500,
      })}
    >
      <Link
        href="/"
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 16,
          height: "100%",
          paddingRight: 8,
          _focusVisible: {
            borderRadius: 4,
            outline: "2px solid token(colors.focused)",
          },
          _active: {
            translate: "0 1px",
          },
        })}
      >
        <Logo />
        {content.appName}
      </Link>
      <Menu />
      <AccountButton />
    </div>
  );
}
