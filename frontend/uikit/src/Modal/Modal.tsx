"use client";

import type { ReactNode } from "react";

import { a, useTransition } from "@react-spring/web";
import FocusTrap from "focus-trap-react";
import { useEffect } from "react";
import { css } from "../../styled-system/css";
import { IconCross } from "../icons";
import { Root } from "../Root/Root";
import { TextButton } from "../TextButton/TextButton";

export function Modal({
  children,
  onClose,
  title,
  visible,
  maxWidth = 534,
}: {
  children: ReactNode;
  onClose: () => void;
  title?: ReactNode;
  visible: boolean;
  maxWidth?: number;
}) {
  const visibility = useTransition(visible, {
    config: {
      mass: 1,
      tension: 1800,
      friction: 80,
    },
    from: {
      opacity: 0,
      overlayOpacity: 0,
      transform: "scale3d(0.97, 0.97, 1)",
    },
    enter: {
      opacity: 1,
      overlayOpacity: 1,
      transform: "scale3d(1, 1, 1)",
    },
    leave: {
      opacity: 0,
      overlayOpacity: 0,
      transform: "scale3d(1, 1, 1)",
    },
  });

  useEffect(() => {
    if ("document" in globalThis) {
      document.body.style.overflow = visible ? "hidden" : "auto";
    }
  }, [visible]);

  return (
    <Root>
      {visibility(({
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
                    padding: 64,
                  })}
                >
                  <a.div
                    className={css({
                      position: "relative",
                      width: "100%",
                      padding: 24,
                      outline: "2px solid accent",
                      background: "background",
                      borderRadius: 8,
                    })}
                    style={{
                      maxWidth,
                      opacity,
                      transform,
                    }}
                  >
                    <div>
                      {title && (
                        <h1
                          className={css({
                            paddingBottom: 8,
                            fontSize: 24,
                          })}
                        >
                          {title}
                        </h1>
                      )}
                      {children}
                    </div>
                    <div
                      className={css({
                        position: "absolute",
                        top: 24,
                        right: 24,
                        display: "flex",
                      })}
                    >
                      <TextButton
                        label={<IconCross size={32} />}
                        onClick={onClose}
                        className={css({
                          color: "content!",
                        })}
                      />
                    </div>
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
