import type { MenuSection } from "@/src/types";
import type { Dispatch, ReactNode, SetStateAction } from "react";

import { css, cx } from "@/styled-system/css";
import { TokenIcon } from "@liquity2/uikit";
import { IconArrowRight, useElementSize } from "@liquity2/uikit";
import { a, useSpring } from "@react-spring/web";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

export function MenuDrawer({
  onMouseEnter,
  onMouseLeave,
  opened,
  sections,
}: {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  opened: number;
  sections: MenuSection[];
}) {
  const [heights, setHeights] = useState<number[]>(
    Array.from({ length: sections.length }).fill(0) as number[],
  );

  const tallestHeight = Math.max(...heights);

  const drawerSpring = useSpring({
    from: {
      shadowOpacity: 0,
      transform: `translateY(${-tallestHeight}px)`,
    },
    to: {
      shadowOpacity: opened === -1 ? 0 : 1,
      transform: `translateY(${(opened === -1 ? 0 : heights[opened])}px)`,
    },
    config: {
      mass: 1,
      tension: 3000,
      friction: 120,
    },
  });

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={css({
        position: "absolute",
        zIndex: 1,
      })}
      style={{
        inset: `${-tallestHeight}px 0 auto 0`,
        height: tallestHeight,
      }}
    >
      <div
        className={css({
          position: "absolute",
          zIndex: 2,
          inset: `${tallestHeight}px 0 auto 0`,
          height: 32,
          background: "linear-gradient(180deg, token(colors.background) 0%, transparent 100%)",
          pointerEvents: "none",
        })}
      />
      <a.div
        className={css({
          position: "absolute",
          zIndex: 1,
          inset: "auto 0 0 0",
          display: "flex",
          justifyContent: "center",
          height: "100%",
          background: "background",
        })}
        style={{
          transform: drawerSpring.transform,
        }}
      >
        <a.div
          className={css({
            position: "absolute",
            inset: 0,
            background: "background",
            boxShadow: `
              0 24px 10px rgba(18, 27, 68, 0.08),
              0 14px 8px  rgba(18, 27, 68, 0.03),
              0 6px  6px  rgba(18, 27, 68, 0.07),
              0 2px  3px  rgba(18, 27, 68, 0.08)
            `,
          })}
          style={{
            opacity: drawerSpring.shadowOpacity,
          }}
        />
        {sections.map((section, index) => (
          <DrawerSection
            key={section.label + section.href}
            section={section}
            sectionIndex={index}
            setSectionsHeights={setHeights}
            visible={opened === index}
          />
        ))}
      </a.div>
    </div>
  );
}

function DrawerSection({
  section,
  sectionIndex,
  setSectionsHeights,
  visible,
}: {
  section: MenuSection;
  sectionIndex: number;
  setSectionsHeights: Dispatch<SetStateAction<number[]>>;
  visible: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useElementSize(
    ref,
    useCallback((size: ResizeObserverSize) => {
      setSectionsHeights((heights) => (
        heights.map((height, j) => (
          sectionIndex === j ? size.blockSize : height
        ))
      ));
    }, [sectionIndex, setSectionsHeights]),
  );

  const spring = useSpring({
    opacity: visible ? 1 : 0,
    config: {
      mass: 1,
      tension: 3000,
      friction: 120,
    },
    immediate: !visible,
    delay: 30,
  });

  return (
    <a.section
      ref={ref}
      className={css({
        position: "absolute",
        width: 560,
      })}
      style={{
        bottom: visible ? 0 : "100%",
        pointerEvents: visible ? "auto" : "none",
        visibility: visible ? "visible" : "hidden",
        opacity: spring.opacity,
      }}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "100%",
          padding: "16px 0 32px",
        })}
      >
        <DrawerSectionLink
          href={section.href}
          label={section.label}
          visible={visible}
        />
        {section.actions.length > 0 && (
          <div
            className={css({
              display: "grid",
              gap: 8,
              gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
            })}
          >
            {section.actions.map((action) => (
              <DrawerAction
                key={action.href + action.token}
                action={action}
              />
            ))}
          </div>
        )}
      </div>
    </a.section>
  );
}

function DrawerSectionLink({
  href,
  label,
  visible,
}: {
  href: string;
  label: ReactNode;
  visible: boolean;
}) {
  const ha = useHoverActive();

  const arrowSpring = useSpring({
    transform: `translateX(${ha.hover || ha.active ? 4 : 0}px)`,
    immediate: ha.active,
    config: {
      mass: 1,
      tension: 1800,
      friction: 80,
    },
  });

  return (
    <Link
      href={href}
      tabIndex={visible ? 0 : -1}
      {...ha.props}
      className={css({
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 64,
        padding: "16px 0",
        fontSize: 20,
        _hover: {
          color: "accent",
        },
        _active: {
          translate: "0 1px",
        },
      })}
    >
      <div>{label}</div>
      <a.div
        className={css({
          paddingTop: 4,
        })}
        style={arrowSpring}
      >
        <IconArrowRight size={20} />
      </a.div>
    </Link>
  );
}

function DrawerAction({
  action,
}: {
  action: MenuSection["actions"][number];
}) {
  const ha = useHoverActive();

  const hoverSpring = useSpring({
    transform: `scale(${ha.hover && !ha.active ? 1.01 : 1})`,
    boxShadow: `0 2px 4px rgba(0, 0, 0, ${ha.hover && !ha.active ? 0.1 : 0})`,
    immediate: ha.active,
    config: {
      mass: 1,
      tension: 1800,
      friction: 80,
    },
  });

  return (
    <Link
      href={action.href}
      {...ha.props}
      className={cx(
        "group",
        css({
          outline: "none",
        }),
      )}
    >
      <a.div
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 12,
          padding: "12px",
          fontSize: 14,
          border: "1px solid token(colors.border)",
          borderRadius: 8,
          _groupFocusVisible: {
            outlineOffset: 2,
            outline: "2px solid token(colors.focused)",
          },
          _groupHover: {
            position: "relative",
            zIndex: 2,
            background: "hint",
          },
        })}
        style={hoverSpring}
      >
        <div
          className={css({
            paddingBottom: 12,
          })}
        >
          <TokenIcon
            size="small"
            symbol={action.token}
          />
        </div>
        <div>{action.name}</div>
        <div>{action.secondary}</div>
      </a.div>
    </Link>
  );
}

function useHoverActive() {
  const [[active, hover], set] = useState([false, false]);
  return {
    active,
    hover,
    props: {
      onMouseEnter: () => set((s) => [s[0], true]),
      onMouseLeave: () => set((s) => [s[0], false]),
      onMouseDown: () => set((s) => [true, s[1]]),
      onMouseUp: () => set((s) => [false, s[1]]),
      onBlur: () => set((s) => [false, s[1]]),
    },
  };
}
