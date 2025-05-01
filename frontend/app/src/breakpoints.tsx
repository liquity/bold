"use client";

import type { ReactNode } from "react";

import { createContext, useContext, useEffect, useRef, useState } from "react";

export type BreakpointName = "small" | "medium" | "large";
export type Breakpoint = {
  name: BreakpointName;
  small: boolean;
  medium: boolean;
  large: boolean;
};

export const BREAKPOINTS: Record<BreakpointName, number> = {
  "small": 360,
  "medium": 624,
  "large": 960,
};

export function getBreakpointName(): BreakpointName {
  if (typeof window === "undefined") return "small";
  const w = window.innerWidth;
  if (w >= BREAKPOINTS.large) return "large";
  if (w >= BREAKPOINTS.medium) return "medium";
  return "small";
}

export function getBreakpoint(): Breakpoint {
  if (typeof window === "undefined") {
    return {
      name: "small",
      small: true,
      medium: false,
      large: false,
    };
  }

  const breakpoint = getBreakpointName();
  const width = window.innerWidth;

  return {
    name: breakpoint,
    small: true,
    medium: width >= BREAKPOINTS.medium,
    large: width >= BREAKPOINTS.large,
  };
}

export function useBreakpoint(callback: (breakpoint: Breakpoint) => void): void {
  const currentBreakpointRef = useRef<Breakpoint | null>(null);

  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handleResize = () => {
      const breakpoint = getBreakpoint();
      if (breakpoint.name !== currentBreakpointRef.current?.name) {
        currentBreakpointRef.current = breakpoint;
        callbackRef.current(breakpoint);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);
}

const BreakpointNameContext = createContext<BreakpointName | null>(null);

export function BreakpointName({ children }: { children: ReactNode }) {
  const [breakpointName, setBreakpointName] = useState<BreakpointName>(() => (
    getBreakpointName()
  ));
  useBreakpoint((breakpoint) => {
    setBreakpointName(breakpoint.name);
  });
  return (
    <BreakpointNameContext.Provider value={breakpointName}>
      {children}
    </BreakpointNameContext.Provider>
  );
}

export function useBreakpointName(): BreakpointName {
  const breakpointName = useContext(BreakpointNameContext);
  if (breakpointName === null) {
    throw new Error("useBreakpointName must be called within BreakpointName");
  }
  return breakpointName;
}
