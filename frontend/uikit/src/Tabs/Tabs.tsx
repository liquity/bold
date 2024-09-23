import type { MouseEvent, MutableRefObject, ReactNode, TouchEvent } from "react";

import { a, useSpring } from "@react-spring/web";
import { useEffect, useRef, useState } from "react";
import { css } from "../../styled-system/css";
import { token } from "../../styled-system/tokens";
import { useElementSize } from "../react-utils";

export type TabItem = {
  label: ReactNode;
  panelId: string;
  tabId: string;
};

// A note regarding the focus management in this component: the component
// follows the ARIA Authoring Practices Guide Tabs Pattern [1][2].
//
// Consequently:
// - Only the selected tab is focusable (not the container nor the other tabs).
// - Once focused, the left and right arrows can be used to navigate between tabs.
// - The focus is moved by the component when the selected tab changes.
//
// [1] https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
// [2] https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-automatic/

type OnSelectContext =
  | { origin: "mouse"; event: MouseEvent<HTMLButtonElement> }
  | { origin: "touch"; event: TouchEvent<HTMLButtonElement> }
  | { origin: "keyboard"; event: KeyboardEvent };

export function Tabs({
  compact,
  items,
  onSelect,
  selected,
}: {
  compact?: boolean;
  items: TabItem[];
  onSelect: (index: number, context: OnSelectContext) => void;
  selected: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const isFocused = useRef(false);
  const [selectedRect, setSelectedRect] = useState<[number, number] | null>(null);

  selected = Math.min(Math.max(0, selected), items.length - 1);

  useKeyboardNavigation({
    isFocused,
    itemsLength: items.length,
    onSelect,
    selected,
  });

  useFocusSelected({
    container,
    isFocused,
    selected,
  });

  const barSpring = useSpring({
    to: selectedRect
      ? {
        transform: `translateX(${selectedRect[0]}px)`,
        width: selectedRect[1],
      }
      : {},
    config: {
      mass: 1,
      tension: 2400,
      friction: 120,
    },
    immediate: !selectedRect,
  });

  const { size } = useElementSize(container);

  // update selectedRect from the selected button
  useEffect(() => {
    const button = container.current?.querySelector(`button:nth-of-type(${selected + 1})`);
    if (button instanceof HTMLElement) {
      setSelectedRect([button.offsetLeft, button.offsetWidth]);
    }
  }, [
    items.length, // all tabs are the same width so this is enough
    selected,
    size, // update on container size change too
  ]);

  const styles = compact
    ? {
      container: {
        height: 32,
        "--background": token("colors.controlSurface"),
        "--border": `1px solid ${token("colors.border")}`,
        borderRadius: 16,
      },
      activeTab: {
        border: 0,
        "--background": token("colors.accent"),
        borderRadius: 12,
      },
      activeTabContent: {
        // color: token("colors.accentContent"),
        color: token(`colors.${selected ? "selected" : "interactive"}`),
      },
      tabsGap: 0,
    }
    : {
      container: {
        height: 44,
        "--background": token("colors.fieldSurface"),
        "--border": "0",
        borderRadius: 8,
      },
      activeTab: {
        border: "1px solid token(colors.border)",
        "--background": token("colors.controlSurface"),
        borderRadius: 8,
      },
      activeTabContent: {
        color: token(`colors.${selected ? "selected" : "interactive"}`),
      },
      tabsGap: 8,
    };

  return (
    <div
      ref={container}
      role="tablist"
      className={css({
        overflow: "hidden",
        display: "flex",
        width: "100%",
        padding: 4,
        background: "var(--background)",
        border: "var(--border)",
      })}
      style={styles.container}
    >
      <div
        className={css({
          position: "relative",
          zIndex: 0,
          width: "100%",
        })}
      >
        <div
          onFocus={() => {
            isFocused.current = true;
          }}
          onBlur={() => {
            isFocused.current = false;
          }}
          className={css({
            position: "relative",
            zIndex: 2,
            display: "grid",
            gridTemplateRows: "1fr",
            width: "100%",
            height: "100%",
          })}
          style={{
            gridTemplateColumns: `repeat(${items.length}, 1fr)`,
            gap: styles.tabsGap,
          }}
        >
          {items.map((item, index) => (
            <Tab
              key={index}
              compact={compact}
              onSelect={(context) => onSelect(index, context)}
              selected={index === selected}
              tabItem={item}
            />
          ))}
        </div>
        <a.div
          className={css({
            position: "absolute",
            zIndex: 1,
            inset: "0 auto 0 0",
            width: 0,
            background: "var(--background)",
            border: "1px solid token(colors.border)",
            transformOrigin: "0 0",
            borderRadius: 8,
          })}
          style={{
            transform: barSpring.transform,
            width: barSpring.width,
            ...styles.activeTab,
          }}
        />
      </div>
    </div>
  );
}

function Tab({
  compact,
  onSelect,
  selected,
  tabItem: { label, tabId, panelId },
}: {
  compact?: boolean;
  onSelect: (context: Exclude<OnSelectContext, { origin: "keyboard" }>) => void;
  selected: boolean;
  tabItem: TabItem;
}) {
  const styles = compact
    ? {
      activeTabContent: {
        color: selected ? token("colors.accentContent") : token("colors.interactive"),
      },
    }
    : {
      activeTabContent: {
        color: selected ? token("colors.selected") : token("colors.interactive"),
      },
    };
  return (
    <button
      aria-controls={panelId}
      aria-selected={selected}
      id={tabId}
      onMouseDown={(event) => {
        onSelect({ origin: "mouse", event });
      }}
      onTouchStart={(event) => {
        onSelect({ origin: "touch", event });
      }}
      role="tab"
      tabIndex={selected ? 0 : -1}
      className={css({
        zIndex: 3,
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        fontSize: 16,
        color: "interactive",
        cursor: "pointer",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        overflow: "hidden",
        _focusVisible: {
          outline: "2px solid token(colors.focused)",
          borderRadius: 8,
        },
      })}
      style={{
        color: styles.activeTabContent.color,
        padding: compact ? "0 12px" : "0 16px",
        outlineOffset: compact ? 1 : -2,
      }}
    >
      {label}
    </button>
  );
}

// Handles keyboard navigation when tabs are selected
function useKeyboardNavigation({
  isFocused,
  itemsLength,
  onSelect,
  selected,
}: {
  isFocused: MutableRefObject<boolean>;
  itemsLength: number;
  onSelect: (
    index: number,
    context: Extract<OnSelectContext, { origin: "keyboard" }>,
  ) => void;
  selected: number;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isFocused.current) {
        return;
      }
      const context = { origin: "keyboard", event } as const;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onSelect((selected + 1) % itemsLength, context);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onSelect(selected === 0 ? itemsLength - 1 : selected - 1, context);
        return;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isFocused, itemsLength, onSelect, selected]);
}

// Focuses the selected tab when the selection changes
function useFocusSelected({
  container,
  isFocused,
  selected,
}: {
  container: MutableRefObject<HTMLDivElement | null>;
  isFocused: MutableRefObject<boolean>;
  selected: number;
}) {
  useEffect(() => {
    if (!isFocused.current) {
      return;
    }
    const selectedButton = container.current?.querySelector(
      "[tabindex=\"0\"]",
    ) as HTMLElement;
    selectedButton?.focus();
  }, [isFocused, container, selected]);
}
