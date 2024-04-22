import type { ReactNode } from "react";

import { RootEntryPoint } from "../Root/Root";

export function UiKit({ children }: { children: ReactNode }) {
  return (
    <RootEntryPoint>
      {children}
    </RootEntryPoint>
  );
}
