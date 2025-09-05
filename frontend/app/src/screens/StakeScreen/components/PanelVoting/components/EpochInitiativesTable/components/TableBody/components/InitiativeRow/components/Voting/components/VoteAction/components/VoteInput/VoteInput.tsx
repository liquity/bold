import { ChangeEvent, useCallback, useState } from "react";
import { css } from "@/styled-system/css";
import { useSetInputFocus } from "./hooks";

import type { FC } from "react";
import type { Vote } from "@/src/types";

interface VoteInputProps {
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  vote: Vote;
}

export const VoteInput: FC<VoteInputProps> = ({
  value,
  onChange: handleOnChange,
  placeholder,
  disabled,
  vote,
}) => {
  const [inputValue, setInputValue] = useState(!!Number(value) ? value : "");
  const { inputRef } = useSetInputFocus({ vote, setInputValue });

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      handleOnChange(e);
      setInputValue(e.target.value.trim());
    },
    [handleOnChange],
  );

  return (
    <input
      ref={inputRef}
      onChange={onChange}
      value={inputValue}
      placeholder={placeholder}
      disabled={disabled}
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
  );
};
