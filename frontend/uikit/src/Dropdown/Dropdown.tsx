import type { ReactElement, ReactNode } from "react";
import type { CSSProperties } from "react";

import { autoUpdate, offset, shift, useFloating } from "@floating-ui/react-dom";
import { a, useTransition } from "@react-spring/web";
import { isValidElement, useEffect, useId, useRef, useState } from "react";
import { css, cx } from "../../styled-system/css";
import { IconChevronDown } from "../icons";
import { Root } from "../Root/Root";

export type DropdownItem = {
  disabled?: boolean | string;
  icon?: ReactNode;
  label: ReactNode;
  secondary?: ReactNode;
  value?: ReactNode;
};

export type DropdownGroup = {
  label: ReactNode;
  items: readonly DropdownItem[];
};

export function Dropdown({
  buttonDisplay = "normal",
  items,
  menuPlacement = "start",
  menuWidth,
  onSelect,
  placeholder,
  selected,
  size = "medium",
}: {
  buttonDisplay?:
    | "normal"
    | "label-only"
    | ReactElement
    | ((item: DropdownItem, index: number) => {
      icon?: ReactNode;
      label: ReactNode;
    });
  items: readonly DropdownItem[] | readonly DropdownGroup[];
  menuPlacement?: "start" | "end";
  menuWidth?: number;
  onSelect: (index: number) => void;
  placeholder?: ReactNode | Exclude<DropdownItem, "value">;
  selected: null | number;
  size?: "small" | "medium";
}) {
  const groups = getGroups(items);
  const itemsOnly = groups.reduce(
    (acc, { items }) => acc.concat(items),
    [] as DropdownItem[],
  );

  const { refs: floatingRefs, floatingStyles } = useFloating<HTMLButtonElement>({
    placement: `bottom-${menuPlacement}`,
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

  if (selected === null) {
    selected = placeholder ? -1 : 0;
  }

  const [showMenu, setShowMenu] = useState(false);

  // prevent the popup from reopening
  // if the user clicks the button to close it
  const preventOpenOnRelease = useRef(false);

  const hide = (refocusReference = true) => {
    setShowMenu(false);

    if (refocusReference) {
      // refocus the opening button
      floatingRefs.reference?.current?.focus();
    }
  };

  const show = () => {
    setFocused(selected === -1 ? 0 : selected); // reset focus to the selected item
    setShowMenu(true);

    preventOpenOnRelease.current = false;

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
    itemsLength: itemsOnly.length,
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
    setTimeout(() => {
      selectedButton?.focus();
    }, 0);
  }, [focused, showMenu]);

  let buttonItem = getItem(itemsOnly[selected] || placeholder);
  if (typeof buttonDisplay === "function" && itemsOnly[selected]) {
    buttonItem = buttonDisplay(itemsOnly[selected], selected);
  }
  if (!buttonItem) {
    throw new Error("Invalid selected index or placeholder not provided");
  }

  const customButton = isValidElement(buttonDisplay) ? buttonDisplay : null;

  const dropdownId = useId();

  return (
    <>
      <button
        ref={floatingRefs.setReference}
        aria-expanded={showMenu}
        aria-controls={dropdownId}
        type="button"
        onClick={() => {
          if (!preventOpenOnRelease.current) {
            show();
          }
        }}
        onMouseDown={() => {
          preventOpenOnRelease.current = showMenu;
        }}
        className={cx(
          "group",
          css({
            display: "flex",
            outline: 0,
            cursor: "pointer",
          }),
        )}
        style={customButton ? {} : {
          height: size === "small" ? 32 : 40,
          fontSize: size === "small" ? 16 : 24,
        }}
      >
        {customButton ?? (
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              padding: "0 10px 0 16px",
              height: "100%",
              whiteSpace: "nowrap",
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
              gap: size === "small" ? 6 : 8,
              color: `var(--color-${buttonItem === placeholder ? "placeholder" : "normal"})`,
              background: `var(--background-${buttonItem === placeholder ? "placeholder" : "normal"})`,
            } as CSSProperties}
          >
            {buttonItem.icon && buttonDisplay !== "label-only" && (
              <div style={{ marginLeft: -6 }}>
                {buttonItem.icon}
              </div>
            )}
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 8,
              })}
            >
              {buttonItem.label}
            </div>
            <div>
              <IconChevronDown size={size === "small" ? 16 : 24} />
            </div>
          </div>
        )}
      </button>
      <Root>
        {menuVisibility((appearStyles, show) => (
          show && (
            <a.div
              ref={floatingRefs.setFloating}
              id={dropdownId}
              className={css({
                position: "absolute",
                top: 0,
                left: 0,
                zIndex: 1,
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
                  gap: 12,
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
                {groups.map((group, groupIndex) => (
                  <div
                    key={groupIndex}
                    className={css({
                      display: "flex",
                      flexDirection: "column",
                    })}
                  >
                    {group.label && (
                      <div
                        key={groupIndex}
                        className={css({
                          display: "flex",
                          alignItems: "center",
                          padding: "12px 16px 8px",
                          textTransform: "uppercase",
                          fontSize: 12,
                          color: "contentAlt",
                          userSelect: "none",
                        })}
                      >
                        {group.label}
                      </div>
                    )}
                    {group.items.map((item_) => {
                      const item = getItem(item_);
                      const index = item ? itemsOnly.indexOf(item) : -1;
                      return item && (
                        <button
                          key={`${groupIndex}${index}`}
                          tabIndex={index === focused ? 0 : -1}
                          type="button"
                          disabled={typeof item.disabled === "string" || item.disabled}
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
                              padding: 4,
                              cursor: "pointer",
                              _disabled: {
                                cursor: "not-allowed",
                              },
                              _focus: {
                                outline: 0,
                              },
                            }),
                          )}
                        >
                          <div
                            className={css({
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-start",
                              gap: 8,
                              width: "100%",
                              height: "100%",
                              padding: 12,
                              textAlign: "left",
                              borderRadius: 16,
                              transition: "background 80ms",
                              _groupFocus: {
                                background: "focusedSurface",
                              },
                              _groupActive: {
                                background: "focusedSurfaceActive",
                              },
                              _groupDisabled: {
                                opacity: 0.5,
                              },
                            })}
                          >
                            <div
                              className={css({
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 16,
                                width: "100%",
                                height: "100%",
                              })}
                            >
                              <div
                                className={css({
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                  width: "100%",
                                })}
                              >
                                {item.icon && <div>{item.icon}</div>}
                                <div
                                  className={css({
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 8,
                                    width: "100%",
                                  })}
                                >
                                  <div>{item.label}</div>
                                  <div
                                    className={css({
                                      fontSize: 11,
                                      textTransform: "uppercase",
                                    })}
                                  >
                                    {item.disabled}
                                  </div>
                                </div>
                              </div>
                              {item.value && <div>{item.value}</div>}
                            </div>
                            {item.secondary && (
                              <div
                                className={css({
                                  fontSize: 13,
                                  color: "contentAlt",
                                  fontWeight: 500,
                                })}
                              >
                                {item.secondary}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
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
      if (!menuVisible) {
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        onFocus((focused + 1) % itemsLength);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
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
  }, [itemsLength, onClose, onFocus, focused, menuVisible]);
}

function getItem<
  DDItem extends Omit<DropdownItem, "disabled"> & { disabled?: string },
>(
  item: DropdownItem | ReactNode,
): null | DDItem {
  if (!item) {
    return null;
  }
  const item_ = typeof item === "object" && "label" in item
    ? item
    : { label: item };

  if (typeof item_.disabled !== "string") {
    item_.disabled = item_.disabled ? "Disabled" : undefined;
  }

  return item_ as DDItem;
}

function isGroup(item: DropdownItem | DropdownGroup): item is DropdownGroup {
  return Boolean(typeof item === "object" && item && "items" in item);
}

// Convert items to groups if necessary
function getGroups(itemsOrGroup: readonly DropdownItem[] | readonly DropdownGroup[]): readonly DropdownGroup[] {
  const [firstItem] = itemsOrGroup;
  if (!firstItem) {
    return [];
  }
  return isGroup(firstItem)
    ? (itemsOrGroup as DropdownGroup[])
    : [{ label: null, items: itemsOrGroup }];
}
