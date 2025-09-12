import type { ReactNode } from "react";
import type { MenuItem } from "./Menu";

import { Logo } from "@/src/comps/Logo/Logo";
import content from "@/src/content";
import { css } from "@/styled-system/css";
import { token } from "@/styled-system/tokens";
import { Root } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import FocusTrap from "focus-trap-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AboutButton } from "./AboutButton";

const DRAWER_WIDTH = 180;
const DRAWER_SAFE_SPACING = 20; // prevent a gap to appear during the transition

function MenuDrawer({
  menuItems,
  onClose,
  opened,
}: {
  menuItems: MenuItem[];
  onClose: () => void;
  opened: boolean;
}) {
  const transition = useTransition(opened, {
    from: {
      progress: 0,
      drawerX: DRAWER_WIDTH + DRAWER_SAFE_SPACING * 2,
    },
    enter: {
      progress: 1,
      drawerX: DRAWER_SAFE_SPACING,
    },
    leave: {
      progress: 0,
      drawerX: DRAWER_WIDTH + DRAWER_SAFE_SPACING * 2,
    },
    config: { mass: 1, tension: 1400, friction: 100 },
  });

  return (
    <Root>
      {transition(
        (styles, show) =>
          show && (
            <FocusTrap
              active={opened}
              focusTrapOptions={{
                onDeactivate: onClose,
                allowOutsideClick: true,
              }}
            >
              <a.div
                className={css({
                  overflow: "hidden",
                  position: "fixed",
                  zIndex: 2,
                  inset: 0,
                })}
                style={{
                  pointerEvents: opened ? "auto" : "none",
                }}
              >
                <a.div
                  tabIndex={0}
                  onMouseDown={({ target, currentTarget }) => {
                    if (target === currentTarget) {
                      onClose();
                    }
                  }}
                  className={css({
                    position: "absolute",
                    inset: 0,
                    background: "rgba(18, 27, 68, 0.7)",
                  })}
                  style={{
                    opacity: styles.progress,
                  }}
                />
                <a.div
                  className={css({
                    position: "absolute",
                    inset: "0 0 0 auto",
                    background: "background",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                  })}
                  style={{
                    width: DRAWER_WIDTH + DRAWER_SAFE_SPACING,
                    transform: styles.drawerX.to((x) => `translateX(${x}px)`),
                  }}
                >
                  <a.div
                    className={css({
                      position: "absolute",
                      top: 0,
                      left: 0,
                      display: "flex",
                      flexDirection: "column",
                      paddingTop: 16,
                      paddingLeft: 8,
                      paddingRight: 8,
                    })}
                    style={{
                      width: DRAWER_WIDTH,
                    }}
                  >
                    <a.div
                      className={css({
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        height: 48,
                        paddingLeft: 16,
                        paddingRight: 8,
                        userSelect: "none",
                      })}
                      style={{
                        opacity: styles.progress,
                        transform: styles.progress
                          .to([0, 1], [40, 0])
                          .to((x) => `translateX(${x}px`),
                      }}
                    >
                      <div
                        className={css({
                          flexShrink: 0,
                        })}
                      >
                        <Logo size={20} />
                      </div>
                      <div
                        className={css({
                          flexShrink: 0,
                          fontSize: 15,
                          whiteSpace: "nowrap",
                        })}
                      >
                        {content.appName}
                      </div>
                    </a.div>
                    <NavItems
                      menuItems={menuItems}
                      onClose={onClose}
                    />
                  </a.div>
                  <div
                    className={css({
                      padding: 24,
                    })}
                  >
                    <AboutButton onClick={onClose} />
                  </div>
                </a.div>
              </a.div>
            </FocusTrap>
          ),
      )}
    </Root>
  );
}

function NavItems({
  menuItems,
  onClose,
}: {
  menuItems: MenuItem[];
  onClose: () => void;
}) {
  const pathname = usePathname();

  const transition = useTransition(menuItems, {
    keys: (item) => item[1],
    initial: {
      opacity: 0,
      transform: "translateX(40px)",
    },
    enter: {
      opacity: 1,
      transform: "translateX(0)",
    },
    delay: 100,
    trail: 30,
    config: {
      mass: 1,
      tension: 2400,
      friction: 120,
    },
  });

  return (
    <nav>
      <ul
        className={css({
          display: "flex",
          flexDirection: "column",
        })}
      >
        {transition((styles, [label, href, Icon]) => {
          const selected = href === "/"
            ? pathname === "/"
            : pathname.startsWith(href);
          return (
            <a.li
              key={label + href}
              style={styles}
            >
              <Link
                href={href}
                onClick={onClose}
                className={css({
                  display: "block",
                  width: "100%",
                  padding: "0 16px",
                  _active: {
                    translate: "0 1px",
                  },
                  _focusVisible: {
                    outline: "2px solid token(colors.focused)",
                    borderRadius: 4,
                  },
                })}
                style={{
                  color: token(
                    `colors.${selected ? "selected" : "interactive"}`,
                  ),
                }}
              >
                <Item
                  icon={<Icon />}
                  label={label}
                  selected={selected}
                />
              </Link>
            </a.li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MenuDrawerButton({
  menuItems,
}: {
  menuItems: MenuItem[];
}) {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <button
        onClick={() => {
          setOpened(true);
        }}
        type="button"
        className={css({
          display: "flex",
          alignItems: "center",
          height: "100%",
          cursor: "pointer",
          color: "interactive",
          padding: "0 8px",
          marginRight: -12,
          borderRadius: 4,
          _focusVisible: {
            outline: "2px solid token(colors.focused)",
          },
          _active: {
            translate: "0 1px",
          },
        })}
      >
        <svg
          viewBox="0 0 24 24"
          width={24}
          height={24}
          className={css({
            stroke: "interactive",
            strokeWidth: 2,
          })}
        >
          <line x1="4" y1="6" x2="20" y2="6" strokeLinecap="round" />
          <line x1="4" y1="12" x2="20" y2="12" strokeLinecap="round" />
          <line x1="4" y1="18" x2="20" y2="18" strokeLinecap="round" />
        </svg>
      </button>
      <MenuDrawer
        menuItems={menuItems}
        onClose={() => {
          setOpened(false);
        }}
        opened={opened}
      />
    </>
  );
}

function Item({
  icon,
  label,
  selected,
}: {
  icon: ReactNode;
  label: ReactNode;
  selected?: boolean;
}) {
  return (
    <div
      aria-selected={selected}
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        height: 48,
        color: "content",
        cursor: "pointer",
        userSelect: "none",
        overflow: "hidden",
        textOverflow: "ellipsis",
      })}
      style={{
        color: token(`colors.${selected ? "selected" : "interactive"}`),
      }}
    >
      <div
        className={css({
          display: "grid",
          placeItems: "center",
          width: 24,
          height: 24,
          marginLeft: -2, // icons ~20x20 inside the 24x24 box
        })}
      >
        {icon}
      </div>
      <div
        className={css({
          flexShrink: 1,
          flexGrow: 1,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
        })}
      >
        <div
          className={css({
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          })}
        >
          {label}
        </div>
      </div>
    </div>
  );
}
