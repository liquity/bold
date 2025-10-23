"use client";

import type { ReactNode } from "react";

import { Banner } from "@/Banner";
import { ProtocolStats } from "@/src/comps/ProtocolStats/ProtocolStats";
import { TopBar } from "@/src/comps/TopBar/TopBar";
import { css } from "@/styled-system/css";
import { useSubgraphStatus } from "@/src/services/SubgraphStatus";
import { ErrorBanner } from "@/src/comps/ErrorBanner/ErrorBanner";
import { APP_VERSION, APP_COMMIT_HASH } from "@/src/env";

export const LAYOUT_WIDTH = 1092;
export const MIN_WIDTH = 960;

export function AppLayout({ children }: { children: ReactNode }) {
  const { hasError } = useSubgraphStatus();
  return (
    <>
      <Banner />
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
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
          {hasError && (
            <ErrorBanner
              title="We are experiencing connection issues with the subgraph at the moment. Your positions are not affected."
              children={
                <div>
                  <p>Some actions in the app may be degraded or unavailable in the meantime. Thank you for your patience as we resolve the issue.</p>
                  <p>If you have any questions, please contact us on <a className={css({ color: "primary", textDecoration: "underline" })} target="_blank" href="https://discord.gg/5h3avBYxcn">Discord</a> or <a className={css({ color: "primary", textDecoration: "underline" })} target="_blank" href="https://x.com/neriteorg">X</a>.</p>
                </div>
              }
            />
          )}
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
              padding: "48px 24px 0",
            })}
          >
            <div
              className={css({
                width: "100%",
                display: "flex",
                justifyContent: "end",
                color: "contentAlt",
                fontSize: 14,
                paddingBottom: 8,
              })}
            >
              <span>v{APP_VERSION}-{APP_COMMIT_HASH.slice(0, 8)}</span>
            </div>
            <ProtocolStats />
          </div>
        </div>
      </div>
    </>
  );
}
