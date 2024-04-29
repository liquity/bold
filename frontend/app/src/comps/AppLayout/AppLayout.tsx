import type { ReactNode } from "react";

import { Footer } from "@/src/comps/Footer/Footer";
import { TopBar } from "@/src/comps/TopBar/TopBar";
import { css } from "@/styled-system/css";

export function AppLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        width: 1160,
        minHeight: "100vh",
        margin: "0 auto",
      })}
    >
      <div
        className={css({
          flexGrow: 0,
          flexShrink: 0,
          paddingBottom: 40,
        })}
      >
        <TopBar />
      </div>
      <div
        className={css({
          flexGrow: 1,
          flexShrink: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        })}
      >
        {children}
      </div>
      <div
        className={css({
          flexGrow: 0,
          flexShrink: 0,
          paddingTop: 40,
        })}
      >
        <Footer />
      </div>
    </div>
  );
}
