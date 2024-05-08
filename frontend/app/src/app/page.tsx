"use client";

import { css } from "@/styled-system/css";
import { Button } from "@liquity2/uikit";
import Link from "next/link";

export default function Home() {
  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        width: "100%",
        height: "100%",
      })}
    >
      {([
        ["/contracts", true],
        ["/earn", true],
        ["/borrow", false],
      ] as const).map(([path, enabled]) => (
        <Link
          key={path}
          href={path}
        >
          <Button
            disabled={!enabled}
            label={path}
            mode="secondary"
            size="small"
            wide
          />
        </Link>
      ))}
    </div>
  );
}
