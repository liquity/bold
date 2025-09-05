import { css } from "@/styled-system/css";
import { a, useTransition } from "@react-spring/web";
import { IconDownvote, IconUpvote } from "@liquity2/uikit";

import type { FC } from "react";
import type { Vote } from "@/src/types";

interface VoteButtonProps {
  onSelect: () => void;
  selected: boolean;
  vote: Vote;
  disabled?: boolean;
}

export const VoteButton: FC<VoteButtonProps> = ({
  disabled,
  selected,
  vote,
  onSelect,
}) => {
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
          {vote === "for" ? (
            <IconUpvote size={24} />
          ) : (
            <IconDownvote size={24} />
          )}
        </a.div>
      ))}
    </button>
  );
};
