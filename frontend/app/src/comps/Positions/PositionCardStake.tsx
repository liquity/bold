import type { PositionStake } from "@/src/types";

import { Amount } from "@/src/comps/Amount/Amount";
import { css } from "@/styled-system/css";
import { HFlex, IconStake, StrongCard, TokenIcon } from "@liquity2/uikit";
import Link from "next/link";
import { CardRow, CardRows, EditSquare } from "./shared";

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
      <StrongCard
        heading={[
          <div
            key="start"
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "strongSurfaceContent",
            })}
          >
            <div
              className={css({
                display: "flex",
                color: "brandGolden",
              })}
            >
              <IconStake size={16} />
            </div>
            LQTY stake
          </div>,
        ]}
        contextual={<EditSquare />}
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
                      color: "strongSurfaceContentAlt",
                    })}
                  >
                    Voting power
                  </div>
                  <div
                    className={css({
                      color: "strongSurfaceContent",
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
                      color: "strongSurfaceContentAlt",
                    })}
                  >
                    Rewards
                  </div>
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "strongSurfaceContent",
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
                      color: "strongSurfaceContent",
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
