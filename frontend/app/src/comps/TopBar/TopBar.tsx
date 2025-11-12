"use client";

import type { ComponentProps } from "react";

import { Logo } from "@/src/comps/Logo/Logo";
import { Tag } from "@/src/comps/Tag/Tag";
import content from "@/src/content";
import {
  // BUY_PAGE_URL, 
  DEPLOYMENT_FLAVOR,
  DISABLE_TRANSACTIONS
} from "@/src/env";
import { css } from "@/styled-system/css";
import {
  IconBorrow,
  IconDashboard,
  IconEarn,
  IconStake as IconStream,
  IconStake as IconEcosystem,
  // IconLeverage,
  // IconStake,
} from "@liquity2/uikit";
import Link from "next/link";
import { AccountButton } from "./AccountButton";
import { Menu } from "./Menu";
import { ShellpointsButton } from "./ShellpointsButton";

// const buyPageUrl = BUY_PAGE_URL ?? "/buy";
// const buyPageTarget = BUY_PAGE_URL ? "_blank" : "_self";

const menuItems: ComponentProps<typeof Menu>["menuItems"] = [
  [content.menu.dashboard, "/", IconDashboard, "dashboard", "_self"],
  [content.menu.borrow, "/borrow", IconBorrow, "borrow", "_self"],
  // [content.menu.multiply, "/multiply", IconLeverage, "multiply"],
  [content.menu.earn, "/earn", IconEarn, "earn", "_self"],
  [content.menu.ecosystem, "/ecosystem", IconEcosystem, "ecosystem", "_self"],
  [content.menu.stream, "https://app.superfluid.org/", IconStream, "stream", "_blank"],
  // [content.menu.stake, "/stake", IconStake, "stake"],
  // [content.menu.buy, buyPageUrl, IconStake, "buy", buyPageTarget],
];

export function TopBar() {
  return (
    <>
    {DISABLE_TRANSACTIONS && (<Banner />)}
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
          href='/'
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
              alignItems: "center",
              gap: 8,
              whiteSpace: "nowrap",
            })}
          >
            {content.appName}
            {DEPLOYMENT_FLAVOR && (
              <div
                className={css({
                  display: "flex",
                })}
              >
                <Tag
                  size='mini'
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
        <div className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 16,
        })}>
          <div className={css({
            position: "absolute",
            top: 72,
            right: 0,
          })}>
            <ShellpointsButton />
          </div>
          <AccountButton />
        </div>
      </div>
    </div>
    </>
  );
}


export function Banner() {
  return (
    <div
      className={css({
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        maxWidth: "100%",
        width: "100%",
        height: 40,
        textAlign: "center",
        color: "#fff",
        background: "red",
        padding: 16,
      })}
    >
      <div
        className={css({
          width: "100%",
          maxWidth: 1092,
          paddingY: 16,
        })}
      >
        Due to concerns of a widespread supply-chain attack, we are taking the extra precation of disabling transactions at the moment. They will be re-enabled tomorrow.
        {/* Banner content goes here. Here is a{" "} */}
        {/* <Link
          href="https://example.com"
          passHref
          legacyBehavior
        >
          <AnchorTextButton
            external
            label="link example"
            className={css({ color: "inherit" })}
          />
        </Link>. */}
      </div>
    </div>
  );
}
