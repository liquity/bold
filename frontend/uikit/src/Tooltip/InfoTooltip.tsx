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
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {heading && <h1>{heading}</h1>}
        <div
          style={{
            fontSize: 14,
            color: "#878AA4",
          }}
        >
          {children}
        </div>
      </div>
    </Tooltip>
  );
}
