import type { HTMLAttributes } from "react";

import { css, cx } from "@/styled-system/css";

export function Value({
  children,
  negative,
  ...props
}: {
  negative?: boolean | null;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cx(
        props.className,
        css({
          "--color-negative": "token(colors.negative)",
        }),
      )}
      style={{
        color: negative ? "var(--color-negative)" : "inherit",
        ...props.style,
      }}
    >
      {children}
    </div>
  );
}
