import type { FC } from "react";
import { css } from "@/styled-system/css";
import { Spinner } from "@/src/comps/Spinner/Spinner.tsx";

export const Loader: FC = () => {
  return (
    <div
      className={css({
        height: 200,
        paddingTop: 40,
      })}
    >
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontSize: 18,
          userSelect: "none",
        })}
      >
        <Spinner size={18} />
        Loading
      </div>
    </div>
  );
};
