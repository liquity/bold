"use client";

import { css} from "../../styled-system/css";

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      className={css({
        position: "relative",
        zIndex: 2,
        display: "flex",
        flexDirection: "column",
        width: "100%",
        background: `redDimmed`,
        border: "1px solid token(colors.red)",
        borderRadius: 8,
        padding: 16,
      })}
    >
      <p className={css({
        color: "red",
        marginTop: 2
      })}>
        {message}
      </p>
    </div>
  )
}