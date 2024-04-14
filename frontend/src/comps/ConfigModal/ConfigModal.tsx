"use client";

import type { ReactNode } from "react";

import { Modal } from "@/src/comps/Modal/Modal";
import { createContext, useContext, useState } from "react";

const ConfigModalContext = createContext({
  open: () => {},
  close: () => {},
});

export function ConfigModal({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <ConfigModalContext.Provider
      value={{
        open: () => setVisible(true),
        close: () => setVisible(false),
      }}
    >
      {children}
      <Modal
        onClose={() => setVisible(false)}
        visible={visible}
        title="Settings"
      >
        <div />
      </Modal>
    </ConfigModalContext.Provider>
  );
}

export function useConfigModal() {
  return useContext(ConfigModalContext);
}
