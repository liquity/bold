import content from "@/src/content";
import { css, cx } from "@/styled-system/css";
import { a, useSpring } from "@react-spring/web";
import Link from "next/link";
import { useState } from "react";
import { match } from "ts-pattern";

export function ActionCard({
  type,
}: {
  type: "borrow" | "multiply" | "earn";
}) {
  const [hint, setHint] = useState(false);
  const [active, setActive] = useState(false);

  const hintSpring = useSpring({
    transform: active
      ? "scale(0.98)"
      : hint
      ? "scale(1.02)"
      : "scale(1)",
    opacity: hint ? 1 : 0.9,
    immediate: active,
    config: {
      mass: 1,
      tension: 1800,
      friction: 80,
    },
  });

  const { actions: ac } = content.home;
  const { description, path, title } = match(type)
    .with("borrow", () => ({
      description: ac.borrow.description,
      path: "/borrow",
      title: ac.borrow.title,
    }))
    .with("multiply", () => ({
      description: ac.multiply.description,
      path: "/multiply",
      title: ac.multiply.title,
    }))
    .with("earn", () => ({
      description: ac.earn.description,
      path: "/earn",
      title: ac.earn.title,
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
          outline: 0,
          userSelect: "none",
          textDecoration: "none",
        }),
      )}
    >
      <a.div
        className={css({
          background: "rgba(0, 0, 0, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 16,
          padding: "28px 24px",
          color: "white",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "100%",
          cursor: "pointer",
          transition: "all 0.2s",
          minHeight: "160px",
          _groupFocusVisible: {
            outline: "2px solid token(colors.focused)",
            outlineOffset: 2,
          },
        })}
        style={hintSpring}
      >
        <h3
          className={`font-audiowide ${css({
            fontSize: "24px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "white",
          })}`}
        >
          {title}
        </h3>
        <p
          className={css({
            fontSize: "16px",
            opacity: 0.9,
            lineHeight: 1.6,
            color: "rgba(255, 255, 255, 0.9)",
          })}
        >
          {description}
        </p>
      </a.div>
    </Link>
  );
}