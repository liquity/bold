import { AppLauncher } from ":src/comps/AppLauncher/AppLauncher";
import { Layout } from ":src/comps/Layout/Layout";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  base: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    height: "100%",
  },
});

export function Home() {
  return (
    <Layout>
      <div {...stylex.props(styles.base)}>
        <AppLauncher />
      </div>
    </Layout>
  );
}
