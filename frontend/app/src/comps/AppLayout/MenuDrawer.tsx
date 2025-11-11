import type { MenuItem } from "./Menu";

import { css } from "@/styled-system/css";
import { Root, IconCross } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import FocusTrap from "focus-trap-react";
import Link from "next/link";
import { useState } from "react";
import { AccountButton } from "./AccountButton";

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
      drawerY: -400,
    },
    enter: {
      progress: 1,
      drawerY: 0,
    },
    leave: {
      progress: 0,
      drawerY: -400,
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
                    background: "rgba(0, 0, 0, 0.4)",
                  })}
                  style={{
                    opacity: styles.progress,
                  }}
                />
                <a.div
                  className={css({
                    position: "absolute",
                    top: 24,
                    left: "50%",
                    maxWidth: "calc(100vw - 48px)",
                    width: "100%",
                    borderRadius: 16,
                    background: "rgba(255, 255, 255, 0.20)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 0,
                  })}
                  style={{
                    transform: styles.drawerY.to((y) => `translate(-50%, ${y}px)`),
                    backdropFilter: "blur(25px)",
                    WebkitBackdropFilter: "blur(25px)",
                  }}
                >
                  {/* Header with X and Connect */}
                  <div
                    className={css({
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: 8,
                    })}
                  >
                    <button
                      onClick={onClose}
                      className={css({
                        width: 15,
                        height: 15,
                        padding: 0,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      })}
                    >
                      <IconCross size={15} />
                    </button>

                    <AccountButton />
                  </div>

                  {/* Navigation Items */}
                  <div
                    className={css({
                      display: "flex",
                      flexDirection: "column",
                      gap: 24,
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "40px 0 80px",
                    })}
                  >
                    <NavItems
                      menuItems={menuItems}
                      onClose={onClose}
                    />
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
  return (
    <>
      {menuItems.map(([label, href]) => {
        return (
          <div key={label + href}>
            <Link
              href={href}
              onClick={onClose}
              className={`font-audiowide ${css({
                fontSize: 36,
                fontWeight: 400,
                color: "white",
                textTransform: "uppercase",
                textDecoration: "none",
                transition: "all 0.2s",
                "&:hover": {
                  opacity: 0.8,
                },
              })}`}
            >
              {label}
            </Link>
          </div>
        );
      })}
    </>
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
          color: "white",
          padding: "0 8px",
          marginLeft: -12,
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
            stroke: "white",
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
