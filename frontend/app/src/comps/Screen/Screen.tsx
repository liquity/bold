import type { ReactNode } from "react";

import { css, cx } from "@/styled-system/css";
import { IconArrowBack } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import Link from "next/link";

export function Screen({
  back,
  children,
  className,
  gap = 48,
  ready = true,
  subtitle,
  title,
  width = 534,
}: {
  back?: {
    href: string;
    label: ReactNode;
  } | null;
  children: ReactNode;
  className?: string;
  gap?: number;
  ready?: boolean;
  subtitle?: ReactNode;
  title?: ReactNode;
  width?: number;
}) {
  const backTransition = useTransition(ready && back, {
    keys: (back) => JSON.stringify(back),
    initial: { opacity: 0, transform: "translate3d(0, 0, 0)" },
    from: { opacity: 0, transform: "translate3d(0, 8px, 0)" },
    enter: { opacity: 1, transform: "translate3d(0, 0, 0)" },
    leave: { opacity: 0, transform: "translate3d(0, 0, 0)" },
    config: {
      mass: 1,
      tension: 1800,
      friction: 100,
    },
  });

  const screenTransitions = useTransition(true, {
    initial: { opacity: 0, transform: "scale3d(0.97, 0.97, 1) translate3d(0, 4px, 0)" },
    from: { opacity: 0, transform: "scale3d(0.97, 0.97, 1) translate3d(0, 4px, 0)" },
    enter: { opacity: 1, transform: "scale3d(1, 1, 1) translate3d(0, 0, 0)" },
    leave: { display: "none", immediate: true },
    config: {
      mass: 2,
      tension: 1100,
      friction: 80,
    },
  });

  return (
    screenTransitions((style, ready) =>
      ready && (
        <a.div
          className={cx(
            css({
              flexGrow: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              padding: "24px 24px 64px",
              gap: 56,
              transformOrigin: "50% 0",
            }),
            className,
          )}
          style={{
            ...style,
            opacity: style.opacity.to([0, 0.5, 1], [0, 1, 1]),
          }}
        >
          <header
            className={css({
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
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
              {title}
            </h1>
            {subtitle && (
              <p
                className={css({
                  maxWidth: 540,
                  textAlign: "center",
                  color: "contentAlt",
                })}
              >
                {subtitle}
              </p>
            )}
          </header>
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
            {backTransition((style, back) => (
              back && (
                <a.div
                  className={css({
                    position: {
                      base: "static",
                      large: "absolute",
                    },
                    right: `${654}px`,
                  })}
                  style={{
                    opacity: style.opacity.to([0, 0.5, 1], [0, 1, 1]),
                    transform: style.transform,
                  }}
                >
                  <BackButton
                    href={back.href}
                    label={back.label}
                  />
                </a.div>
              )
            ))}
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
