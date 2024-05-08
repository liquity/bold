import type { ReactNode } from "react";
import type { CSSProperties } from "react";

import { autoUpdate, offset, shift, useFloating } from "@floating-ui/react-dom";
import { a, useTransition } from "@react-spring/web";
import { useEffect, useRef, useState } from "react";
import { css, cx } from "../../styled-system/css";
import { IconChevronDown } from "../icons";
import { Root } from "../Root/Root";

export type DropdownItem = ReactNode | {
  icon?: ReactNode;
  label: ReactNode;
  value?: ReactNode;
};

export function Dropdown({
  buttonDisplay = "normal",
  items,
  menuWidth,
  onSelect,
  placeholder,
  selected,
}: {
  buttonDisplay?: "normal" | "label-only";
  items: DropdownItem[];
  menuWidth?: number;
  onSelect: (index: number) => void;
  placeholder?: Exclude<DropdownItem, "value">;
  selected: number;
}) {
  const { refs: floatingRefs, floatingStyles } = useFloating<HTMLButtonElement>({
    placement: "bottom-start",
    whileElementsMounted: (referenceEl, floatingEl, update) => (
      autoUpdate(referenceEl, floatingEl, update, {
        layoutShift: false,
        animationFrame: false,
      })
    ),
    middleware: [
      offset(8),
      shift(),
    ],
    transform: false,
  });

  if (typeof placeholder === "string") {
    placeholder = { label: placeholder };
  }

  if (selected === undefined) {
    selected = placeholder ? -1 : 0;
  }

  const [showMenu, setShowMenu] = useState(false);

  const hide = (refocusReference = true) => {
    setShowMenu(false);

    // refocus the opening button
    if (refocusReference) {
      floatingRefs.reference?.current?.focus();
    }
  };

  const show = () => {
    setFocused(selected === -1 ? 0 : selected); // reset focus to the selected item
    setShowMenu(true);

    // focus the selected item in the menu
    const { current: container } = focusContainer;
    const selectedButton = container?.querySelector("[tabindex=\"0\"]") as HTMLElement;
    selectedButton?.focus();
  };

  const menuVisibility = useTransition(showMenu, {
    config: {
      mass: 1,
      tension: 4000,
      friction: 80,
    },
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
      transform: "scale(0.97)",
    },
  });

  const [focused, setFocused] = useState(0);
  const focusContainer = useRef<HTMLDivElement>(null);

  useKeyboardNavigation({
    focused,
    itemsLength: items.length,
    menuVisible: showMenu,
    onClose: hide,
    onFocus: setFocused,
  });

  useEffect(() => {
    if (!showMenu) {
      return;
    }
    const selectedButton = focusContainer.current?.querySelector(
      "[tabindex=\"0\"]",
    ) as HTMLElement;
    selectedButton?.focus();
  }, [focused, showMenu]);

  let buttonItem = getItem(items[selected] || placeholder);
  if (!buttonItem) {
    throw new Error("Invalid selected index or placeholder not provided");
  }

  return (
    <>
      <button
        ref={floatingRefs.setReference}
        type="button"
        onClick={() => {
          if (showMenu) {
            hide();
          } else {
            show();
          }
        }}
        className={cx(
          "group",
          css({
            display: "flex",
            height: 40,
            fontSize: 24,
            outline: 0,
            cursor: "pointer",
          }),
        )}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            padding: "0 10px 0 16px",
            gap: 8,
            height: "100%",
            borderWidth: "1px 1px 0 1px",
            borderStyle: "solid",
            borderColor: "#F5F6F8",
            boxShadow: `
              0 2px 2px rgba(0, 0, 0, 0.1),
              0 4px 10px rgba(18, 27, 68, 0.05),
              inset 0 -1px 4px rgba(0, 0, 0, 0.05)
            `,
            borderRadius: 90,
            cursor: "pointer",

            "--color-normal": "token(colors.content)",
            "--color-placeholder": "token(colors.accentContent)",
            "--background-normal": "token(colors.controlSurface)",
            "--background-placeholder": "token(colors.accent)",

            _groupActive: {
              translate: "0 1px",
              boxShadow: `0 1px 1px rgba(0, 0, 0, 0.1)`,
            },
            _groupFocusVisible: {
              outline: "2px solid token(colors.focused)",
            },
          })}
          style={{
            color: `var(${buttonItem === placeholder ? "--color-placeholder" : "--color-normal"})`,
            background: `var(${buttonItem === placeholder ? "--background-placeholder" : "--background-normal"})`,
          } as CSSProperties}
        >
          {buttonItem.icon && buttonDisplay !== "label-only" && (
            <div style={{ marginLeft: -6 }}>
              {buttonItem.icon}
            </div>
          )}
          <div>
            {buttonItem.label}
          </div>
          <div>
            <IconChevronDown />
          </div>
        </div>
      </button>
      <Root>
        {menuVisibility((appearStyles, show) => (
          show && (
            <a.div
              ref={floatingRefs.setFloating}
              className={css({
                position: "absolute",
                top: 0,
                left: 0,
              })}
              style={{
                ...floatingStyles,
                width: menuWidth,
              }}
            >
              <a.div
                ref={focusContainer}
                className={css({
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  background: "controlSurface",
                  borderRadius: 20,
                  border: "1px solid token(colors.border)",
                  boxShadow: `
                    0 24px 10px rgba(18, 27, 68, 0.01),
                    0 14px 8px rgba(18, 27, 68, 0.05),
                    0 6px 6px rgba(18, 27, 68, 0.09),
                    0 2px 3px rgba(18, 27, 68, 0.1)
                  `,
                })}
                style={appearStyles}
              >
                {items.map((item, index) => {
                  item = getItem(item);
                  return item && (
                    <button
                      key={index}
                      tabIndex={index === focused ? 0 : -1}
                      type="button"
                      onMouseOver={() => {
                        setFocused(index);
                      }}
                      onClick={() => {
                        onSelect(index);
                        hide();
                      }}
                      onBlur={({ relatedTarget: focusTarget }) => {
                        // focus outside
                        if (!focusContainer.current?.contains(focusTarget)) {
                          hide(false); // do not refocus the opening button
                        }
                      }}
                      className={cx(
                        "group",
                        css({
                          display: "flex",
                          height: 56,
                          padding: 4,
                          cursor: "pointer",
                          _focus: {
                            outline: 0,
                          },
                        }),
                      )}
                    >
                      <div
                        className={css({
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 16,
                          width: "100%",
                          height: "100%",
                          padding: "0 16px",
                          borderRadius: 16,
                          transition: "background 80ms",
                          _groupFocus: {
                            background: "focusedSurface",
                          },
                          _groupActive: {
                            background: "focusedSurfaceActive",
                          },
                        })}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          {item.icon && (
                            <div>
                              {item.icon}
                            </div>
                          )}
                          <div>{item.label}</div>
                        </div>
                        {item.value && <div>{item.value}</div>}
                      </div>
                    </button>
                  );
                })}
              </a.div>
            </a.div>
          )
        ))}
      </Root>
    </>
  );
}

// Handles keyboard navigation when the dropdown is open
function useKeyboardNavigation({
  focused,
  itemsLength,
  menuVisible,
  onClose,
  onFocus,
}: {
  focused: number;
  itemsLength: number;
  menuVisible: boolean;
  onClose: () => void;
  onFocus: (index: number) => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      console.log("key down");
      if (!menuVisible) {
        console.log("menu not visible");
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        console.log("ArrowDown, focusing", (focused + 1) % itemsLength);
        onFocus((focused + 1) % itemsLength);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        console.log("ArrowUp, focusing", focused === 0 ? itemsLength - 1 : focused - 1);
        onFocus(focused === 0 ? itemsLength - 1 : focused - 1);
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
  }, [itemsLength, onFocus, focused, menuVisible]);
}

function getItem(item: DropdownItem): null | Exclude<DropdownItem, ReactNode> {
  if (!item) {
    return null;
  }
  return typeof item === "object" && "label" in item ? item : { label: item };
}
