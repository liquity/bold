import type { ReactNode } from "react";

import { useBreakpoint } from "@/src/breakpoints";
import { css, cx } from "@/styled-system/css";
import { IconArrowBack } from "@liquity2/uikit";
import { a, useSpring, useTransition } from "@react-spring/web";
import Link from "next/link";
import { isValidElement, useState } from "react";

export function Screen({
  back,
  children,
  className,
  heading = null,
  paddingTop = 0,
  ready = true,
  width,
}: {
  back?: {
    href: string;
    label: ReactNode;
  } | null;
  children: ReactNode;
  className?: string;
  heading?: ReactNode | {
    title: ReactNode;
    subtitle?: ReactNode;
  };
  ready?: boolean;
  width?: number | `${number}%`;
  paddingTop?: number;
}) {
  const [compactMode, setCompactMode] = useState(false);
  useBreakpoint(({ medium }) => {
    setCompactMode(!medium);
  });

  width ??= compactMode ? "100%" : 534;

  const backTransition = useTransition(ready && back, {
    keys: (back) => JSON.stringify(back),
    initial: { opacity: 0, transform: "translateY(0px)" },
    from: { opacity: 0, transform: "translateY(16px)" },
    enter: { opacity: 1, transform: "translateY(0px)" },
    leave: { opacity: 0, transform: "translateY(0px)", immediate: true },
    config: {
      mass: 1,
      tension: 1800,
      friction: 100,
    },
  });

  const headingSpring = useSpring({
    from: {
      opacity: 0,
      transform: `
        scale3d(0.95, 0.95, 1)
        translate(0, 12px)
      `,
    },
    to: {
      opacity: 1,
      transform: `
        scale3d(1, 1, 1)
        translate(0, 0px)
      `,
    },
    config: {
      mass: 1,
      tension: 2200,
      friction: 120,
    },
  });

  const screenSpring = useSpring({
    from: {
      opacity: 0,
      transform: `
        scale3d(0.97, 0.97, 1)
        translate3d(0, 8px, 0)
      `,
    },
    to: {
      opacity: 1,
      transform: `
        scale3d(1, 1, 1)
        translate3d(0, 0px, 0)
      `,
    },
    delay: 100,
    config: {
      mass: 1,
      tension: 2800,
      friction: 120,
    },
  });

  const headingElt = typeof heading === "object"
      && heading !== null
      && "title" in heading
      && !isValidElement(heading)
    ? (
      <header
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          paddingBottom: 8,
        })}
      >
        <h1
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: {
              base: 20,
              medium: 28,
            },
          })}
        >
          {heading.title}
        </h1>
        {heading.subtitle && (
          <div
            className={css({
              maxWidth: 540,
              textAlign: "center",
              color: "contentAlt",
            })}
          >
            {heading.subtitle}
          </div>
        )}
      </header>
    )
    : (
      heading && (
        <div style={{ width }}>
          {heading}
        </div>
      )
    );

  return (
    <div
      className={cx(
        css({
          position: "relative",
          flexGrow: 1,
          display: "grid",
          justifyItems: "center",
          minWidth: 0,
          gap: {
            base: 20,
            large: 48,
          },
          gridTemplateColumns: "1fr",
          gridTemplateRows: "auto 1fr",
          width: "100%",
          padding: {
            base: 0,
            large: 24,
          },
          transformOrigin: "50% 0",
        }),
        className,
      )}
      style={{
        paddingTop,
      }}
    >
      {backTransition((style, back) => (
        back && (
          <a.div
            className={css({
              width: "100%",
              maxWidth: 540,
              marginBottom: 0,
              left: 0,
              zIndex: 1,
              large: {
                position: "absolute",
                width: "auto",
                maxWidth: "100%",
                marginBottom: 0,
              },
            })}
            style={{
              transform: style.transform,
              opacity: style.opacity.to([0, 0.5, 1], [0, 1, 1]),
            }}
          >
            <BackButton
              compact={compactMode}
              href={back.href}
              label={back.label}
            />
          </a.div>
        )
      ))}
      {headingElt && (
        <a.div
          className={css({
            display: "flex",
            flexDirection: "column",
            width: "100%",
            alignItems: "center",
          })}
          style={headingSpring}
        >
          {headingElt}
        </a.div>
      )}
      <a.div
        className={css({
          position: "relative",
          display: "grid",
          gap: {
            base: 32,
            medium: 48,
          },
          transformOrigin: "50% 0",
          willChange: "transform, opacity",
        })}
        style={{
          width,
          ...screenSpring,
        }}
      >
        {children}
      </a.div>
    </div>
  );
}

function BackButton({
  compact,
  href,
  label,
}: {
  compact: boolean;
  href: string;
  label: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={css({
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 8,
        color: "secondaryContent",
        background: "secondary",
        width: "fit-content",
        whiteSpace: "nowrap",
        borderRadius: 20,
        _active: {
          translate: "0 1px",
        },
        _focusVisible: {
          outline: "2px solid token(colors.focused)",
        },
      })}
      style={{
        height: compact ? 34 : 40,
      }}
    >
      <IconArrowBack size={20} />
      {label}
    </Link>
  );
}
