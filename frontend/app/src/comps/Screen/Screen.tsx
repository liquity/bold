import type { ReactNode } from "react";

import { css, cx } from "@/styled-system/css";
import { IconArrowBack } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import Link from "next/link";
import { isValidElement } from "react";

export function Screen({
  back,
  children,
  className,
  gap = 48,
  heading = null,
  paddingTop = 0,
  ready = true,
  width = 534,
}: {
  back?: {
    href: string;
    label: ReactNode;
  } | null;
  children: ReactNode;
  className?: string;
  gap?: number;
  heading?: ReactNode | {
    title: ReactNode;
    subtitle?: ReactNode;
  };
  ready?: boolean;
  width?: number;
  paddingTop?: number;
}) {
  const backTransition = useTransition(ready && back, {
    keys: (back) => JSON.stringify(back),
    initial: { progress: 0, transform: "translate3d(0, 0, 0)" },
    from: { progress: 0, transform: "translate3d(0, 16px, 0)" },
    enter: { progress: 1, transform: "translate3d(0, 0, 0)" },
    leave: { progress: 0, transform: "translate3d(0, 0, 0)" },
    config: {
      mass: 1,
      tension: 1800,
      friction: 100,
    },
  });

  const screenTransitions = useTransition(true, {
    initial: { progress: 0, transform: "scale3d(0.95, 0.95, 1) translate3d(0, 8px, 0)" },
    from: { progress: 0, transform: "scale3d(0.95, 0.95, 1) translate3d(0, 8px, 0)" },
    enter: { progress: 1, transform: "scale3d(1, 1, 1) translate3d(0, 0, 0)" },
    leave: { display: "none", immediate: true },
    config: {
      mass: 2,
      tension: 1100,
      friction: 100,
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
            fontSize: 28,
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
    : heading;

  return (
    screenTransitions((style, ready) =>
      ready && (
        <a.div
          className={cx(
            css({
              flexGrow: 1,
              display: "flex",
              gap: 48,
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              padding: 24,
              transformOrigin: "50% 0",
            }),
            className,
          )}
          style={{
            ...style,
            opacity: style.progress.to([0, 0.5, 1], [0, 1, 1]),
            paddingTop,
          }}
        >
          {backTransition((style, back) => (
            back && (
              <a.div
                className={css({
                  position: {
                    base: "static",
                    large: "absolute",
                  },
                  left: 100,
                })}
                style={{
                  width,
                  transform: style.transform,
                  opacity: style.progress.to([0, 0.5, 1], [0, 1, 1]),
                }}
              >
                <BackButton
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
              style={{
                paddingBottom: style.progress.to([0, 1], [24, 0]),
              }}
            >
              {headingElt}
            </a.div>
          )}
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              position: "relative",
            })}
            style={{
              gap,
              width,
            }}
          >
            {children}
          </div>
        </a.div>
      )
    )
  );
}

export function BackButton({
  href,
  label,
}: {
  href: string;
  label: ReactNode;
}) {
  return (
    <Link href={href} passHref legacyBehavior>
      <a
        className={css({
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 8,
          color: "secondaryContent",
          background: "secondary",
          height: 40,
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
      >
        <IconArrowBack size={20} />
        {label}
      </a>
    </Link>
  );
}
