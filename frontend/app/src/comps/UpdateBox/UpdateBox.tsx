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
        <HFlex
          key={index}
          justifyContent="space-between"
          gap={16}
        >
          <HFlex gap={4}>{label}</HFlex>
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
                })}
              >
                {after}
              </HFlex>
            }
          />
        </HFlex>
      ))}
    </div>
  );
}
