"use client";

import type { ReactNode } from "react";

import { Banner } from "@/Banner";
import { css } from "@/styled-system/css";
import { AnchorTextButton } from "@liquity2/uikit";
import Link from "next/link";
import { BottomBar } from "./BottomBar";
import { TopBar } from "./TopBar";

export const LAYOUT_WIDTH = 1092;

export function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className={css({
        display: "grid",
        gridTemplateRows: "auto 1fr",
        minHeight: "100vh",
        minWidth: "fit-content",
        height: "100%",
        background: "background",
      })}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 1,
          width: "100%",
        })}
      >
        <Banner />
        <EarnRiskBanner />
      </div>
      <div
        className={css({
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          gap: {
            base: 24,
            large: 48,
          },
          maxWidth: `calc(${LAYOUT_WIDTH}px + 48px)`,
          margin: "0 auto",
          width: "100%",
        })}
      >
        <TopBar />
        <div
          className={css({
            width: "100%",
            minHeight: 0,
            padding: {
              base: "0 12px",
              medium: "0 24px",
            },
            overflow: "auto",
            medium: {
              overflow: "visible",
              maxWidth: "100%",
            },
          })}
        >
          {children}
        </div>
        <BottomBar />
      </div>
    </div>
  );
}

function EarnRiskBanner() {
  return (
    <div
      className={css({
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        maxWidth: "100%",
        width: "100%",
        padding: "8px 16px",
        lineHeight: "18px",
        textAlign: "center",
        fontSize: 14,
        color: "#fff",
        background: "strongSurface",
        medium: {
          padding: "10px 16px",
          fontSize: 16,
          lineHeight: "20px",
        },
      })}
    >
      <div
        className={css({
          width: "100%",
          maxWidth: LAYOUT_WIDTH,
        })}
      >
        There is an issue affecting the Stability Pools (“Earn”).{" "}
        <Link
          href="https://www.liquity.org/blog/stability-pool-issue"
          passHref
          legacyBehavior
        >
          <AnchorTextButton
            external
            label="Please read this announcement"
            className={css({
              display: "inline",
              color: "inherit",
              textDecoration: "underline",
            })}
          />
        </Link>.
      </div>
    </div>
  );
}
