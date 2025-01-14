"use client";

import type { ReactNode } from "react";

import { createContext, useContext, useState } from "react";
import ReactDOM from "react-dom";

const RootContext = createContext<HTMLDivElement | null>(null);

export function RootEntryPoint({ children }: { children: ReactNode }) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  return (
    <RootContext.Provider value={element}>
      <div ref={setElement}>{element ? children : null}</div>
    </RootContext.Provider>
  );
}

export function Root({ children }: { children: ReactNode }) {
  const element = useContext(RootContext);
  return element === null
    ? <div />
    : ReactDOM.createPortal(children, element);
}
