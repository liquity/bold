import { css } from "@/styled-system/css";
import { lt } from "dnum";
import { Amount } from "@/src/comps/Amount/Amount";
import { useRemainingVotingPower } from "@/src/screens/StakeScreen/components/PanelVoting/hooks";

import type { FC } from "react";

export const TableFooter: FC = () => {
  const remainingVotingPower = useRemainingVotingPower();
  const isNegative = lt(remainingVotingPower, 0);

  return (
    <tfoot
      className={css({
        fontSize: 14,
        color: "contentAlt",
        "& td": {
          borderTop: "1px solid token(colors.tableBorder)",
          padding: "16px 0 32px",
        },
        "& td:last-child": {
          textAlign: "right",
        },
      })}
    >
      <tr>
        <td colSpan={2}>
          <div
            className={css({
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 8,
            })}
          >
            <div
              className={css({
                overflow: "hidden",
                display: "flex",
              })}
            >
              <div
                title="100% of your voting power needs to be allocated."
                className={css({
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                })}
              >
                100% of your voting power needs to be allocated.
              </div>
            </div>
            <div
              className={css({
                color: isNegative ? "negative" : "inherit",
              })}
            >
              Remaining:{" "}
              <Amount format={2} value={remainingVotingPower} percentage />
            </div>
          </div>
        </td>
      </tr>
    </tfoot>
  );
};
