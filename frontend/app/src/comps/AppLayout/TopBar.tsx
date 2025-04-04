"use client";

import type { MenuItem } from "./Menu";

import { Logo } from "@/src/comps/Logo/Logo";
import { Tag } from "@/src/comps/Tag/Tag";
import content from "@/src/content";
import { DEPLOYMENT_FLAVOR } from "@/src/env";
import { css } from "@/styled-system/css";
import { IconBorrow, IconDashboard, IconEarn, IconLeverage, IconStake } from "@liquity2/uikit";
import Link from "next/link";
import { AccountButton } from "./AccountButton";
import { Menu } from "./Menu";
import { MenuDrawerButton } from "./MenuDrawer";

const menuItems: MenuItem[] = [
  [content.menu.dashboard, "/", IconDashboard],
  [content.menu.borrow, "/borrow", IconBorrow],
  [content.menu.multiply, "/multiply", IconLeverage],
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
          padding: {
            base: "16px 12px",
            medium: "16px 24px",
          },
          fontSize: 16,
          fontWeight: 500,
          background: "background",
        })}
      >
        <Link
          href="/"
          className={css({
            position: "relative",
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
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              medium: {
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              },
              whiteSpace: "nowrap",
            })}
          >
            {content.appName}
            {DEPLOYMENT_FLAVOR && (
              <div
                className={css({
                  display: "flex",
                  transform: "translateY(-1px)",
                })}
              >
                <Tag
                  size="mini"
                  css={{
                    color: "accentContent",
                    background: "brandCoral",
                    border: 0,
                    textTransform: "uppercase",
                  }}
                >
                  {DEPLOYMENT_FLAVOR}
                </Tag>
              </div>
            )}
          </div>
        </Link>
        <Menu menuItems={menuItems} />
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 8,
            width: "min-content",
            // width: 140,
          })}
        >
          <div>
            <AccountButton />
          </div>
          <MenuDrawerButton menuItems={menuItems} />
        </div>
      </div>
    </div>
  );
}
