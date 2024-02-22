import { css } from ":panda/css";
import { AppLauncher } from ":src/comps/AppLauncher/AppLauncher";
import { Layout } from ":src/comps/Layout/Layout";

export function Home() {
  return (
    <Layout>
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          width: "100%",
          height: "100%",
        })}
      >
        <AppLauncher />
      </div>
    </Layout>
  );
}
