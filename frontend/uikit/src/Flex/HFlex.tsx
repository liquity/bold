import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { css, cx } from "../../styled-system/css";

export function HFlex({
  children,
  className,
  gap = 8,
  justifyContent = "center",
  style = {},
  ...props
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  justifyContent?: CSSProperties["justifyContent"];
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        className,
        css({
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
        }),
      )}
      style={{
        ...style,
        gap,
        justifyContent,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
