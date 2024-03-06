"use client";

import { AppLauncher } from "@/src/comps/AppLauncher/AppLauncher";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  base: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
});

export default function Home() {
  return (
    <div {...stylex.props(styles.base)}>
      <AppLauncher />
    </div>
  );
}
