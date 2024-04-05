import type { ReactNode } from "react";

import { Root } from "@/src/comps/Root/Root";
import { css } from "@/styled-system/css";
import { a, useTransition } from "@react-spring/web";
import FocusTrap from "focus-trap-react";

import closeSvg from "./close.svg";

export function Modal({
  children,
  onClose,
  visible,
}: {
  children: ReactNode;
  onClose: () => void;
  visible: boolean;
}) {
  const visibility = useTransition(visible, {
    config: {
      mass: 1,
      tension: 1800,
      friction: 80,
    },
    from: {
      closeTransform: "scale3d(0.8, 0.8, 1)",
      opacity: 0,
      overlayOpacity: 0,
      transform: "scale3d(0.95, 0.95, 1)",
    },
    enter: {
      closeTransform: "scale3d(1, 1, 1)",
      opacity: 1,
      overlayOpacity: 1,
      transform: "scale3d(1, 1, 1)",
    },
    leave: {
      closeTransform: "scale3d(1, 1, 1)",
      opacity: 0,
      overlayOpacity: 0,
      transform: "scale3d(1.05, 1.05, 1)",
    },
  });
  return (
    <Root>
      {visibility(({
        closeTransform,
        opacity,
        overlayOpacity,
        transform,
      }, item) => (
        item && (
          <a.section
            style={{
              opacity: overlayOpacity,
              pointerEvents: visible ? "auto" : "none",
            }}
            className={css({
              position: "fixed",
              inset: 0,
              zIndex: 2,
              overflow: "auto",
              background: "rgba(18, 27, 68, 0.7)",
            })}
          >
            <div
              onMouseDown={({ target, currentTarget }) => {
                if (target === currentTarget) {
                  onClose();
                }
              }}
              className={css({
                display: "flex",
                justifyContent: "center",
                minHeight: "100%",
              })}
            >
              <FocusTrap
                active={visible}
                focusTrapOptions={{
                  onDeactivate: onClose,
                  allowOutsideClick: true,
                }}
              >
                <div
                  onMouseDown={({ target, currentTarget }) => {
                    if (target === currentTarget) {
                      onClose();
                    }
                  }}
                  className={css({
                    minHeight: "100%",
                    padding: 64,
                  })}
                >
                  <a.div
                    style={{
                      opacity,
                      transform,
                    }}
                    className={css({
                      width: 600,
                      minHeight: "100%",
                      maxWidth: "100%",
                      padding: 40,
                      outline: "2px solid accent",
                      background: "white",
                    })}
                  >
                    <div>
                      {children}
                    </div>
                  </a.div>
                  <a.div
                    style={{
                      opacity,
                      transform: closeTransform,
                    }}
                    className={css({
                      position: "fixed",
                      zIndex: 3,
                      top: 24,
                      right: 24,
                    })}
                  >
                    <CloseButton onClick={onClose} />
                  </a.div>
                </div>
              </FocusTrap>
            </div>
          </a.section>
        )
      ))}
    </Root>
  );
}

function CloseButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={css({
        width: 56,
        height: 56,
        padding: 0,
        border: "none",
        cursor: "pointer",
        borderRadius: "50%",
        backgroundColor: "#fff",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "50% 50%",
        outline: 0,
        _active: {
          translate: "0 1px",
        },
        _focusVisible: {
          outline: "2px solid accent",
        },
      })}
      style={{
        backgroundImage: `url(${closeSvg.src})`,
      }}
    >
    </button>
  );
}
