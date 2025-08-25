import { css } from "@/styled-system/css";
import { fmtnum } from "@/src/formatting";
import { IconUpvote, IconDownvote, IconEdit, Button } from "@liquity2/uikit";

import type { FC } from "react";
import type { Dnum, Vote as VoteType } from "@/src/types";

interface VoteProps {
  vote: VoteType;
  share: Dnum;
  disabled: boolean;
  onEdit: () => void;
}

export const Vote: FC<VoteProps> = ({ vote, share, disabled, onEdit }) => (
  <div
    className={css({
      display: "flex",
      alignItems: "center",
      height: 34,
    })}
  >
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 8,
      })}
    >
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 4,
          "--color-disabled": "token(colors.disabledContent)",
        })}
      >
        {vote === "for" && <IconUpvote size={24} />}
        {vote === "against" && (
          <div
            className={css({
              transform: "translateY(2px)",
              color: disabled ? "var(--color-disabled)" : undefined,
            })}
          >
            <IconDownvote size={24} />
          </div>
        )}
        <div
          title={`${fmtnum(share, "pct2")}% of your voting power has been allocated to ${
            vote === "for" ? "upvote" : "downvote"
          } this initiative`}
          className={css({
            width: 46,
          })}
          style={{
            textDecoration: disabled ? "line-through" : undefined,
            color: disabled ? "var(--color-disabled)" : undefined,
          }}
        >
          {fmtnum(share, { preset: "pct2", suffix: "%" })}
        </div>
      </div>
      <Button
        disabled={disabled}
        size="mini"
        title={disabled ? "Initiative disabled" : "Change allocation"}
        label={<IconEdit size={20} />}
        onClick={onEdit}
        className={css({
          height: "34px!",
        })}
      />
    </div>
  </div>
);
