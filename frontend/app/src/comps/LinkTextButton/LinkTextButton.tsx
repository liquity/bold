import type { AnchorHTMLAttributes, ComponentPropsWithRef, ForwardedRef } from "react";

import { AnchorTextButton } from "@liquity2/uikit";
import Link from "next/link";

function NextLinkAdapter({
  href,
  ref,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  ref?: ForwardedRef<HTMLAnchorElement>;
}) {
  if (!href) {
    throw new Error("href is required");
  }
  return <Link ref={ref} href={href} {...props} />;
}

export function LinkTextButton(
  props: ComponentPropsWithRef<typeof AnchorTextButton> & {
    href: string;
  },
) {
  return (
    <AnchorTextButton
      AnchorComponent={NextLinkAdapter}
      {...props}
    />
  );
}
