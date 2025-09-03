"use client";

import { match } from "ts-pattern";
import { css } from "../../styled-system/css";
import tokenShellpoint from "../token-icons/shellpoint.svg";

export function ShellpointIcon({
  size = "medium",
  title,
}: {
  size?: "medium" | "large" | "small" | "mini" | number;
  title?: string | null;
}) {
  const size_ = match(size)
    .with("large", () => 40)
    .with("medium", () => 24)
    .with("small", () => 20)
    .with("mini", () => 16)
    .otherwise(() => size);

  const token = {
    icon: tokenShellpoint,
    name: "Shellpoint",
  } as const;

  return (
    <div
      className={css({
        display: "flex",
      })}
      style={{
        height: size_,
        width: size_,
      }}
    >
      <img
        alt={token.name}
        height={size_}
        src={token.icon}
        title={title === undefined ? token.name : title ?? undefined}
        width={size_}
      />
    </div>
  );
}