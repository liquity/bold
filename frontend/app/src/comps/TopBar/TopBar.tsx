"use client";

import type { MenuSection } from "@/src/types";
import type { ComponentProps } from "react";

import { Logo } from "@/src/comps/Logo/Logo";
import content from "@/src/content";
import { css } from "@/styled-system/css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LAYOUT_WIDTH } from "../AppLayout/AppLayout";
import { AccountButton } from "./AccountButton";
import { IconBorrow, IconEarn, IconLeverage, IconStake } from "./icons";
import { Menu } from "./Menu";
import { MenuDrawer } from "./MenuDrawer";

const menuItems: ComponentProps<typeof Menu>["menuItems"] = [
  [content.menu.borrow, "/borrow", IconBorrow],
  [content.menu.leverage, "/leverage", IconLeverage],
  [content.menu.earn, "/earn", IconEarn],
  [content.menu.stake, "/stake", IconStake],
];

const menuSections: MenuSection[] = [
  {
    actions: [
      {
        href: "/borrow/eth",
        name: "ETH pool",
        secondary: "91% Max LTV",
        token: "ETH",
      },
      {
        href: "/borrow/reth",
        name: "rETH pool",
        secondary: "91% Max LTV",
        token: "RETH",
      },
      {
        href: "/borrow/wsteth",
        name: "wstETH pool",
        secondary: "91% Max LTV",
        token: "WSTETH",
      },
    ],
    href: "/borrow",
    label: content.home.actions.borrow.description,
  },
  {
    actions: [
      {
        href: "/leverage/eth",
        name: "ETH pool",
        secondary: "91% Max LTV",
        token: "ETH",
      },
      {
        href: "/leverage/reth",
        name: "rETH pool",
        secondary: "91% Max LTV",
        token: "RETH",
      },
      {
        href: "/leverage/wsteth",
        name: "wstETH pool",
        secondary: "91% Max LTV",
        token: "WSTETH",
      },
    ],
    href: "/leverage",
    label: content.home.actions.leverage.description,
  },
  {
    actions: [
      {
        href: "/earn/eth",
        name: "ETH pool",
        secondary: "4.3% APY",
        token: "ETH",
      },
      {
        href: "/earn/reth",
        name: "rETH pool",
        secondary: "6.3% APY",
        token: "RETH",
      },
      {
        href: "/earn/wsteth",
        name: "wstETH pool",
        secondary: "5.1% APY",
        token: "WSTETH",
      },
    ],
    href: "/earn",
    label: content.home.actions.earn.description,
  },
  {
    actions: [],
    href: "/stake",
    label: content.home.actions.stake.description,
  },
];

export function TopBar() {
  const pathname = usePathname();

  const [hoveredItem, setHoveredItem] = useState(-1);

  // close the drawer when the route changes
  useEffect(() => {
    setHoveredItem(-1);
  }, [pathname]);

  return (
    <div
      onMouseLeave={() => setHoveredItem(-1)}
      className={css({
        position: "relative",
        zIndex: 2,
        width: "100%",
        height: 72,
      })}
    >
      <div
        className={css({
          position: "relative",
          zIndex: 2,
          display: "flex",
          justifyContent: "space-between",
          width: LAYOUT_WIDTH,
          height: "100%",
          margin: "0 auto",
          padding: "16px 0",
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
          <Logo />
          {content.appName}
        </Link>
        <Menu
          hovered={hoveredItem}
          menuItems={menuItems}
          onHover={(index) => setHoveredItem(index)}
        />
        <AccountButton />
      </div>

      <div
        className={css({
          position: "absolute",
          inset: "72px 0 auto",
          zIndex: 1,
          height: 0,
        })}
      >
        <MenuDrawer
          opened={hoveredItem}
          sections={menuSections}
        />
      </div>
    </div>
  );
}
