"use client";

import type { ReactNode } from "react";

import { autoUpdate, offset, shift, useFloating } from "@floating-ui/react-dom";
import { a, useTransition } from "@react-spring/web";
import { useEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import { Root } from "../Root/Root";

export function Tooltip({
  children,
  hideDelay = 200,
  opener,
  placement = "start",
  showDelay = 100,
}: {
  children?: ReactNode;
  hideDelay?: number;
  opener: (context: {
    buttonProps: {
      onClick: () => void;
      onMouseEnter: () => void;
      onMouseLeave: () => void;
    };
    setReference: (ref: HTMLElement | null) => void;
  }) => ReactNode;
  placement?: "start" | "end";
  showDelay?: number;
}) {
  const [{ visible, autofocus }, setState] = useState({
    visible: false,
    autofocus: false,
  });

  const lastFocused = useRef<HTMLElement | null>(undefined);
  const hideDelayRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const showDelayRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cancel = () => {
    clearTimeout(hideDelayRef.current);
    clearTimeout(showDelayRef.current);
  };

  const show = (autofocus: boolean, delay: number) => {
    cancel();
    showDelayRef.current = setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        lastFocused.current = document.activeElement;
      }
      setState({ autofocus, visible: true });
    }, delay);
  };

  const hide = (delay: number) => {
    cancel();
    hideDelayRef.current = setTimeout(() => {
      setState({ autofocus: false, visible: false });
      lastFocused.current?.focus();
    }, delay);
  };

  useKeyboardNavigation({
    onClose: () => hide(0),
    visible,
  });

  const { refs: floatingRefs, floatingStyles } = useFloating({
    placement: `bottom-${placement}`,
    open: visible,
    whileElementsMounted: (referenceEl, floatingEl, update) => (
      autoUpdate(referenceEl, floatingEl, update, {
        layoutShift: false,
        animationFrame: false,
      })
    ),
    middleware: [
      offset(8),
      shift({
        crossAxis: true,
        padding: 8,
      }),
    ],
    transform: false,
  });

  const transition = useTransition(visible, {
    from: {
      opacity: 0,
      transform: "scale(0.97)",
    },
    enter: {
      opacity: 1,
      transform: "scale(1)",
    },
    leave: {
      opacity: 0,
      transform: "scale(1)",
    },
    config: {
      mass: 1,
      tension: 4000,
      friction: 80,
    },
  });

  return (
    <>
      {opener({
        buttonProps: {
          onClick: () => show(true, 0),
          onMouseEnter: () => show(false, showDelay),
          onMouseLeave: () => hide(hideDelay),
        },
        setReference: floatingRefs.setReference,
      })}
      <Root>
        {transition((transitionStyles, visible) => (
          visible && (
            <a.div
              ref={floatingRefs.setFloating}
              onMouseEnter={() => cancel()}
              onMouseLeave={() => hide(hideDelay)}
              className={css({
                position: "absolute",
                zIndex: 1,
                top: 0,
                left: 0,
                width: "100%",
                maxWidth: 300,
              })}
              style={{
                ...transitionStyles,
                ...floatingStyles,
              }}
            >
              <TooltipPopup
                autofocus={autofocus}
                onHide={() => hide(0)}
              >
                {children}
              </TooltipPopup>
            </a.div>
          )
        ))}
      </Root>
    </>
  );
}

function TooltipPopup({
  autofocus,
  children,
  onHide,
}: {
  autofocus: boolean;
  children?: ReactNode;
  onHide: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autofocus) {
      ref.current?.focus();
    }
  }, [autofocus]);

  return (
    <section
      ref={ref}
      tabIndex={0}
      onBlur={({ currentTarget, relatedTarget }) => {
        if (!currentTarget.contains(relatedTarget)) {
          onHide();
        }
      }}
      className={css({
        padding: "12px 12px 16px",
        background: "background",
        border: "1px solid token(colors.border)",
        borderRadius: 4,
        boxShadow: `
          0 15px 35px rgba(60, 66, 87, 0.12),
          0  5px 15px rgba(0,  0,  0,  0.08)
        `,
        _focusVisible: {
          outlineOffset: -1,
          outline: "2px solid token(colors.focused)",
        },
      })}
    >
      {children}
    </section>
  );
}

function useKeyboardNavigation({
  onClose,
  visible,
}: {
  onClose: () => void;
  visible: boolean;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!visible) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, visible]);
}
