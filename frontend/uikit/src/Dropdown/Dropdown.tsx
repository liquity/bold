"use client";

import type { ReactElement, ReactNode } from "react";
import type { CSSProperties } from "react";

import { autoUpdate, computePosition, offset, shift, useFloating } from "@floating-ui/react-dom";
import { a, useTransition } from "@react-spring/web";
import { isValidElement, useEffect, useId, useRef, useState } from "react";
import { css, cx } from "../../styled-system/css";
import { IconChevronDown } from "../icons";
import { Root } from "../Root/Root";

export type DropdownItem = {
  disabled?: boolean;
  disabledReason?: string;
  icon?: ReactNode;
  label: ReactNode;
  secondary?: ReactNode;
  value?: ReactNode;
};

export type DropdownGroup = {
  label: ReactNode;
  items: DropdownItem[];
};

type NormalizedGroup = {
  label: ReactNode | null;
  items: DropdownItem[];
  startIndex: number;
};

export function Dropdown({
  buttonDisplay = "normal",
  customButton,
  floatingUpdater,
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
  customButton?: (ctx: {
    item: DropdownItem | null;
    index: number;
    menuVisible: boolean;
  }) => ReactElement;
  floatingUpdater?: (args: {
    computePosition: typeof computePosition;
    referenceElement: HTMLElement;
    floatingElement: HTMLElement;
  }) => () => Promise<void>;
  items: DropdownItem[] | DropdownGroup[];
  menuPlacement?: "start" | "end" | "top-start" | "top-end";
  menuWidth?: number;
  onSelect: (index: number) => void;
  placeholder?: ReactNode | Exclude<DropdownItem, "value">;
  selected: null | number;
  size?: "small" | "medium";
}) {
  const { groups, flatItems } = normalizeGroups(items);

  let placement = menuPlacement === "start" || menuPlacement === "end"
    ? `bottom-${menuPlacement}` as const
    : menuPlacement;

  const { refs: floatingRefs, floatingStyles } = useFloating<HTMLButtonElement>({
    placement,
    whileElementsMounted: (refEl, floatingEl, update) => {
      const updateFromProps = refEl instanceof HTMLElement
        ? floatingUpdater?.({
          computePosition,
          referenceElement: refEl,
          floatingElement: floatingEl,
        })
        : null;
      return autoUpdate(refEl, floatingEl, updateFromProps ?? update, {
        layoutShift: false,
        animationFrame: false,
      });
    },
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

  const menuVisibility = useTransition({ groups: showMenu ? groups : null }, {
    keys: ({ groups }) => String(groups === null),
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
    itemsLength: flatItems.length,
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

  const dropdownId = useId();

  const buttonItem = (() => {
    const baseItem = selected >= 0 ? flatItems[selected] : null;

    if (typeof buttonDisplay === "function" && baseItem) {
      return buttonDisplay(baseItem, selected);
    }

    if (baseItem) {
      return baseItem;
    }

    if (placeholder && typeof placeholder === "object" && "label" in placeholder) {
      return placeholder;
    }

    return placeholder ? { label: placeholder } : null;
  })();

  const customButton_ = customButton?.({
    item: buttonItem,
    index: selected,
    menuVisible: showMenu,
  }) ?? (
    isValidElement(buttonDisplay) ? buttonDisplay : null
  );

  return (
    <>
      <button
        ref={floatingRefs.setReference}
        aria-expanded={showMenu}
        aria-controls={dropdownId}
        aria-haspopup="listbox"
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
            display: "grid",
            outline: 0,
            cursor: "pointer",
          }),
        )}
        style={customButton_ ? {} : {
          height: size === "small" ? 32 : 40,
          fontSize: size === "small" ? 16 : 24,
        }}
      >
        {customButton_ ?? (
          buttonItem && (
            <div
              className={css({
                display: "grid",
                gridAutoFlow: "column",
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
                  display: "grid",
                  alignItems: "center",
                  gap: 8,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                })}
              >
                <div
                  className={css({
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  })}
                >
                  {buttonItem.label}
                </div>
              </div>
              <div>
                <IconChevronDown size={size === "small" ? 16 : 24} />
              </div>
            </div>
          )
        )}
      </button>
      <Root>
        {menuVisibility((appearStyles, { groups }) => (
          groups && (
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
                {groups.map((group) => (
                  <div
                    key={group.startIndex}
                    className={css({
                      display: "flex",
                      flexDirection: "column",
                    })}
                  >
                    {group.label && (
                      <div
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
                    {group.items.map((item, itemIndex) => {
                      const index = group.startIndex + itemIndex;
                      return item && (
                        <button
                          key={`${group.startIndex}${itemIndex}`}
                          tabIndex={index === focused ? 0 : -1}
                          type="button"
                          disabled={item.disabled}
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
                                  {item.disabled && (
                                    <div
                                      className={css({
                                        fontSize: 11,
                                        textTransform: "uppercase",
                                        whiteSpace: "nowrap",
                                      })}
                                    >
                                      {item.disabledReason ?? "Disabled"}
                                    </div>
                                  )}
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

function isDropdownGroups(items: DropdownItem[] | DropdownGroup[]): items is DropdownGroup[] {
  // only check the first item
  return items.length > 0 && typeof items[0] === "object" && "items" in items[0];
}

function normalizeGroups(itemsOrGroups: DropdownItem[] | DropdownGroup[]): {
  groups: NormalizedGroup[];
  flatItems: DropdownItem[];
} {
  const flatItems: DropdownItem[] = [];
  const groups: NormalizedGroup[] = [];

  // groups
  if (isDropdownGroups(itemsOrGroups)) {
    for (const group of itemsOrGroups) {
      groups.push({
        label: group.label ?? null,
        items: group.items,
        startIndex: flatItems.length,
      });
      flatItems.push(...group.items);
    }
    return { groups, flatItems };
  }

  // items
  groups.push({
    label: null,
    items: itemsOrGroups,
    startIndex: 0,
  });
  flatItems.push(...itemsOrGroups);
  return { groups, flatItems };
}
