import type { PositionStake } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { css } from "@/styled-system/css";
import { HFlex, IconStake, TokenIcon } from "@liquity2/uikit";
import Link from "next/link";
import { PositionCard } from "./PositionCard";
import { CardRow, CardRows } from "./shared";

export function PositionCardStake({
  deposit,
  rewards,
  share,
}: Pick<
  PositionStake,
  | "deposit"
  | "rewards"
  | "share"
>) {
  return (
    <Link
      href="/stake"
      legacyBehavior
      passHref
    >
      <PositionCard
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
                    <Amount
                      value={share}
                      percentage
                    />
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
    </Link>
  );
}
