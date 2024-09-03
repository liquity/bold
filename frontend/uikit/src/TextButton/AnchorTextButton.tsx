import type { ComponentPropsWithRef } from "react";
import type { TextButtonProps } from "./TextButton";

import { forwardRef } from "react";
import { cx } from "../../styled-system/css";
import { useTextButtonStyles } from "./TextButton";

export const AnchorTextButton = forwardRef<
  HTMLAnchorElement,
  ComponentPropsWithRef<"a"> & TextButtonProps
>(function AnchorTextButton({
  label,
  size,
  ...props
}, ref) {
  const textButtonStyles = useTextButtonStyles(size);
  return (
    <a
      ref={ref}
      className={cx(
        props.className,
        textButtonStyles.className,
      )}
      {...props}
    >
      {label}
    </a>
  );
});
