import type { HTMLAttributes, ReactNode } from "react";

import { css, cx } from "../../styled-system/css";

export function VFlex({
  children,
  className,
  gap = 8,
  style = {},
  ...props
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        className,
        css({
          display: "flex",
          flexDirection: "column",
        }),
      )}
      style={{
        ...style,
        gap,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
