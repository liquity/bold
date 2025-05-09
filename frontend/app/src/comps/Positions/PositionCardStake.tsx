import type { PositionStake } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { fmtnum } from "@/src/formatting";
import { useVotingPower } from "@/src/liquity-governance";
import { css } from "@/styled-system/css";
import { HFlex, IconStake, TokenIcon } from "@liquity2/uikit";
import { useRef } from "react";
import { PositionCard } from "./PositionCard";
import { CardRow, CardRows } from "./shared";

export function PositionCardStake({
  deposit,
  owner,
  rewards,
}: Pick<
  PositionStake,
  | "deposit"
  | "owner"
  | "rewards"
>) {
  const votingPowerRef = useRef<HTMLDivElement>(null);
  useVotingPower(owner, (share) => {
    if (!votingPowerRef.current) {
      return;
    }

    if (!share) {
      votingPowerRef.current.innerHTML = "−";
      votingPowerRef.current.title = "";
      return;
    }

    const shareFormatted = fmtnum(share, { preset: "12z", scale: 100 }) + "%";
    votingPowerRef.current.innerHTML = fmtnum(share, "pct2z") + "%";
    votingPowerRef.current.title = shareFormatted;
  });
  return (
    <PositionCard
      className="position-card position-card-stake"
      href="/stake"
      heading={[
        <div
          key="start"
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "positionContent",
          })}
        >
          LQTY stake
        </div>,
      ]}
      contextual={
        <div
          className={css({
            color: "positionContent",
          })}
        >
          <IconStake size={32} />
        </div>
      }
      main={{
        value: (
          <HFlex gap={8} alignItems="center" justifyContent="flex-start">
            <Amount value={deposit} format={2} />
            <TokenIcon size="medium" symbol="LQTY" />
          </HFlex>
        ),
        label: (
          <HFlex gap={4} justifyContent="flex-start">
            Staked LQTY
          </HFlex>
        ),
      }}
      secondary={
        <CardRows>
          <CardRow
            start={
              <div
                className={css({
                  display: "flex",
                  gap: 8,
                  fontSize: 14,
                })}
              >
                <div
                  className={css({
                    color: "positionContentAlt",
                  })}
                >
                  Voting power
                </div>
                <div
                  className={css({
                    color: "positionContent",
                  })}
                >
                  <div ref={votingPowerRef} />
                </div>
              </div>
            }
          />
          <CardRow
            start={
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                })}
              >
                <div
                  className={css({
                    color: "positionContentAlt",
                  })}
                >
                  Rewards
                </div>
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: "positionContent",
                  })}
                >
                  <Amount value={rewards.lusd} format="2diff" />
                  <TokenIcon size="mini" symbol="LUSD" />
                </div>
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: "positionContent",
                  })}
                >
                  <Amount value={rewards.eth} format="4diff" />
                  <TokenIcon size="mini" symbol="ETH" />
                </div>
              </div>
            }
          />
        </CardRows>
      }
    />
  );
}
