import type {ComponentPropsWithRef } from "react";

import { AnchorTextButton } from "@liquity2/uikit";
export function LinkTextButton(
  props: ComponentPropsWithRef<typeof AnchorTextButton> & {
    href: string;
  },
) {
  return (
    <AnchorTextButton
      {...props}
    />
  );
}
