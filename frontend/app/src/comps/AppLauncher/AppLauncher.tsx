"use client";

import { css } from "@/styled-system/css";
import { a, useSpring } from "@react-spring/web";
import Link from "next/link";
import { useState } from "react";
import { AppIcon, springConfig } from "./AppIcon";

type AppData = readonly [
  label: string,
  description: string,
  href: string,
  bg: string,
  fg: string,
  iconType: "borrow" | "leverage" | "earn",
];

const apps: AppData[] = [
  [
    "Borrow",
    "Borrow BOLD stablecoin against ETH and staked ETH at a rate that you set",
    "/borrow",
    "#121B44",
    "#FFFFFF",
    "borrow",
  ],
  [
    "Leverage",
    "Multiply your ETH and staked ETH at a funding rate that you set",
    "/leverage",
    "#63D77D",
    "#121B44",
    "leverage",
  ],
  [
    "Earn",
    "Deposit BOLD and earn real yield",
    "/earn",
    "#405AE5",
    "#FFFFFF",
    "earn",
  ],
];

export function AppLauncher() {
  const [highlighted, setHighlighted] = useState<AppData | null>(null);

  const { gridTemplateColumns } = useSpring({
    gridTemplateColumns: apps.map((app) => (
      highlighted === app ? "1.1fr" : "1fr"
    )).join(" "),
    config: springConfig,
  });

  return (
    <a.div
      style={{ gridTemplateColumns }}
      className={css({
        display: "grid",
        width: "100%",
        height: 464,
      })}
    >
      {apps.map((app) => (
        <AppCard
          key={app[2]}
          app={app}
          highlighted={highlighted === app}
          onHighlightChange={(highlighted) => {
            setHighlighted(highlighted ? app : null);
          }}
        />
      ))}
    </a.div>
  );
}

function AppCard({
  app,
  highlighted,
  onHighlightChange,
}: {
  app: AppData;
  highlighted: boolean;
  onHighlightChange: (highlighted: boolean) => void;
}) {
  const [label, description, href, bg, fg, iconType] = app;

  const { titleT, arrowT } = useSpring({
    titleT: highlighted ? "scale(1.2)" : "scale(1)",
    arrowT: highlighted ? "scale(1.4)" : "scale(1)",
    config: springConfig,
  });

  return (
    <Link
      href={href}
      onMouseEnter={() => onHighlightChange(true)}
      onMouseLeave={() => onHighlightChange(false)}
      onFocus={() => onHighlightChange(true)}
      onBlur={() => onHighlightChange(false)}
      className={css({
        outline: "none",
        _active: {
          translate: "0 2px",
        },
        _focusVisible: {
          zIndex: 2,
          outlineOffset: 0,
          outlineColor: "#FFFFFF",
        },
      })}
    >
      <a.section
        style={{
          color: fg,
          backgroundColor: bg,
        }}
        className={css({
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: 32,
        })}
      >
        <div>
          <AppIcon
            iconType={iconType}
            state={highlighted ? "active" : "idle"}
          />
        </div>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 24,
          })}
        >
          <h1
            className={css({
              display: "flex",
              justifyContent: "space-between",
              fontSize: 24,
              fontWeight: 600,
            })}
          >
            <a.div
              style={{ transform: titleT }}
              className={css({
                display: "flex",
                alignItems: "center",
                height: "100%",
                transformOrigin: "0% 50%",
              })}
            >
              {label}
            </a.div>
            <a.div
              style={{ transform: arrowT }}
              className={css({
                display: "flex",
                alignItems: "center",
                height: "100%",
                transformOrigin: "100% 50%",
              })}
            >
              <Arrow color={fg} />
            </a.div>
          </h1>
          <p
            className={css({
              width: 240,
              height: 80,
              fontSize: 16,
            })}
          >
            {description}
          </p>
        </div>
      </a.section>
    </Link>
  );
}

function Arrow({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M15.9997 5.33301L14.1197 7.21301L21.5597 14.6663H5.33301V17.333H21.5597L14.1197 24.7863L15.9997 26.6663L26.6663 15.9997L15.9997 5.33301Z"
        fill={color}
      />
    </svg>
  );
}
