"use client";

import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { BottomBar } from "./BottomBar";
import { TopBar } from "./TopBar";
import Link from "next/link";
import { TokenCard } from "@/src/screens/HomeScreen/HomeScreen";
import { AccountButton } from "@/src/comps/AppLayout/AccountButton";

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
          display: { base: "none", medium: "grid" },
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

      <MobileScreen />

    </div>
  );
}


function MobileScreen() {
  return (
    <div className={css({ display: { base: "block", medium: "none" } })}>
      <div
        className={css({
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          width: "90%",
          height: "48px",
          margin: "16px auto",
          padding: "0 16px",
          fontSize: 16,
          fontWeight: 500,
          background: "fieldSurface",
          border: "1px solid token(colors.fieldBorder)",
          borderRadius: 16,
        })}
      >
        <Link
          href="/"
          className={css({
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 4,
            height: "100%",
            paddingRight: 8,
            _active: {
              translate: "0 1px",
            },
            fontSize: 24,
          })}
        >
          <div
            className={css({
              flexShrink: 0,
            })}
          >
            <svg width="24" height="24" viewBox="0 0 460 406" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M136.649 0.580078H129.371C119.084 0.580078 109.575 6.07539 104.414 15.0032L4.01394 188.677C-1.17798 197.659 -1.17799 208.742 4.01394 217.723L101.092 385.65L97.2902 308.077C97.2648 307.559 97.3985 307.048 97.6383 306.589C99.9269 302.205 99.83 296.927 97.3368 292.615L45.6468 203.2L125.126 65.716L167.9 137.752L133.883 196.864C131.307 201.341 131.307 206.859 133.883 211.336L168.431 271.372L110.233 369.383L110.615 369.612L101.092 385.65L104.414 391.397C109.575 400.325 119.084 405.82 129.371 405.82H330.229C340.516 405.82 350.025 400.325 355.186 391.397L451.431 224.909L385.269 267.902C384.84 268.18 384.34 268.322 383.83 268.349C378.991 268.612 374.583 271.303 372.134 275.54L321.92 362.402H164.752L206.653 291.837H272.857C278.01 291.837 282.773 289.079 285.349 284.601L319.699 224.909H451.431L455.586 217.723C460.778 208.742 460.778 197.659 455.586 188.678L355.186 15.0032C350.025 6.07541 340.516 0.580078 330.229 0.580078H136.649L208.229 36.5485C208.682 36.7761 209.055 37.1331 209.335 37.5554C212 41.5665 216.498 43.9986 221.337 43.9986H321.92L401.403 181.491H318.663L285.349 123.599C282.772 119.121 278.01 116.363 272.857 116.363H205.573L147.411 18.4132L147.284 18.4895L136.649 0.580078Z" fill="url(#paint0_linear_3094_169)" />
              <defs>
                <linearGradient id="paint0_linear_3094_169" x1="95.7539" y1="342.9" x2="783.132" y2="216.171" gradientUnits="userSpaceOnUse">
                  <stop stop-color="white" />
                  <stop offset="0.276697" stop-color="#F6AE3F" />
                </linearGradient>
              </defs>
            </svg>
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
            BitVault
          </div>
        </Link>


        <AccountButton size="mini" />

      </div>
      <div
        className={css({
          width: "90%",
          margin: "0 auto",
        })}
      >
        <h1
          className={css({
            fontSize: 24,
            color: "content",
            userSelect: "none",
          })}
          style={{ paddingBottom: 8 }}
        >
          My Tokens
        </h1>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 24,
          })}
        >
          <TokenCard
            token="bvUSD"
            link={{ label: "Buy", href: "#" }}
            subValues={[
              { label: "Value", value: "$10" },
              { label: "Locked", value: "$10" },
            ]}
          />
          <TokenCard
            token="sbvUSD"
            link={{ label: "Earn", href: "#" }}
            subValues={[
              { label: "Value", value: "$10" },
              { label: "Apy", value: "10%" },
            ]}
          />
          <TokenCard
            token="VCRAFT"
            link={{ label: "Buy", href: "#" }}
            subValues={[
              { label: "Value", value: "$10" },
            ]}
          />
        </div>
      </div>
    </div>
  )
}