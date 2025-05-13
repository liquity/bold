import type { AnchorHTMLAttributes, ComponentPropsWithRef, ForwardedRef } from "react";

import { AnchorButton } from "@liquity2/uikit";
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

export function LinkButton(
  props: ComponentPropsWithRef<typeof AnchorButton> & {
    href: string;
  },
) {
  return (
    <AnchorButton
      AnchorComponent={NextLinkAdapter}
      {...props}
    />
  );
}
