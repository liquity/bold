"use client";

import type { ReactNode } from "react";

import { RootEntryPoint } from "../Root/Root";
import { Theme } from "../Theme/Theme";

export function UiKit({ children }: { children: ReactNode }) {
  return (
    <Theme>
      <RootEntryPoint>
        {children}
      </RootEntryPoint>
    </Theme>
  );
}
