import type { ReactNode } from "react";

import { css } from "../../styled-system/css";
import { IconInfo } from "../icons";
import { TextButton } from "../TextButton/TextButton";
import { Tooltip } from "./Tooltip";

export function InfoTooltip({
  children,
  heading,
}: {
  children?: ReactNode;
  heading?: ReactNode;
}) {
  return (
    <Tooltip
      opener={({ buttonProps, setReference }) => (
        <TextButton
          ref={setReference}
          label={<IconInfo size={16} />}
          className={css({
            color: "contentAlt2!",
          })}
          {...buttonProps}
        />
      )}
    >
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 8,
        })}
      >
        {heading && <h1>{heading}</h1>}
        <div
          className={css({
            fontSize: 14,
            color: "#878AA4",
            "& a": {
              color: "token(colors.accent)",
              textDecoration: "underline",
            },
          })}
        >
          {children}
        </div>
      </div>
    </Tooltip>
  );
}
