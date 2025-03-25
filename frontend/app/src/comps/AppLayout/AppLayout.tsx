"use client";

import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
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
        height: "100%",
        background: "linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('/background.png') no-repeat center center/cover",
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
      </div>
      <div
        className={css({
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          gap: 48,
          maxWidth: `calc(${LAYOUT_WIDTH}px + 48px)`,
          margin: "0 auto",
          padding: "24px 0",
          width: "100%",
        })}
      >
        <TopBar />
        <div
          className={css({
            width: "100%",
            minHeight: 0,
            padding: "0 24px",
          })}
        >
          {children}
        </div>
        <BottomBar />
      </div>
    </div>
  );
}
