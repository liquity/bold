"use client";

import type { ReactNode } from "react";

import { Banner } from "@/Banner";
import { css } from "@/styled-system/css";
import { BottomBar } from "./BottomBar";
import { TopBar } from "./TopBar";

export const LAYOUT_WIDTH = 1192;

export function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className={css({
        position: "relative",
        zIndex: 1,
        display: "grid",
        gridTemplateRows: "auto 1fr",
        minHeight: "100vh",
        minWidth: "fit-content",
        height: "100%",
        background: "#090909",
      })}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          width: "100%",
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
        </div>
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
            medium: {
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
