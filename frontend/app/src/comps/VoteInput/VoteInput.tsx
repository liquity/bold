import type { Dnum } from "@/src/types";
import type { RefObject } from "react";

import { dnumMax, dnumMin } from "@/src/dnum-utils";
import { parseInputFloat } from "@/src/form-utils";
import { css } from "@/styled-system/css";
import { IconDownvote, IconUpvote } from "@liquity2/uikit";
import { a, useTransition } from "@react-spring/web";
import * as dn from "dnum";
import { useEffect, useRef, useState } from "react";

type Vote = "for" | "against";

export function VoteInput({
  againstDisabled,
  forDisabled,
  onChange,
  onVote,
  ref: forwardedRef,
  value,
  vote,
}: {
  againstDisabled?: boolean;
  forDisabled?: boolean;
  onChange: (value: Dnum) => void;
  onVote: (vote: "for" | "against") => void;
  value: Dnum | null;
  vote: "for" | "against" | null;
  ref?: RefObject<HTMLInputElement | null>;
}) {
  const [isFocused, setIsFocused] = useState(false);

  const [inputValue, setInputValue] = useState(
    value ? dn.toString(dn.mul(value, 100)) : "",
  );

  const inputRef = useRef<HTMLInputElement | null>(null);

  const displayValue = (() => {
    // not selected => empty
    if (!vote) {
      return "";
    }
    // focused => show input value
    if (isFocused) {
      return inputValue;
    }
    // no value => show 0%
    if (!value) {
      return "0%";
    }
    // normal display
    return `${dn.toString(dn.mul(value, 100))}%`;
  })();

  useEffect(() => {
    if (!vote) {
      setInputValue("");
    } else if (!isFocused) {
      setInputValue(value ? dn.toString(dn.mul(value, 100)) : "0");
    }
  }, [vote, value?.[0], isFocused]);

  const prevVote = useRef(vote);
  useEffect(() => {
    if (vote && !prevVote.current) {
      inputRef.current?.focus();
    }
    prevVote.current = vote;
  }, [vote]);

  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        width: "fit-content",
        height: 34,
        padding: "0 0 0 8px",
        background: "fieldSurface",
        border: "1px solid token(colors.fieldBorder)",
        borderRadius: 8,
        outline: "2px solid transparent",
        outlineOffset: -1,
        "--outline-focused": "token(colors.fieldBorderFocused)",
      })}
      style={{
        outlineColor: isFocused ? "var(--outline-focused)" : "transparent",
      }}
    >
      <VoteButton
        disabled={forDisabled}
        onSelect={() => onVote("for")}
        selected={vote === "for"}
        vote="for"
      />
      <VoteButton
        disabled={againstDisabled}
        onSelect={() => onVote("against")}
        selected={vote === "against"}
        vote="against"
      />
      <input
        ref={(elt) => {
          inputRef.current = elt;
          if (forwardedRef) {
            forwardedRef.current = elt;
          }
        }}
        onFocus={() => {
          setIsFocused(true);
          setInputValue(
            !value || dn.eq(value, 0)
              ? "" // clear input if value is 0
              : dn.toString(dn.mul(value, 100)),
          );
        }}
        onBlur={() => {
          setIsFocused(false);

          // invalid input => reset to current value
          const parsed = parseInputFloat(inputValue.replace("%", ""));
          if (!parsed) {
            setInputValue(value ? dn.toString(dn.mul(value, 100)) : "0");
          }
        }}
        onChange={(event) => {
          setInputValue(event.target.value);
          const parsed = parseInputFloat(event.target.value);
          if (parsed) {
            onChange(
              dnumMax(dnumMin(dn.from(100, 18), parsed), dn.from(0, 18)),
            );
          }
        }}
        value={displayValue}
        placeholder="0%"
        disabled={vote === null}
        className={css({
          display: "block",
          width: 62,
          height: "100%",
          padding: 0,
          paddingRight: 8,
          fontSize: 14,
          textAlign: "right",
          color: "content",
          background: "transparent",
          border: 0,
          borderRadius: 8,
          outline: 0,
        })}
      />
    </div>
  );
}

function VoteButton({
  disabled,
  onSelect,
  selected,
  vote,
}: {
  disabled?: boolean;
  onSelect: () => void;
  selected: boolean;
  vote: Vote;
}) {
  const selectTransition = useTransition(selected, {
    from: { transform: "scale(1.5)" },
    enter: { transform: "scale(1)" },
    leave: { opacity: 0, immediate: true },
    config: {
      mass: 1,
      tension: 1800,
      friction: 120,
    },
  });

  return (
    <button
      disabled={disabled}
      onClick={() => onSelect()}
      title={vote === "for" ? "Vote for" : "Vote against"}
      type="button"
      className={css({
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: 24,
        height: 24,
        borderRadius: 8,
        cursor: "pointer",
        _focusVisible: {
          outline: "2px solid token(colors.focused)",
        },
        _active: {
          transform: "translateY(1px)",
        },
        _disabled: {
          cursor: "not-allowed",
          transform: "none!important",
        },
      })}
    >
      {selectTransition((style, item) => (
        <a.div
          className={css({
            position: "absolute",
            inset: 0,
            "--color-normal": "token(colors.contentAlt)",
            "--color-selected": "token(colors.accent)",
            "--color-disabled": "token(colors.dimmed)",
          })}
          style={{
            transform: item ? style.transform : undefined,
            color: selected
              ? "var(--color-selected)"
              : disabled
              ? "var(--color-disabled)"
              : "var(--color-normal)",
          }}
        >
          {vote === "for"
            ? <IconUpvote size={24} />
            : <IconDownvote size={24} />}
        </a.div>
      ))}
    </button>
  );
}
