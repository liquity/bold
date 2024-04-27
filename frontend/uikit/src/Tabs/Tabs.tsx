import type { ReactNode } from "react";

import { a, useSpring } from "@react-spring/web";
import { useEffect, useRef, useState } from "react";
import useDimensions from "react-cool-dimensions";
import { css } from "../../styled-system/css";
import { token } from "../../styled-system/tokens";

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

export function Tabs({
  items,
  onSelect,
  selected,
}: {
  items: TabItem[];
  onSelect: (index: number) => void;
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

  const { observe, width } = useDimensions();

  // update selectedRect from the selected button
  useEffect(() => {
    const button = container.current?.querySelector(`button:nth-of-type(${selected + 1})`);
    if (button instanceof HTMLElement) {
      setSelectedRect([button.offsetLeft, button.offsetWidth]);
    }
  }, [
    selected,
    width, // update on container width change too
    items,
  ]);

  return (
    <div
      ref={container}
      role="tablist"
      className={css({
        overflow: "hidden",
        display: "flex",
        width: "100%",
        height: 44,
        padding: 4,
        background: "fieldSurface",
        borderRadius: 12,
      })}
    >
      <div
        className={css({
          position: "relative",
          width: "100%",
        })}
      >
        <div
          ref={observe}
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
            gap: 8,
            width: "100%",
            height: "100%",
          })}
          style={{
            gridTemplateColumns: `repeat(${items.length}, 1fr)`,
          }}
        >
          {items.map((item, index) => (
            <Tab
              key={index}
              onSelect={() => onSelect(index)}
              selected={index === selected}
              tabItem={item}
            />
          ))}
        </div>
        <a.div
          style={{
            transform: barSpring.transform,
            width: barSpring.width,
          }}
          className={css({
            position: "absolute",
            zIndex: 1,
            inset: "0 auto 0 0",
            width: 0,
            background: "controlSurface",
            border: "1px solid token(colors.fieldBorder)",
            transformOrigin: "0 0",
            borderRadius: 8,
          })}
        />
      </div>
    </div>
  );
}

function Tab({
  onSelect,
  selected,
  tabItem: { label, tabId, panelId },
}: {
  onSelect: () => void;
  selected: boolean;
  tabItem: TabItem;
}) {
  return (
    <button
      aria-controls={panelId}
      aria-selected={selected}
      id={tabId}
      onClick={onSelect}
      role="tab"
      tabIndex={selected ? 0 : -1}
      className={css({
        zIndex: 3,
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: "0 16px",
        fontSize: 16,
        color: "interactive",
        cursor: "pointer",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        overflow: "hidden",
        _active: {
          translate: "0 1px",
        },
        _focusVisible: {
          outline: "2px solid token(colors.focused)",
          outlineOffset: -2,
          borderRadius: 8,
        },
      })}
      style={{
        color: token(`colors.${selected ? "selected" : "interactive"}`),
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
  isFocused: React.MutableRefObject<boolean>;
  itemsLength: number;
  onSelect: (index: number) => void;
  selected: number;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isFocused.current) {
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onSelect((selected + 1) % itemsLength);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onSelect(selected === 0 ? itemsLength - 1 : selected - 1);
        return;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [itemsLength, onSelect, selected]);
}

// Focuses the selected tab when the selection changes
function useFocusSelected({
  isFocused,
  container,
  selected,
}: {
  isFocused: React.MutableRefObject<boolean>;
  container: React.MutableRefObject<HTMLDivElement | null>;
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
  }, [selected]);
}
