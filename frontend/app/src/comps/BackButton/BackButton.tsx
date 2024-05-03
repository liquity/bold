import type { ReactNode } from "react";

import { css } from "@/styled-system/css";
import { IconArrowBack } from "@liquity2/uikit";
import Link from "next/link";

export function BackButton({
  href,
  label,
}: {
  href: string;
  label: ReactNode;
}) {
  return (
    <div
      className={css({
        display: "flex",
        width: "100%",
      })}
    >
      <Link href={href} passHref legacyBehavior>
        <a
          className={css({
            display: "flex",
            alignItems: "center",
            paddingRight: 8,
            gap: 8,
            color: "accent",
            _active: {
              translate: "0 1px",
            },
            _focusVisible: {
              outline: "2px solid token(colors.focused)",
              borderRadius: 4,
            },
          })}
        >
          <IconArrowBack />
          {label}
        </a>
      </Link>
    </div>
  );
}
