"use client";

import { LOCAL_STORAGE_PREFIX } from "@/src/constants";

const RPC_OVERRIDE_KEY = `${LOCAL_STORAGE_PREFIX}rpc_override`;
const SUBGRAPH_OVERRIDE_KEY = `${LOCAL_STORAGE_PREFIX}subgraph_override`;

export function getRpcOverride(): string | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  try {
    const stored = localStorage.getItem(RPC_OVERRIDE_KEY);
    if (stored && isValidUrl(stored)) {
      return stored;
    }
    return null;
  } catch {
    return null;
  }
}

export function setRpcOverride(url: string | null): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  if (url === null || url.trim() === "") {
    localStorage.removeItem(RPC_OVERRIDE_KEY);
  } else {
    localStorage.setItem(RPC_OVERRIDE_KEY, url.trim());
  }
}

export function getSubgraphOverride(): string | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  try {
    const stored = localStorage.getItem(SUBGRAPH_OVERRIDE_KEY);
    if (stored && isValidUrl(stored)) {
      return stored;
    }
    return null;
  } catch {
    return null;
  }
}

export function setSubgraphOverride(url: string | null): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  if (url === null || url.trim() === "") {
    localStorage.removeItem(SUBGRAPH_OVERRIDE_KEY);
  } else {
    localStorage.setItem(SUBGRAPH_OVERRIDE_KEY, url.trim());
  }
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
