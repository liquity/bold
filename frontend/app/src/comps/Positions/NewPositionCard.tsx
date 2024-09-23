import { ActionIcon } from "@/src/comps/ActionCard/ActionIcon";
import content from "@/src/content";
import { css } from "@/styled-system/css";
import { token } from "@/styled-system/tokens";
import { lerp } from "@liquity2/uikit";
import { a, useSpring } from "@react-spring/web";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const contentActions = content.home.actions;
const actionAttributes = {
  borrow: {
    colors: {
      background: token("colors.brandDarkBlue"),
      foreground: token("colors.brandDarkBlueContent"),
      foregroundAlt: token("colors.strongSurfaceContentAlt"),
    },
    description: contentActions.borrow.description,
    path: "/borrow",
    title: "Borrow",
  },
  leverage: {
    colors: {
      background: token("colors.brandGreen"),
      foreground: token("colors.brandGreenContent"),
      foregroundAlt: token("colors.brandGreenContentAlt"),
    },
    description: contentActions.leverage.description,
    path: "/leverage",
    title: "Leverage",
  },
  earn: {
    colors: {
      background: token("colors.brandBlue"),
      foreground: token("colors.brandBlueContent"),
      foregroundAlt: token("colors.brandBlueContentAlt"),
    },
    description: contentActions.earn.description,
    path: "/earn",
    title: "Earn",
  },
  stake: {
    colors: {
      background: token("colors.brandGolden"),
      foreground: token("colors.brandGoldenContent"),
      foregroundAlt: token("colors.brandGoldenContentAlt"),
    },
    description: contentActions.stake.description,
    path: "/stake",
    title: "Stake",
  },
} as const;

const RESET_DELAY = 500;
const COMPRESSED_WIDTH = 28;
const ANIMATE_ICONS = true;

export function NewPositionCard() {
  const [hovered, setHovered_] = useState(-1);

  const delayedSetHovered = useRef<ReturnType<typeof setTimeout>>();
  const setHovered = (index: number, delay: number = 0) => {
    clearTimeout(delayedSetHovered.current);
    delayedSetHovered.current = setTimeout(() => {
      setHovered_(index);
    }, delay);
  };
  useEffect(() => () => {
    clearTimeout(delayedSetHovered.current);
  }, []);

  const spring = useSpring({
    from: {
      hovered0: 0,
      hovered1: 0,
      hovered2: 0,
      hovered3: 0,

      compressed0: 0,
      compressed1: 0,
      compressed2: 0,
      compressed3: 0,

      gridTemplateColumns: "25% 25% 25% 25%",
    },
    to: {
      hovered0: hovered === 0 ? 1 : 0,
      hovered1: hovered === 1 ? 1 : 0,
      hovered2: hovered === 2 ? 1 : 0,
      hovered3: hovered === 3 ? 1 : 0,

      compressed0: hovered !== -1 && hovered !== 0 ? 1 : 0,
      compressed1: hovered !== -1 && hovered !== 1 ? 1 : 0,
      compressed2: hovered !== -1 && hovered !== 2 ? 1 : 0,
      compressed3: hovered !== -1 && hovered !== 3 ? 1 : 0,

      gridTemplateColumns: Array.from({ length: 4 }).map((_, index) => (
        hovered === -1
          ? "25%"
          : `${
            (hovered === index
              ? (348 - (COMPRESSED_WIDTH * 3)) / 348
              : (COMPRESSED_WIDTH / 348)) * 100
          }%`
      )).join(" "),
    },
    config: {
      mass: 1,
      tension: 1800,
      friction: 140,
    },
  });

  return (
    <div
      className={css({
        position: "relative",
        display: "grid",
      })}
    >
      <a.div
        className={css({
          display: "grid",
        })}
        style={{
          gridTemplateColumns: spring.gridTemplateColumns,
        }}
      >
        {Object.entries(actionAttributes).map(([type, {
          description,
          path,
          title,
          colors,
        }], index) => {
          const hprogress = spring[
            `hovered${index}` as keyof typeof spring
          ] as typeof spring[`hovered${0 | 1 | 2 | 3}`];

          const cprogress = spring[
            `compressed${index}` as keyof typeof spring
          ] as typeof spring[`compressed${0 | 1 | 2 | 3}`];

          const content = (
            <section
              className={css({
                position: "relative",
                height: "100%",
              })}
            >
              <a.h1
                className={css({
                  position: "absolute",
                  fontSize: 16,
                })}
                style={{
                  opacity: cprogress.to((p) => 1 - p),
                  left: hprogress.to((p) => lerp(8, 12, p)),
                  bottom: hprogress.to((p) => lerp(12, 80, p)),
                  transformOrigin: "0% 100%",
                  transform: hprogress.to(
                    [0, 0.5, 1],
                    [0, 1, 1],
                  ).to((p) => `
                    rotate(${(1 - p) * -90}deg)
                    translateY(${(1 - p) * 100}%)
                  `),
                }}
              >
                {title}
              </a.h1>
              <a.p
                className={css({
                  position: "absolute",
                  left: 12,
                  bottom: 12,
                  width: 190,
                  fontSize: 14,
                })}
                style={{
                  transform: hprogress.to([0, 0.9, 1], [0, 0, 1]).to((p) => `
                    translateY(${(1 - p) * 20}px) 
                  `),
                  opacity: hprogress.to([0, 0.9, 1], [0, 0, 1]),
                  color: colors.foregroundAlt,
                }}
              >
                {description}
              </a.p>
              <a.div
                className={css({
                  position: "absolute",
                  inset: "16px auto auto 16px",
                })}
                style={{
                  opacity: cprogress.to((p) => 1 - p),
                }}
              >
                <ActionIcon
                  colors={colors}
                  iconType={type as keyof typeof actionAttributes}
                  state={ANIMATE_ICONS && hovered === index ? "active" : "idle"}
                />
              </a.div>
            </section>
          );

          const className = css({
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            _focusVisible: {
              outline: "2px solid token(colors.focused)",
              outlineOffset: 2,
            },
          });

          const style = {
            zIndex: index === hovered ? 1 : 0,
            background: colors.background,
            color: colors.foreground,
            borderRadius: index === 0 ? "8px 0 0 8px" : index === 3 ? "0 8px 8px 0" : 0,
          };

          return (
            <Link
              key={path}
              href={path}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(-1, RESET_DELAY)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(-1)}
              className={className}
              style={style}
            >
              {content}
            </Link>
          );
        })}
      </a.div>
    </div>
  );
}
