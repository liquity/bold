"use client";

import { Logo } from "@/src/comps/Logo/Logo";
import { css } from "@/styled-system/css";
import Link from "next/link";
import { Actions } from "./Actions";
import { Menu } from "./Menu";

export function TopBar() {
  return (
    <div
      className={css({
        display: "flex",
        justifyContent: "space-between",
        width: "100%",
        height: 48 + 32,
        padding: "16px 0",
      })}
    >
      <Link
        href="/"
        className={css({
          display: "flex",
          _active: {
            translate: "0 1px",
          },
        })}
      >
        <Logo />
      </Link>
      <Menu />
      <Actions />
    </div>
  );
}
