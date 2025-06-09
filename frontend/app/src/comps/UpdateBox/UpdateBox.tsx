import type { ReactNode } from "react";

import { ValueUpdate } from "@/src/comps/ValueUpdate/ValueUpdate";
import { css } from "@/styled-system/css";
import { HFlex } from "@liquity2/uikit";

type Update = {
  label: ReactNode;
  before: ReactNode;
  after: ReactNode;
};

export function UpdateBox({
  updates = [],
}: {
  updates?: Update[];
}) {
  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 16,
        fontSize: 16,
        color: "content",
        background: "infoSurface",
        border: "1px solid token(colors.infoSurfaceBorder)",
        borderRadius: 8,
      })}
    >
      {updates.map(({ label, before, after }, index) => (
        <div
          key={index}
          className={css({
            display: "flex",
            flexDirection: "column",
            alignItems: "start",
            justifyContent: "space-between",
            gap: 8,
            medium: {
              flexDirection: "row",
              alignItems: "center",
              gap: 16,
            },
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 4,
              whiteSpace: "nowrap",
            })}
          >
            {label}
          </div>
          <div
            className={css({
              minWidth: 0,
            })}
          >
            <ValueUpdate
              before={
                <HFlex
                  gap={4}
                  justifyContent="flex-start"
                  className={css({
                    fontVariantNumeric: "tabular-nums",
                  })}
                >
                  {before}
                </HFlex>
              }
              after={
                <HFlex
                  gap={4}
                  justifyContent="flex-start"
                  className={css({
                    fontVariantNumeric: "tabular-nums",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  })}
                >
                  {after}
                </HFlex>
              }
            />
          </div>
        </div>
      ))}
    </div>
  );
}
