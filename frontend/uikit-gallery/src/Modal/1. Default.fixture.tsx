"use client";

import { Button, Modal } from "@liquity2/uikit";
import { useState } from "react";

export default function Fixture() {
  const [visible, setVisible] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        width: "100%",
        padding: 16,
      }}
    >
      <Button
        label="Open Modal"
        onClick={() => setVisible(true)}
      />
      <Modal
        visible={visible}
        onClose={() => setVisible(false)}
        title="Modal Title"
      >
        {null}
      </Modal>
    </div>
  );
}
