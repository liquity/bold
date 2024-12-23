import content from "@/src/content";
import { css, cx } from "@/styled-system/css";
import { token } from "@/styled-system/tokens";
import { a, useSpring } from "@react-spring/web";
import Link from "next/link";
import { useState } from "react";
import { match } from "ts-pattern";
import { ActionIcon } from "./ActionIcon";

export function ActionCard({
  type,
}: {
  type: "borrow" | "multiply" | "earn" | "stake";
}) {
  const [hint, setHint] = useState(false);
  const [active, setActive] = useState(false);

  const hintSpring = useSpring({
    transform: active
      ? "scale(1.01)"
      : hint
      ? "scale(1.02)"
      : "scale(1)",
    boxShadow: hint && !active
      ? "0 2px 4px rgba(0, 0, 0, 0.1)"
      : "0 2px 4px rgba(0, 0, 0, 0)",
    immediate: active,
    config: {
      mass: 1,
      tension: 1800,
      friction: 80,
    },
  });

  const { actions: ac } = content.home;
  const { description, path, title, colors } = match(type)
    .with("borrow", () => ({
      colors: {
        background: token("colors.brandDarkBlue"),
        foreground: token("colors.brandDarkBlueContent"),
        foregroundAlt: token("colors.brandDarkBlueContentAlt"),
      },
      description: ac.borrow.description,
      path: "/borrow",
      title: ac.borrow.title,
    }))
    .with("multiply", () => ({
      colors: {
        background: token("colors.brandGreen"),
        foreground: token("colors.brandGreenContent"),
        foregroundAlt: token("colors.brandGreenContentAlt"),
      },
      description: ac.multiply.description,
      path: "/multiply",
      title: ac.multiply.title,
    }))
    .with("earn", () => ({
      colors: {
        background: token("colors.brandBlue"),
        foreground: token("colors.brandBlueContent"),
        foregroundAlt: token("colors.brandBlueContentAlt"),
      },
      description: ac.earn.description,
      path: "/earn",
      title: ac.earn.title,
    }))
    .with("stake", () => ({
      colors: {
        background: token("colors.brandGolden"),
        foreground: token("colors.brandGoldenContent"),
        foregroundAlt: token("colors.brandGoldenContentAlt"),
      },
      description: ac.stake.description,
      path: "/stake",
      title: ac.stake.title,
    }))
    .exhaustive();

  return (
    <Link
      key={path}
      href={path}
      onMouseEnter={() => setHint(true)}
      onMouseLeave={() => setHint(false)}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      onBlur={() => setActive(false)}
      className={cx(
        "group",
        css({
          display: "flex",
          color: "gray:50",
          outline: 0,
          userSelect: "none",
        }),
      )}
    >
      <a.section
        className={css({
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "100%",
          padding: "20px 24px",
          borderRadius: 8,
          _groupFocusVisible: {
            outline: "2px solid token(colors.focused)",
            outlineOffset: 2,
          },
          _groupHover: {
            transform: "scale(1.05)",
          },
        })}
        style={{
          background: colors.background,
          color: colors.foreground,
          ...hintSpring,
        }}
      >
        <h1>{title}</h1>
        <p
          className={css({
            height: 64,
            fontSize: 14,
          })}
          style={{
            color: colors.foregroundAlt,
          }}
        >
          {description}
        </p>
        <div
          className={css({
            position: "absolute",
            inset: "20px 24px auto auto",
          })}
        >
          <ActionIcon
            colors={colors}
            iconType={type}
            state={hint ? "active" : "idle"}
          />
        </div>
      </a.section>
    </Link>
  );
}
