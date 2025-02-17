"use client";

import type { ReactNode } from "react";

import { Banner } from "@/Banner";
import { useAbout } from "@/src/comps/About/About";
import { ProtocolStats } from "@/src/comps/ProtocolStats/ProtocolStats";
import { TopBar } from "@/src/comps/TopBar/TopBar";
import { css } from "@/styled-system/css";
import { AnchorTextButton, TextButton } from "@liquity2/uikit";
import Link from "next/link";

export const LAYOUT_WIDTH = 1092;
export const MIN_WIDTH = 960;

export function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          width: "100%",
          gap: 1,
        })}
      >
        <Banner />
        <EarnRiskBanner />
      </div>
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
            <BuildInfo />
            <ProtocolStats />
          </div>
        </div>
      </div>
    </>
  );
}

function BuildInfo() {
  const about = useAbout();
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        height: 40,
      })}
    >
      <TextButton
        label={about.fullVersion}
        title={`About Liquity V2 App ${about.fullVersion}`}
        onClick={() => {
          about.openModal();
        }}
        className={css({
          color: "dimmed",
        })}
        style={{
          fontSize: 12,
        }}
      />
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
        height: 40,
        padding: "0 16px",
        textAlign: "center",
        color: "#fff",
        background: "strongSurface",
      })}
    >
      <div
        className={css({
          width: "100%",
          maxWidth: LAYOUT_WIDTH,
          whiteSpace: "nowrap",
        })}
      >
        There is a potential issue affecting Stability Pools (“Earn”).{" "}
        <Link
          href="https://www.liquity.org/blog/stability-pool-issue"
          passHref
          legacyBehavior
        >
          <AnchorTextButton
            external
            label="Please read this announcement"
            className={css({
              color: "inherit",
              textDecoration: "underline",
            })}
          />
        </Link>.
      </div>
    </div>
  );
}
