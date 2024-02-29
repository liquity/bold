import type { ReactNode } from "react";

import { Footer } from ":src/comps/Footer/Footer";
import { TopBar } from ":src/comps/TopBar/TopBar";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  main: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    minHeight: "100vh",
    maxWidth: 1160,
    margin: "0 auto",
  },
  top: {
    flexGrow: 0,
    flexShrink: 0,
    paddingBottom: 40,
  },
  content: {
    flexGrow: 1,
    flexShrink: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  footer: {
    flexGrow: 0,
    flexShrink: 0,
    paddingTop: 40,
  },
});

export function Layout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.main)}>
      <div {...stylex.props(styles.top)}>
        <TopBar />
      </div>
      <div {...stylex.props(styles.content)}>
        {children}
      </div>
      <div {...stylex.props(styles.footer)}>
        <Footer />
      </div>
    </div>
  );
}
