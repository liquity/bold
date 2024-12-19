"use client";

import type { KeyboardEvent, ReactNode } from "react";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { noop } from "../utils";

type RadioGroupContext = {
  addRadio: (radioIndex: number) => void;
  focusableIndex?: number;
  select: (radioIndex: number) => void;
  removeRadio: (radioIndex: number) => void;
  selectNext: () => void;
  selectPrev: () => void;
  selected: number;
};

const RadioGroupContext = createContext<RadioGroupContext>({
  addRadio: noop,
  focusableIndex: undefined,
  select: noop,
  removeRadio: noop,
  selectNext: noop,
  selectPrev: noop,
  selected: 0,
});

export function RadioGroup({
  children,
  selected,
  onChange = noop,
}: {
  children: ReactNode;
  selected: number;
  onChange: (radioIndex: number) => void;
}) {
  const [radios, setRadios] = useState<Set<number>>(new Set());

  const addRadio = useCallback((radioIndex: number) => {
    setRadios((radios) => {
      const _radios = new Set(radios);
      _radios.add(radioIndex);
      return _radios;
    });
  }, []);

  const removeRadio = useCallback((radioIndex: number) => {
    setRadios((radios) => {
      const _radios = new Set(radios);
      _radios.delete(radioIndex);
      return _radios;
    });
  }, []);

  const selectPrev = () => {
    const radioIndex = findSiblingIndex<number>(radios, selected, -1);
    if (radioIndex !== null) {
      onChange(radioIndex);
    }
  };

  const selectNext = () => {
    const radioIndex = findSiblingIndex<number>(radios, selected, 1);
    if (radioIndex !== null) {
      onChange(radioIndex);
    }
  };

  const focusableIndex = radios.has(selected) ? selected : [...radios][0];

  return (
    <RadioGroupContext.Provider
      value={{
        addRadio,
        focusableIndex,
        select: onChange,
        removeRadio,
        selectNext,
        selectPrev,
        selected,
      }}
    >
      <div role="radiogroup">{children}</div>
    </RadioGroupContext.Provider>
  );
}

const KEYS_PREV = ["ArrowUp", "ArrowLeft"];
const KEYS_NEXT = ["ArrowDown", "ArrowRight"];

type RadioGroupValue = RadioGroupContext & {
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

export function useRadioGroup(radioIndex?: number): RadioGroupValue | null {
  const radioGroup = useContext(RadioGroupContext);

  const { addRadio, removeRadio } = radioGroup ?? {};
  useEffect(() => {
    if (radioIndex === undefined || !addRadio || !removeRadio) {
      return;
    }
    addRadio(radioIndex);
    return () => removeRadio(radioIndex);
  }, [radioIndex, addRadio, removeRadio]);

  if (!radioGroup) {
    return null;
  }

  return {
    ...radioGroup,

    // Handles key events and trigger changes in the RadioGroup as needed.
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.altKey || event.metaKey || event.ctrlKey) {
        return;
      }

      if (KEYS_PREV.includes(event.key)) {
        radioGroup.selectPrev();
        event.preventDefault();
      }

      if (KEYS_NEXT.includes(event.key)) {
        radioGroup.selectNext();
        event.preventDefault();
      }
    },
  };
}

function findSiblingIndex<Index extends number>(
  radios: Set<Index>,
  selected: Index,
  diff: -1 | 1,
) {
  const _radios = [...radios];
  const selectedIndex = _radios.indexOf(selected);
  const newSelectedIndex = selectedIndex + diff;

  // no radios
  if (_radios.length === 0) {
    return null;
  }

  // previous radio when the first one is selected: cycle to the last one
  if (newSelectedIndex === -1) {
    return _radios[_radios.length - 1];
  }

  // next radio when the last one is selected: cycle to the first one
  if (newSelectedIndex === _radios.length) {
    return _radios[0];
  }

  // return the found radio
  if (selectedIndex > -1 && _radios[newSelectedIndex]) {
    return _radios[newSelectedIndex];
  }

  // return the first radio found by default
  return _radios[0] === undefined ? null : _radios[0];
}
