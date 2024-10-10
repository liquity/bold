"use client";

import type { ComponentProps } from "react";

import { Logo } from "@/src/comps/Logo/Logo";
import content from "@/src/content";
import { css } from "@/styled-system/css";
import { IconBorrow, IconDashboard, IconEarn, IconLeverage, IconStake } from "@liquity2/uikit";
import Link from "next/link";
import { AccountButton } from "./AccountButton";
import { Menu } from "./Menu";

const menuItems: ComponentProps<typeof Menu>["menuItems"] = [
  [content.menu.dashboard, "/", IconDashboard],
  [content.menu.borrow, "/borrow", IconBorrow],
  [content.menu.leverage, "/leverage", IconLeverage],
  [content.menu.earn, "/earn", IconEarn],
  [content.menu.stake, "/stake", IconStake],
];

export function TopBar() {
  return (
    <div
      className={css({
        position: "relative",
        zIndex: 1,
        height: 72,
      })}
    >
      <div
        className={css({
          position: "relative",
          zIndex: 1,
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          maxWidth: 1280,
          height: "100%",
          margin: "0 auto",
          padding: "16px 24px",
          fontSize: 16,
          fontWeight: 500,
          background: "background",
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
          <div
            className={css({
              flexShrink: 0,
            })}
          >
            <Logo />
          </div>
          <div
            className={css({
              flexShrink: 0,
              whiteSpace: "nowrap",
            })}
          >
            {content.appName}
          </div>
        </Link>
        <Menu menuItems={menuItems} />
        <AccountButton />
      </div>
    </div>
  );
}
