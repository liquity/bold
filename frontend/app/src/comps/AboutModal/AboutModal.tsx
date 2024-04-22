"use client";

import type { ReactNode } from "react";

import { APP_VERSION, COMMIT_HASH } from "@/src/env";
import * as env from "@/src/env";
import { css } from "@/styled-system/css";
import { Modal } from "@liquity2/uikit";
import { createContext, useContext, useState } from "react";

const AboutModalContext = createContext({
  open: () => {},
  close: () => {},
});

export function AboutModal({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);

  const contracts = Object.entries(env)
    .filter(([name]) => name.startsWith("CONTRACT_"))
    .map(([name, address]) => [name.replace("CONTRACT_", ""), String(address)]);

  return (
    <AboutModalContext.Provider
      value={{
        open: () => {
          setVisible(true);
        },
        close: () => setVisible(false),
      }}
    >
      {children}
      <Modal
        onClose={() => setVisible(false)}
        visible={visible}
        title="About"
      >
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: 8,
          })}
        >
          <div>
            Version: {APP_VERSION} (<a
              href={`"https://github.com/liquity/bold/tree/${COMMIT_HASH}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              {COMMIT_HASH}
            </a>)
          </div>
          <div>
            <div
              className={css({
                paddingBottom: 8,
              })}
            >
              Contracts:
            </div>
            <pre
              className={css({
                fontSize: 12,
              })}
            >
          {contracts.map(([name, address]) => (
            <div key={name}>
              {name}: {address}
            </div>
          ))}
            </pre>
          </div>
        </div>
      </Modal>
    </AboutModalContext.Provider>
  );
}

export function useAboutModal() {
  return useContext(AboutModalContext);
}
