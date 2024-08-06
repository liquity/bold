import type { ReactNode } from "react";

import { css, cx } from "@/styled-system/css";
import { IconArrowRight } from "@liquity2/uikit";
import { a, useSpring } from "@react-spring/web";
import Link from "next/link";
import { useState } from "react";
import { ProductCardGroup } from "./ProductCardGroup";

export function ProductCard({
  children,
  hint,
  icon,
  path,
  tag,
  title,
}: {
  children?: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  path: string;
  tag?: ReactNode;
  title: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);

  const hoverSpring = useSpring({
    progress: hovered ? 1 : 0,
    transform: active
      ? "scale(1)"
      : hovered
      ? "scale(1.01)"
      : "scale(1)",
    boxShadow: hovered && !active
      ? "0 2px 4px rgba(0, 0, 0, 0.1)"
      : "0 2px 4px rgba(0, 0, 0, 0)",
    immediate: active,
    config: {
      mass: 1,
      tension: 1800,
      friction: 80,
    },
  });

  return (
    <Link
      href={path}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      onBlur={() => setActive(false)}
      className={cx(
        "group",
        css({
          outline: "none",
          height: 150,
        }),
      )}
    >
      <a.section
        className={css({
          display: "flex",
          flexDirection: "column",
          padding: 16,
          background: "background",
          border: "1px solid token(colors.border)",
          borderRadius: 8,
          _groupHover: {
            position: "relative",
            zIndex: 2,
            background: "hint",
          },
          _groupFocusVisible: {
            outlineOffset: 2,
            outline: "2px solid token(colors.focused)",
          },
        })}
        style={hoverSpring}
      >
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            paddingBottom: 16,
            color: "interactive",
          })}
        >
          <h1
            className={css({
              display: "flex",
              gap: 8,
              fontSize: 20,
              fontWeight: 500,
              color: "interactive",
            })}
          >
            {icon}
            <div
              className={css({
                display: "flex",
                marginTop: -2,
              })}
            >
              {title}
            </div>
          </h1>
          {tag && (
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                height: 18,
                padding: "0 4px 1px",
                fontSize: 12,
                textTransform: "uppercase",
                color: "accent",
                background: "background",
                border: "1px solid token(colors.accent)",
                borderRadius: 4,
              })}
            >
              {tag}
            </div>
          )}
        </div>

        <div
          className={css({
            display: "flex",
            gap: 16,
            marginTop: -1,
            padding: "20px 0 8px",
            color: "contentAlt",
            borderTop: "1px solid token(colors.border)",
          })}
        >
          {children}
        </div>
        {hint && (
          <a.div
            className={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "accent",
            })}
            style={{
              height: hoverSpring.progress.to((v) => v * 40),
              opacity: hoverSpring.progress.to([0, 0.8, 1], [0, 0, 1]),
            }}
          >
            <a.div
              style={{
                translateX: hoverSpring.progress.to((v) => `${(1 - v) * 40}px`),
              }}
            >
              {hint}
            </a.div>
            <a.div
              style={{
                translateX: hoverSpring.progress.to((v) => `${(1 - v) * -40}px`),
              }}
            >
              <IconArrowRight />
            </a.div>
          </a.div>
        )}
      </a.section>
    </Link>
  );
}

export function ProductCardInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
      })}
    >
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          height: 24,
          fontSize: 14,
          color: "contentAlt",
        })}
      >
        {label}
      </div>
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          height: 24,
          fontSize: 20,
          color: "interactive",
          letterSpacing: "-0.02em",
        })}
      >
        {value}
      </div>
    </div>
  );
}

ProductCard.Group = ProductCardGroup;
ProductCard.Info = ProductCardInfo;
