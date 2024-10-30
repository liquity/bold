import type { ReactNode } from "react";

import { UpdatePrices } from "@/src/comps/Debug/UpdatePrices";
import { ProtocolStats } from "@/src/comps/ProtocolStats/ProtocolStats";
import { TopBar } from "@/src/comps/TopBar/TopBar";
import { css } from "@/styled-system/css";

export const LAYOUT_WIDTH = 1092;
export const MIN_WIDTH = 960;

export function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        minHeight: "100vh",
        margin: "0 auto",
        background: "background",
      })}
      style={{
        minWidth: `${MIN_WIDTH}px`,
        maxWidth: `${LAYOUT_WIDTH + 24 * 2}px`,
      }}
    >
      <div
        className={css({
          width: "100%",
          flexGrow: 0,
          flexShrink: 0,
          paddingBottom: 48,
        })}
      >
        <TopBar />
      </div>
      <div
        className={css({
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
        })}
        style={{
          width: `${LAYOUT_WIDTH + 24 * 2}px`,
        }}
      >
        <div
          className={css({
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            width: "100%",
            padding: "0 24px",
          })}
        >
          {children}
        </div>
        <div
          className={css({
            width: "100%",
            paddingTop: 64,
          })}
        >
          <ProtocolStats />
        </div>
      </div>
      <UpdatePrices />
    </div>
  );
}
