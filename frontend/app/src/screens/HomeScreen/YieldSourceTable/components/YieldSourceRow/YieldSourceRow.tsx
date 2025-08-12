"use client";

import type { FC } from "react";
import { BoldYield } from "@/src/liquity-utils.ts";
import { css } from "@/styled-system/css";
import { Amount } from "@/src/comps/Amount/Amount.tsx";
import { LinkTextButton } from "@/src/comps/LinkTextButton/LinkTextButton.tsx";

interface YieldSourceRowProps extends BoldYield {
  compact: boolean;
}

export const YieldSourceRow: FC<YieldSourceRowProps> = ({
  compact,
  asset,
  tvl,
  link,
  weeklyApr,
  protocol,
}) => {
  return (
    <tr>
      <td>
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 8,
          })}
        >
          <span>{`${protocol} ${asset}`}</span>
        </div>
      </td>
      <td>
        <Amount fallback="…" percentage value={weeklyApr} />
      </td>
      <td>
        <Amount fallback="…" format="compact" prefix="$" value={tvl} />
      </td>
      {!compact && (
        <td>
          <LinkTextButton href={link} label="Link" title="Link" />
        </td>
      )}
    </tr>
  );
};
